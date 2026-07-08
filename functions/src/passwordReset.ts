import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { db } from './db';

const SESSION_TTL_MS = 15 * 60 * 1000;

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

function phonesMatch(authPhone: string, storedDigits: string): boolean {
  const a = normalizePhoneDigits(authPhone);
  const b = normalizePhoneDigits(storedDigits);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith(b) || b.endsWith(a);
}

async function findUserByPhone(phoneDigits: string) {
  const exact = await db.collection('users').where('phone', '==', phoneDigits).limit(1).get();
  if (!exact.empty) return exact.docs[0];

  const withPlus = await db.collection('users').where('phone', '==', `+${phoneDigits}`).limit(1).get();
  if (!withPlus.empty) return withPlus.docs[0];

  return null;
}

export const preparePhonePasswordReset = onCall({ cors: true }, async (request) => {
  const rawPhone = request.data?.phone;
  if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
    throw new HttpsError('invalid-argument', 'Phone number is required.');
  }

  const phoneDigits = normalizePhoneDigits(rawPhone);
  if (phoneDigits.length < 10) {
    throw new HttpsError('invalid-argument', 'Enter a valid phone number.');
  }

  const userDoc = await findUserByPhone(phoneDigits);
  if (!userDoc) {
    throw new HttpsError(
      'not-found',
      'No account with a saved phone number was found. Try email reset or contact support.',
    );
  }

  const uid = userDoc.id;

  try {
    const authUser = await getAuth().getUser(uid);
    const hasPassword = authUser.providerData.some((provider) => provider.providerId === 'password');
    if (!hasPassword) {
      throw new HttpsError(
        'failed-precondition',
        'This account uses Google sign-in. Use Google to sign in or try email reset.',
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('not-found', 'Account not found.');
  }

  const sessionRef = db.collection('phonePasswordResets').doc();
  await sessionRef.set({
    uid,
    phoneDigits,
    expiresAt: Timestamp.fromMillis(Date.now() + SESSION_TTL_MS),
    createdAt: FieldValue.serverTimestamp(),
  });

  return { sessionId: sessionRef.id };
});

export const completePhonePasswordReset = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Verify your phone number first.');
  }

  const sessionId = request.data?.sessionId;
  const newPassword = request.data?.newPassword;
  if (typeof sessionId !== 'string' || typeof newPassword !== 'string') {
    throw new HttpsError('invalid-argument', 'Session and new password are required.');
  }
  if (newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  const sessionRef = db.collection('phonePasswordResets').doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new HttpsError('not-found', 'Reset session expired. Start again.');
  }

  const session = sessionSnap.data()!;
  const expiresAtMs = session.expiresAt?.toMillis?.() ?? 0;
  if (Date.now() > expiresAtMs) {
    await sessionRef.delete();
    throw new HttpsError('deadline-exceeded', 'Reset session expired. Start again.');
  }

  const authPhone = request.auth.token.phone_number as string | undefined;
  if (!authPhone || !phonesMatch(authPhone, session.phoneDigits as string)) {
    throw new HttpsError('permission-denied', 'Verified phone does not match this reset request.');
  }

  await getAuth().updateUser(session.uid as string, { password: newPassword });
  await sessionRef.delete();

  return { success: true };
});
