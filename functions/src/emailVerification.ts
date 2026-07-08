import { createHash, randomInt } from 'crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { db } from './db';
import { MAIL_FROM, SUPPORT_EMAIL } from './contact';

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateVerificationCode(): string {
  return randomInt(100000, 1000000).toString();
}

function hashVerificationCode(uid: string, code: string): string {
  return createHash('sha256').update(`${uid}:${code}`).digest('hex');
}

function verificationRef(uid: string) {
  return db.collection('emailVerifications').doc(uid);
}

async function queueVerificationEmail(email: string, code: string): Promise<void> {
  await db.collection('mail').add({
    to: email,
    from: MAIL_FROM,
    replyTo: SUPPORT_EMAIL,
    message: {
      subject: 'Your NovaSpace verification code',
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">Verify your email</h2>
          <p style="color: #475569; line-height: 1.6;">Enter this code in NovaSpace to verify your email address:</p>
          <p style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2563eb; margin: 24px 0;">${code}</p>
          <p style="color: #94a3b8; font-size: 14px;">This code expires in 15 minutes. If you did not request this, you can ignore this email.</p>
        </div>
      `,
      text: `Your NovaSpace verification code is ${code}. It expires in 15 minutes.`,
    },
  });
}

export const sendEmailVerificationCode = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const uid = request.auth.uid;
  const email = request.auth.token.email;
  if (!email || typeof email !== 'string') {
    throw new HttpsError('failed-precondition', 'Your account does not have an email address.');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists && userSnap.data()?.emailVerified === true) {
    return { success: true, alreadyVerified: true };
  }
  const ref = verificationRef(uid);
  const existing = await ref.get();
  const now = Date.now();

  if (existing.exists) {
    const lastSentAt = existing.data()?.lastSentAt?.toMillis?.() ?? 0;
    if (now - lastSentAt < RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000);
      throw new HttpsError(
        'resource-exhausted',
        `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
      );
    }
  }

  const code = generateVerificationCode();
  const expiresAt = Timestamp.fromMillis(now + CODE_TTL_MS);

  await ref.set({
    email,
    codeHash: hashVerificationCode(uid, code),
    expiresAt,
    attempts: 0,
    lastSentAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  await queueVerificationEmail(email, code);

  return {
    success: true,
    email,
    expiresInSeconds: CODE_TTL_MS / 1000,
  };
});

export const verifyEmailCode = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const rawCode = request.data?.code;
  if (typeof rawCode !== 'string') {
    throw new HttpsError('invalid-argument', 'Verification code is required.');
  }

  const code = rawCode.replace(/\D/g, '');
  if (code.length !== 6) {
    throw new HttpsError('invalid-argument', 'Enter the 6-digit verification code.');
  }

  const uid = request.auth.uid;
  const ref = verificationRef(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'No verification code found. Request a new one.');
  }

  const data = snap.data()!;
  const expiresAtMs = data.expiresAt?.toMillis?.() ?? 0;
  if (Date.now() > expiresAtMs) {
    await ref.delete();
    throw new HttpsError('deadline-exceeded', 'This code has expired. Request a new one.');
  }

  const attempts = (data.attempts as number) ?? 0;
  if (attempts >= MAX_ATTEMPTS) {
    await ref.delete();
    throw new HttpsError('resource-exhausted', 'Too many failed attempts. Request a new code.');
  }

  const expectedHash = data.codeHash as string;
  const actualHash = hashVerificationCode(uid, code);

  if (actualHash !== expectedHash) {
    await ref.update({ attempts: attempts + 1 });
    throw new HttpsError('invalid-argument', 'Incorrect verification code.');
  }

  await getAuth().updateUser(uid, { emailVerified: true });
  await db.collection('users').doc(uid).set({ emailVerified: true }, { merge: true });
  await ref.delete();

  return { success: true };
});
