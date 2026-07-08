import { defineSecret } from 'firebase-functions/params';

/** Gemini API key — create with: firebase functions:secrets:set GEMINI_API_KEY */
export const geminiApiKeySecret = defineSecret('GEMINI_API_KEY');

/** Owner master passcode — create with: firebase functions:secrets:set OWNER_PASSCODE */
export const ownerPasscodeSecret = defineSecret('OWNER_PASSCODE');

/** reCAPTCHA v2 secret key — create with: firebase functions:secrets:set RECAPTCHA_SECRET_KEY */
export const recaptchaSecretKeySecret = defineSecret('RECAPTCHA_SECRET_KEY');
