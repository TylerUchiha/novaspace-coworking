import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserPopupRedirectResolver,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as firebaseUpdatePassword,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { doc, getDocFromServer, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { validateAccessCodeRemote } from '../services/cloudFunctions';
import { setMonitoringUserId } from '../services/firebaseMonitoring';
import { UserProfile } from '../types';
import { trackSignUp, trackLogin, setAnalyticsUserId } from '../services/analytics';
import { registerFcmToken, unregisterFcmToken } from '../services/fcm';
import { imageOrPlaceholder } from '../utils/mediaPlaceholders';
import {
  clearCodeSession,
  CodeSessionRole,
  loadCodeSession,
  saveCodeSession,
  saveStaffBranchSession,
  saveStaffAccessCode,
  loadStaffAccessCode,
  StoredStaffBranch,
} from '../constants/auth';
import { normalizeUserProfile } from '../utils/userProfile';

export type AuthRole = 'customer' | 'employee' | 'owner';

interface SignUpDetails {
  name: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  codeSessionRole: CodeSessionRole | null;
  loading: boolean;
  isAuthenticated: boolean;
  isCodeSession: boolean;
  authError: string | null;
  profileSyncError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, details: SignUpDetails) => Promise<void>;
  /** @deprecated Use signInWithGoogle */
  signIn: () => Promise<void>;
  signInWithOwnerPasscode: (code: string) => Promise<boolean>;
  signInWithAccessCode: (code: string) => Promise<boolean>;
  enterStaffSession: (branch?: StoredStaffBranch) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (profile: UserProfile | ((prev: UserProfile | null) => UserProfile | null)) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  codeSessionRole: null,
  loading: true,
  isAuthenticated: false,
  isCodeSession: false,
  authError: null,
  profileSyncError: null,
  clearAuthError: () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signIn: async () => {},
  signInWithOwnerPasscode: async () => false,
  signInWithAccessCode: async () => false,
  enterStaffSession: async () => {},
  signOut: async () => {},
  updateUserProfile: async () => {},
  updatePassword: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function prefersGoogleRedirectAuth(): boolean {
  try {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('electron')) return true;
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  return false;
}

function isPopupAuthError(error: FirebaseError): boolean {
  return (
    error.code === 'auth/popup-blocked' ||
    error.code === 'auth/popup-closed-by-user' ||
    error.code === 'auth/cancelled-popup-request' ||
    error.code === 'auth/operation-not-supported-in-this-environment'
  );
}

function mapAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/requires-recent-login':
        return 'Please sign out and sign in again before changing your password.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled.';
      case 'auth/unauthorized-domain': {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        return `Domain "${host}" is not authorized in Firebase. Add "${host}" at Firebase Console → Authentication → Settings → Authorized domains. Use http://127.0.0.1:3000 (not localhost or a network IP).`;
      }
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled. Enable Email/Password or Google in Firebase Console → Authentication → Sign-in method.';
      case 'functions/permission-denied':
        return 'Invalid access code.';
      case 'functions/unavailable':
      case 'functions/deadline-exceeded':
        return 'Could not reach the server. Check your connection and try again.';
      default:
        return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Authentication failed. Please try again.';
}

function mapFirestoreError(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return 'Could not sync your profile with Firestore (permission denied). Sign out and sign back in, or contact support if this continues.';
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not sync profile with Firestore.';
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  return digits || undefined;
}

function isCodeAuthUid(uid: string): boolean {
  return uid.startsWith('code-');
}

function resolveStaffRoleFromUid(uid: string): CodeSessionRole | null {
  if (uid.includes('owner')) return 'owner';
  if (uid.includes('staff')) return 'employee';
  return null;
}

function buildStaffProfile(firebaseUser: User, role: CodeSessionRole): UserProfile {
  if (role === 'owner') {
    return {
      uid: firebaseUser.uid,
      name: 'Global Access Admin',
      role: 'owner',
      email: 'global@novaspace.internal',
      pfp: imageOrPlaceholder(),
      credits: 0,
      paymentMethods: [],
    };
  }

  return {
    uid: firebaseUser.uid,
    name: 'Staff Member',
    role: 'employee',
    email: 'staff@novaspace.internal',
    pfp: imageOrPlaceholder(),
    credits: 0,
    paymentMethods: [],
  };
}

function buildCodeSessionProfile(role: CodeSessionRole): UserProfile {
  if (role === 'owner') {
    return {
      uid: 'code-owner',
      name: 'Global Access Admin',
      role: 'owner',
      email: 'global@novaspace.internal',
      pfp: imageOrPlaceholder(),
      credits: 0,
      paymentMethods: [],
    };
  }

  return {
    uid: 'code-staff',
    name: 'Staff Member',
    role: 'employee',
    email: 'staff@novaspace.internal',
    pfp: imageOrPlaceholder(),
    credits: 0,
    paymentMethods: [],
  };
}

function mergeSignupExtras(existing: UserProfile, extras?: Partial<UserProfile>): UserProfile {
  if (!extras) return existing;

  const updates: Partial<UserProfile> = {};
  const phone = normalizePhone(extras.phone);
  if (phone && !existing.phone) updates.phone = phone;
  if (extras.name?.trim() && (!existing.name || existing.name === 'Member')) {
    updates.name = extras.name.trim();
  }
  if (extras.profession?.trim() && !existing.profession) {
    updates.profession = extras.profession.trim();
  }

  return Object.keys(updates).length > 0 ? { ...existing, ...updates } : existing;
}

function stripClientWritableProfile(profile: UserProfile): Record<string, unknown> {
  // emailVerified is OTP-server-owned (client rules reject writing true).
  // phoneVerified is only written true after SMS success — never demote via generic saves.
  const {
    emailVerified: _emailVerified,
    phoneVerified: _phoneVerified,
    ...writable
  } = profile;
  return stripUndefined(writable as unknown as Record<string, unknown>);
}

/** Payload safe for users/{uid} create/update under firestore.rules. */
function toFirestoreUserWrite(profile: UserProfile): Record<string, unknown> {
  return {
    ...stripClientWritableProfile(profile),
    emailVerified: false,
  };
}

function resolveProfileEmailVerified(
  profile: UserProfile,
  _firebaseUser: User | null | undefined,
): boolean {
  // App-owned: ignore Auth/Google emailVerified.
  return profile.emailVerified === true;
}

function applyProfile(
  profile: UserProfile,
  firebaseUser?: User | null,
): UserProfile {
  return normalizeUserProfile(
    {
      ...profile,
      emailVerified: resolveProfileEmailVerified(profile, firebaseUser ?? null),
    },
    firebaseUser,
  );
}

function stripUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T;
}

function buildUserProfile(firebaseUser: User, extras?: Partial<UserProfile>): UserProfile {
  return stripUndefined({
    uid: firebaseUser.uid,
    name: extras?.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Member',
    role: 'customer',
    email: firebaseUser.email || extras?.email || '',
    pfp: extras?.pfp || firebaseUser.photoURL || imageOrPlaceholder(),
    phone: normalizePhone(extras?.phone),
    phoneVerified: extras?.phoneVerified ?? false,
    emailVerified: extras?.emailVerified ?? false,
    credits: extras?.credits ?? 0,
    paymentMethods: extras?.paymentMethods ?? [],
    profession: extras?.profession,
    createdAt: extras?.createdAt ?? Date.now(),
    emailNotificationsEnabled: extras?.emailNotificationsEnabled ?? true,
  }) as UserProfile;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [codeSessionRole, setCodeSessionRole] = useState<CodeSessionRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileSyncError, setProfileSyncError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const clearCodeAuth = useCallback(() => {
    clearCodeSession();
    setCodeSessionRole(null);
    if (!auth.currentUser) {
      setUserProfile(null);
    }
  }, []);

  const startCodeSession = useCallback(async (
    role: CodeSessionRole,
    branch?: StoredStaffBranch,
    customToken?: string,
  ) => {
    clearAuthError();
    saveCodeSession(role);
    if (branch) {
      saveStaffBranchSession(branch);
    }
    setCodeSessionRole(role);

    if (auth.currentUser && !isCodeAuthUid(auth.currentUser.uid)) {
      await firebaseSignOut(auth);
    }

    if (customToken) {
      const credential = await signInWithCustomToken(auth, customToken);
      const profile = buildStaffProfile(credential.user, role);
      await setDoc(doc(db, 'users', credential.user.uid), stripUndefined(profile as unknown as Record<string, unknown>), { merge: true });
      setUserProfile(profile);
      setProfileSyncError(null);
      return;
    }

    setUserProfile(buildCodeSessionProfile(role));
    setProfileSyncError(null);
  }, [clearAuthError]);

  const signInWithAccessCode = useCallback(async (code: string): Promise<boolean> => {
    clearAuthError();

    try {
      const result = await validateAccessCodeRemote(code);
      if (auth.currentUser && !isCodeAuthUid(auth.currentUser.uid)) {
        await firebaseSignOut(auth);
      }
      saveStaffAccessCode(code);
      if (result.customToken) {
        await startCodeSession(result.role, result.branch, result.customToken);
        return true;
      }
      await startCodeSession(result.role, result.branch);
      return true;
    } catch (error) {
      clearCodeAuth();
      setAuthError(mapAuthError(error));
      console.error('Access code sign-in failed', error);
      return false;
    }
  }, [clearAuthError, clearCodeAuth, startCodeSession]);

  const ensureUserProfile = useCallback(async (
    firebaseUser: User,
    extras?: Partial<UserProfile>
  ): Promise<UserProfile> => {
    const storedSession = loadCodeSession();
    if (
      storedSession &&
      (storedSession.role === 'owner' || storedSession.role === 'employee') &&
      !isCodeAuthUid(firebaseUser.uid)
    ) {
      clearCodeSession();
    } else if (
      storedSession &&
      (storedSession.role === 'owner' || storedSession.role === 'employee') &&
      isCodeAuthUid(firebaseUser.uid)
    ) {
      const profile = buildCodeSessionProfile(storedSession.role);
      const normalized = applyProfile(profile, firebaseUser);
      setUserProfile(normalized);
      setCodeSessionRole(storedSession.role);
      return normalized;
    }

    if (isCodeAuthUid(firebaseUser.uid)) {
      const role = resolveStaffRoleFromUid(firebaseUser.uid) ?? 'employee';
      const profile = buildStaffProfile(firebaseUser, role);
      const normalized = applyProfile(profile, firebaseUser);
      setUserProfile(normalized);
      setCodeSessionRole(role);
      saveCodeSession(role);
      return normalized;
    }

    const docRef = doc(db, 'users', firebaseUser.uid);

    try {
      // Always read from server so a stale local cache cannot hide emailVerified:true.
      const docSnap = await getDocFromServer(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        const rawVerified = data.emailVerified;
        const firestoreRole = data.role;
        const existing = {
          ...data,
          role: (firestoreRole === 'owner' || firestoreRole === 'employee' ? firestoreRole : 'customer') as UserProfile['role'],
          emailVerified: rawVerified === true,
          phoneVerified: data.phoneVerified === true,
        };
        const merged = mergeSignupExtras(existing, extras);
        const profileToUse = applyProfile(merged !== existing ? merged : existing, firebaseUser);
        // Never write emailVerified/phoneVerified from ensureUserProfile — OTP flows own those flags.
        if (merged !== existing) {
          await setDoc(docRef, stripClientWritableProfile(merged), { merge: true });
          setUserProfile(profileToUse);
          setProfileSyncError(null);
          return profileToUse;
        }
        setUserProfile(profileToUse);
        setProfileSyncError(null);
        return profileToUse;
      }

      const profile = applyProfile(buildUserProfile(firebaseUser, extras), firebaseUser);
      await setDoc(docRef, toFirestoreUserWrite(profile));
      void trackSignUp(extras?.phone ? 'email' : firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email');
      setUserProfile(profile);
      setProfileSyncError(null);
      return profile;
    } catch (error) {
      console.error('ensureUserProfile failed', error);
      const fallback = applyProfile(buildUserProfile(firebaseUser, extras), firebaseUser);
      setUserProfile(fallback);
      setProfileSyncError(mapFirestoreError(error));
      return fallback;
    }
  }, []);

  const updateUserProfile = async (profileOrUpdater: UserProfile | ((prev: UserProfile | null) => UserProfile | null)) => {
    const newProfile = typeof profileOrUpdater === 'function'
      ? profileOrUpdater(userProfile)
      : profileOrUpdater;

    if (!newProfile) return;

    // Never demote verified flags in memory once set (OTP / SMS own promotion).
    const emailVerified =
      newProfile.emailVerified === true || userProfile?.emailVerified === true;
    const phoneVerified =
      newProfile.phoneVerified === true || userProfile?.phoneVerified === true;
    const withVerified = { ...newProfile, emailVerified, phoneVerified };
    setUserProfile(applyProfile(withVerified, user));

    if (codeSessionRole || !user) return;

    try {
      const docRef = doc(db, 'users', user.uid);
      // Never write emailVerified/phoneVerified from the client — Cloud Functions own those flags.
      await setDoc(docRef, stripClientWritableProfile(withVerified), { merge: true });
      setProfileSyncError(null);
    } catch (error) {
      console.error('updateUserProfile failed', error);
      setProfileSyncError(mapFirestoreError(error));
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let cancelled = false;

    getRedirectResult(auth)
      .then(async (result) => {
        if (cancelled || !result?.user) return;
        clearCodeAuth();
        await ensureUserProfile(result.user);
      void trackLogin('google');
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Google redirect sign-in failed', error);
          setAuthError(mapAuthError(error));
        }
      });

    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      try {
      setUser(currentUser);
      setMonitoringUserId(currentUser?.uid ?? null);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      const storedSession = loadCodeSession();

      if (currentUser) {
        const token = await currentUser.getIdTokenResult(true);
        let claimRole = token.claims.role as string | undefined;
        if (!claimRole && isCodeAuthUid(currentUser.uid)) {
          claimRole = storedSession?.role ?? resolveStaffRoleFromUid(currentUser.uid) ?? undefined;
        }

        if (claimRole === 'owner' || claimRole === 'employee') {
          const role = claimRole as CodeSessionRole;
          setCodeSessionRole(role);
          saveCodeSession(role);
          const profile = applyProfile(buildStaffProfile(currentUser, role), currentUser);
          setUserProfile(profile);
          setProfileSyncError(null);
          // Staff shift reminders — register quietly; no customer push UI in v1.
          void registerFcmToken(currentUser.uid);
        } else if (
          storedSession &&
          (storedSession.role === 'owner' || storedSession.role === 'employee') &&
          isCodeAuthUid(currentUser.uid)
        ) {
          setCodeSessionRole(storedSession.role);
          setUserProfile(applyProfile(buildCodeSessionProfile(storedSession.role), currentUser));
          setProfileSyncError(null);
          void registerFcmToken(currentUser.uid);
        } else {
          if (
            storedSession &&
            (storedSession.role === 'owner' || storedSession.role === 'employee') &&
            !isCodeAuthUid(currentUser.uid)
          ) {
            clearCodeSession();
          }
          clearCodeSession();
          setCodeSessionRole(null);
          await ensureUserProfile(currentUser);
          void setAnalyticsUserId(currentUser.uid);

          const docRef = doc(db, 'users', currentUser.uid);
          unsubscribeProfile = onSnapshot(
            docRef,
            { includeMetadataChanges: true },
            (docSnap) => {
              if (loadCodeSession()) return;
              if (!docSnap.exists()) return;
              const data = docSnap.data() as UserProfile;
              setUserProfile((prev) => {
                let emailVerified = data.emailVerified === true;
                let phoneVerified = data.phoneVerified === true;
                // Cached snapshots can lag behind OTP/SMS server writes — never demote.
                if (docSnap.metadata.fromCache) {
                  emailVerified = emailVerified || prev?.emailVerified === true;
                  phoneVerified = phoneVerified || prev?.phoneVerified === true;
                }
                return applyProfile(
                  {
                    ...data,
                    role: 'customer',
                    emailVerified,
                    phoneVerified,
                  },
                  currentUser,
                );
              });
              setProfileSyncError(null);
            },
            (error) => {
              console.error('Profile subscription error:', error);
              setProfileSyncError(mapFirestoreError(error));
              setUserProfile((prev) =>
                prev ?? applyProfile(buildUserProfile(currentUser), currentUser),
              );
            }
          );
        }
      } else if (storedSession) {
        setCodeSessionRole(storedSession.role);
        setUserProfile(applyProfile(buildCodeSessionProfile(storedSession.role)));
        setProfileSyncError(null);
      } else {
        setUserProfile(null);
        setCodeSessionRole(null);
        setProfileSyncError(null);
      }
      } catch (error) {
        console.error('Auth state handler failed', error);
        if (currentUser) {
          setUserProfile((prev) =>
            prev ?? applyProfile(buildUserProfile(currentUser), currentUser),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [clearCodeAuth, ensureUserProfile]);

  useEffect(() => {
    if (loading || user || !codeSessionRole) return;
    const code = loadStaffAccessCode();
    if (!code) return;

    void (async () => {
      try {
        const result = await validateAccessCodeRemote(code);
        if (result.customToken) {
          await signInWithCustomToken(auth, result.customToken);
        }
      } catch (error) {
        console.warn('Staff Firebase session restore failed', error);
      }
    })();
  }, [loading, user, codeSessionRole]);

  const signInWithGoogle = async () => {
    clearAuthError();
    clearCodeAuth();
    const provider = new GoogleAuthProvider();

    if (prefersGoogleRedirectAuth()) {
      await signInWithRedirect(auth, provider);
      return;
    }

    try {
      const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      await ensureUserProfile(result.user);
      void trackLogin('google');
    } catch (error) {
      if (error instanceof FirebaseError && isPopupAuthError(error)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      const message = mapAuthError(error);
      setAuthError(message);
      console.error('Google login failed', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    clearAuthError();
    clearCodeAuth();
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserProfile(result.user);
      void trackLogin('email');
    } catch (error) {
      const message = mapAuthError(error);
      setAuthError(message);
      console.error('Email login failed', error);
      throw error;
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    details: SignUpDetails
  ) => {
    clearAuthError();
    clearCodeAuth();
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (details.name.trim()) {
        await updateProfile(result.user, { displayName: details.name.trim() });
      }
      await ensureUserProfile(result.user, {
        name: details.name.trim() || email.split('@')[0],
        phone: normalizePhone(details.phone),
        emailVerified: false,
      });
    } catch (error) {
      const message = mapAuthError(error);
      setAuthError(message);
      console.error('Email sign-up failed', error);
      throw error;
    }
  };

  const signInWithOwnerPasscode = async (code: string): Promise<boolean> => {
    return signInWithAccessCode(code);
  };

  const enterStaffSession = async (branch?: StoredStaffBranch) => {
    if (branch) {
      saveStaffBranchSession(branch);
    }
    if (!auth.currentUser?.uid.startsWith('code-')) {
      await startCodeSession('employee', branch);
    }
  };

  const signIn = async () => {
    await signInWithGoogle();
  };

  const signOut = async () => {
    clearAuthError();
    setProfileSyncError(null);
    await unregisterFcmToken();
    void setAnalyticsUserId(null);
    clearCodeAuth();
    setUserProfile(null);
    setCodeSessionRole(null);
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      throw new Error('Sign in with an email and password account to change your password.');
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await firebaseUpdatePassword(currentUser, newPassword);
    } catch (error) {
      throw new Error(mapAuthError(error));
    }
  };

  const isAuthenticated = !!user || !!codeSessionRole;

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        codeSessionRole,
        loading,
        isAuthenticated,
        isCodeSession: !!codeSessionRole,
        authError,
        profileSyncError,
        clearAuthError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signIn,
        signInWithOwnerPasscode,
        signInWithAccessCode,
        enterStaffSession,
        signOut,
        updateUserProfile,
        updatePassword,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
