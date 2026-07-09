import { User } from 'firebase/auth';
import { UserProfile } from '../types';

/** App-owned: only Firestore profile.emailVerified counts (ignore Auth/Google flag). */
export function isEmailVerified(
  profile: UserProfile | null | undefined,
  _firebaseUser?: User | null,
): boolean {
  return profile?.emailVerified === true;
}

/** App-owned: only Firestore profile.phoneVerified counts (ignore Auth phoneNumber match). */
export function isPhoneVerified(
  profile: UserProfile | null | undefined,
  _firebaseUser?: User | null,
): boolean {
  return profile?.phoneVerified === true;
}

export function isContactVerified(
  profile: UserProfile | null | undefined,
  firebaseUser: User | null | undefined,
): boolean {
  return isEmailVerified(profile, firebaseUser) && isPhoneVerified(profile, firebaseUser);
}

export function contactVerificationMessage(
  profile: UserProfile | null | undefined,
  firebaseUser: User | null | undefined,
): string | null {
  const emailOk = isEmailVerified(profile, firebaseUser);
  const phoneOk = isPhoneVerified(profile, firebaseUser);
  if (emailOk && phoneOk) return null;
  const parts: string[] = [];
  if (!emailOk) parts.push('email');
  if (!phoneOk) parts.push('phone');
  return `Verify your ${parts.join(' and ')} before booking.`;
}
