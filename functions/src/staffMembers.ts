import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { randomBytes } from 'crypto';
import { db } from './db';
import { assertStaffAuth } from './staffAuth';

interface CreateWalkInMemberInput {
  name?: string;
  email?: string;
  phone?: string;
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  return digits || undefined;
}

function stripUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}

export const createWalkInMember = onCall({ cors: true }, async (request) => {
  await assertStaffAuth(request.auth);

  const data = request.data as CreateWalkInMemberInput;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const phone = normalizePhone(typeof data.phone === 'string' ? data.phone : undefined);

  if (!name || name.length < 2) {
    throw new HttpsError('invalid-argument', 'Enter the member name.');
  }
  if (!email || !email.includes('@')) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  if (!phone || phone.length < 8) {
    throw new HttpsError('invalid-argument', 'Enter a valid phone number.');
  }

  try {
    const existing = await getAuth().getUserByEmail(email);
    if (existing?.uid) {
      const profileSnap = await db.collection('users').doc(existing.uid).get();
      const profile = profileSnap.data();
      return {
        uid: existing.uid,
        profile: stripUndefined({
          uid: existing.uid,
          name: (profile?.name as string) || name,
          email: (profile?.email as string) || email,
          phone: (profile?.phone as string) || phone,
          role: 'customer',
          pfp: (profile?.pfp as string) || `https://picsum.photos/400/400?seed=${existing.uid}`,
          credits: (profile?.credits as number) ?? 0,
          paymentMethods: [],
          profession: (profile?.profession as string) || 'Member',
          emailVerified: profile?.emailVerified === true,
          phoneVerified: profile?.phoneVerified === true,
        }),
        created: false,
      };
    }
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'Could not verify email availability.');
    }
  }

  const tempPassword = randomBytes(12).toString('base64url');
  const authUser = await getAuth().createUser({
    email,
    password: tempPassword,
    displayName: name,
    emailVerified: false,
  });

  const profile = stripUndefined({
    uid: authUser.uid,
    name,
    role: 'customer',
    email,
    phone,
    pfp: `https://picsum.photos/400/400?seed=${authUser.uid}`,
    credits: 0,
    paymentMethods: [],
    profession: 'Member',
    emailVerified: false,
    phoneVerified: false,
    createdAt: Date.now(),
    createdByStaff: request.auth!.uid,
  });

  await db.collection('users').doc(authUser.uid).set(profile, { merge: true });

  return {
    uid: authUser.uid,
    profile,
    created: true,
  };
});
