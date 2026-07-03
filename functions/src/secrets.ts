import { defineSecret } from 'firebase-functions/params';

/** Gemini API key — create with: firebase functions:secrets:set GEMINI_API_KEY */
export const geminiApiKeySecret = defineSecret('GEMINI_API_KEY');

/** Owner master passcode — create with: firebase functions:secrets:set OWNER_PASSCODE */
export const ownerPasscodeSecret = defineSecret('OWNER_PASSCODE');
