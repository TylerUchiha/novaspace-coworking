import { createHash, randomInt } from 'crypto';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { db } from './db';
import {
  whatsappPhoneNumberIdSecret,
  whatsappTemplateLangParam,
  whatsappTemplateNameParam,
  whatsappTokenSecret,
} from './secrets';

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const GRAPH_VERSION = 'v21.0';

function generateVerificationCode(): string {
  return randomInt(100000, 1000000).toString();
}

function hashVerificationCode(uid: string, code: string): string {
  return createHash('sha256').update(`${uid}:${code}`).digest('hex');
}

function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

function toE164(digits: string): string {
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function verificationRef(uid: string) {
  return db.collection('phoneVerifications').doc(uid);
}

function requireAuthUid(request: CallableRequest): string {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const uid = request.auth.uid;
  if (uid.startsWith('code-')) {
    throw new HttpsError('permission-denied', 'Staff code sessions cannot verify phone this way.');
  }
  return uid;
}

function requireWhatsAppConfig(): {
  token: string;
  phoneNumberId: string;
  templateName: string;
  templateLang: string;
} {
  const token = whatsappTokenSecret.value()?.trim();
  const phoneNumberId = whatsappPhoneNumberIdSecret.value()?.trim();
  const templateName = whatsappTemplateNameParam.value()?.trim() || 'novaspace_phone_otp';
  const templateLang = whatsappTemplateLangParam.value()?.trim() || 'en_US';

  if (!token || !phoneNumberId || token.startsWith('REPLACE_')) {
    throw new HttpsError(
      'failed-precondition',
      'WhatsApp is not configured yet. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID (see docs/WHATSAPP_SETUP.md).',
    );
  }

  return { token, phoneNumberId, templateName, templateLang };
}

async function sendWhatsAppTemplateOtp(
  toDigits: string,
  code: string,
  config: ReturnType<typeof requireWhatsAppConfig>,
): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneNumberId}/messages`;

  const body = {
    messaging_product: 'whatsapp',
    to: toDigits,
    type: 'template',
    template: {
      name: config.templateName,
      language: { code: config.templateLang },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: code }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code }],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; error_data?: { details?: string } };
  };

  if (!res.ok) {
    const detail =
      payload.error?.error_data?.details ||
      payload.error?.message ||
      `WhatsApp API HTTP ${res.status}`;
    logger.error('WhatsApp OTP send failed', { status: res.status, detail, code: payload.error?.code });
    throw new HttpsError('unavailable', `Could not send WhatsApp code: ${detail}`);
  }
}

async function handleSend(request: CallableRequest) {
  const uid = requireAuthUid(request);

  const rawPhone = request.data?.phoneDigits;
  if (typeof rawPhone !== 'string' || !rawPhone.trim()) {
    throw new HttpsError('invalid-argument', 'phoneDigits is required.');
  }

  const phoneDigits = normalizePhoneDigits(rawPhone);
  if (phoneDigits.length < 8 || phoneDigits.length > 15) {
    throw new HttpsError('invalid-argument', 'Enter a valid phone number with country code.');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists && userSnap.data()?.phoneVerified === true) {
    const existingPhone = normalizePhoneDigits(userSnap.data()?.phone as string | undefined);
    if (existingPhone && existingPhone === phoneDigits) {
      return { success: true, alreadyVerified: true, phone: phoneDigits };
    }
  }

  const config = requireWhatsAppConfig();
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
    phone: phoneDigits,
    codeHash: hashVerificationCode(uid, code),
    expiresAt,
    attempts: 0,
    lastSentAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    channel: 'whatsapp',
  });

  try {
    await sendWhatsAppTemplateOtp(phoneDigits, code, config);
  } catch (err) {
    await ref.delete().catch(() => undefined);
    throw err;
  }

  return {
    success: true,
    phone: phoneDigits,
    channel: 'whatsapp' as const,
    expiresInSeconds: CODE_TTL_MS / 1000,
  };
}

async function handleVerify(request: CallableRequest) {
  const uid = requireAuthUid(request);

  const rawCode = request.data?.code;
  if (typeof rawCode !== 'string') {
    throw new HttpsError('invalid-argument', 'Verification code is required.');
  }

  const code = rawCode.replace(/\D/g, '');
  if (code.length !== 6) {
    throw new HttpsError('invalid-argument', 'Enter the 6-digit verification code.');
  }

  const rawPhone = request.data?.phoneDigits;
  const submittedDigits = typeof rawPhone === 'string' ? normalizePhoneDigits(rawPhone) : '';

  const ref = verificationRef(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'No verification code found. Request a new one on WhatsApp.');
  }

  const data = snap.data()!;
  const storedPhone = normalizePhoneDigits(data.phone as string | undefined);
  if (submittedDigits && storedPhone && submittedDigits !== storedPhone) {
    throw new HttpsError(
      'failed-precondition',
      'Phone number does not match the one this code was sent to. Request a new code.',
    );
  }

  const phoneDigits = storedPhone || submittedDigits;
  if (!phoneDigits) {
    throw new HttpsError('failed-precondition', 'Phone number missing. Request a new code.');
  }

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

  if (hashVerificationCode(uid, code) !== (data.codeHash as string)) {
    await ref.update({ attempts: attempts + 1 });
    throw new HttpsError('invalid-argument', 'Incorrect verification code.');
  }

  const e164 = toE164(phoneDigits);
  try {
    await getAuth().updateUser(uid, { phoneNumber: e164 });
  } catch (err) {
    logger.warn('Auth phoneNumber update skipped', { uid, err });
  }

  await db.collection('users').doc(uid).set(
    {
      phone: phoneDigits,
      phoneVerified: true,
    },
    { merge: true },
  );
  await ref.delete();

  return {
    success: true,
    phone: phoneDigits,
    phoneE164: e164,
    phoneVerified: true as const,
  };
}

/**
 * Single Cloud Run service for send + verify (avoids extra CPU quota for a second function).
 * - Send: { phoneDigits }
 * - Verify: { action: 'verify', code, phoneDigits }
 */
export const sendWhatsAppVerificationCode = onCall(
  {
    cors: true,
    secrets: [whatsappTokenSecret, whatsappPhoneNumberIdSecret],
    memory: '256MiB',
  },
  async (request) => {
    if (request.data?.action === 'verify' || typeof request.data?.code === 'string') {
      return handleVerify(request);
    }
    return handleSend(request);
  },
);
