import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { recaptchaSecretKeySecret } from './secrets';

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

interface SiteVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export const verifyRecaptcha = onCall(
  { cors: true, secrets: [recaptchaSecretKeySecret] },
  async (request) => {
    const token = typeof request.data?.token === 'string' ? request.data.token.trim() : '';
    if (!token) {
      throw new HttpsError('invalid-argument', 'reCAPTCHA verification is required.');
    }

    const secret = recaptchaSecretKeySecret.value()?.trim();
    if (!secret) {
      throw new HttpsError('failed-precondition', 'reCAPTCHA is not configured on the server.');
    }

    const body = new URLSearchParams({ secret, response: token });
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new HttpsError('internal', 'reCAPTCHA verification failed. Please try again.');
    }

    const result = (await response.json()) as SiteVerifyResponse;
    if (!result.success) {
      throw new HttpsError('permission-denied', 'reCAPTCHA verification failed. Please try again.');
    }

    return { success: true };
  },
);
