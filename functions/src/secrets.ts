import { defineSecret, defineString } from 'firebase-functions/params';

/** Gemini API key — create with: firebase functions:secrets:set GEMINI_API_KEY */
export const geminiApiKeySecret = defineSecret('GEMINI_API_KEY');

/** Owner master passcode — create with: firebase functions:secrets:set OWNER_PASSCODE */
export const ownerPasscodeSecret = defineSecret('OWNER_PASSCODE');

/** reCAPTCHA v2 secret key — create with: firebase functions:secrets:set RECAPTCHA_SECRET_KEY */
export const recaptchaSecretKeySecret = defineSecret('RECAPTCHA_SECRET_KEY');

/** Meta WhatsApp Cloud API permanent token */
export const whatsappTokenSecret = defineSecret('WHATSAPP_TOKEN');

/** Meta WhatsApp Phone Number ID (from API Setup) */
export const whatsappPhoneNumberIdSecret = defineSecret('WHATSAPP_PHONE_NUMBER_ID');

/** Approved Authentication template name */
export const whatsappTemplateNameParam = defineString('WHATSAPP_TEMPLATE_NAME', {
  default: 'novaspace_phone_otp',
});

/** Template language code, e.g. en_US */
export const whatsappTemplateLangParam = defineString('WHATSAPP_TEMPLATE_LANG', {
  default: 'en_US',
});
