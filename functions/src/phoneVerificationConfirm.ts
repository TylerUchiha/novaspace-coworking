import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { db } from './db';

function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * After client SMS link/update succeeds, confirm Auth phoneNumber and
 * set Firestore phoneVerified:true (clients cannot forge this flag).
 */
export const confirmPhoneVerified = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const uid = request.auth.uid;
  if (uid.startsWith('code-')) {
    throw new HttpsError('permission-denied', 'Staff code sessions cannot verify phone this way.');
  }

  const raw = request.data?.phoneDigits;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new HttpsError('invalid-argument', 'phoneDigits is required.');
  }
  const submittedDigits = normalizePhoneDigits(raw);
  if (submittedDigits.length < 8 || submittedDigits.length > 15) {
    throw new HttpsError('invalid-argument', 'Invalid phone number.');
  }

  let authPhone = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = await getAuth().getUser(uid);
    authPhone = normalizePhoneDigits(user.phoneNumber);
    if (authPhone) break;
    if (attempt === 0) await sleep(800);
  }

  if (!authPhone) {
    throw new HttpsError(
      'failed-precondition',
      'Phone is not linked on your account yet. Complete SMS verification and try again.',
    );
  }

  if (authPhone !== submittedDigits) {
    throw new HttpsError(
      'failed-precondition',
      'Verified phone does not match the number on your profile.',
    );
  }

  await db.collection('users').doc(uid).set(
    {
      phone: submittedDigits,
      phoneVerified: true,
    },
    { merge: true },
  );

  return { success: true, phone: submittedDigits, phoneVerified: true as const };
});
