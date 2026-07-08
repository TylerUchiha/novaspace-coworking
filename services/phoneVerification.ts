import {
  ConfirmationResult,
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  signInWithPhoneNumber,
  signOut,
  updatePhoneNumber,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from './firebase';

let recaptchaVerifier: RecaptchaVerifier | null = null;
let recaptchaContainer: HTMLDivElement | null = null;
let recaptchaRenderPromise: Promise<RecaptchaVerifier> | null = null;

/** Enable fictional test numbers from Firebase Console (dev only). */
if (import.meta.env.DEV && import.meta.env.VITE_PHONE_AUTH_TEST_MODE === 'true') {
  auth.settings.appVerificationDisabledForTesting = true;
}

export type PhoneVerificationSession =
  | { type: 'link'; confirmation: ConfirmationResult }
  | { type: 'update'; verificationId: string };

export function normalizePhoneDigits(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

export const DEFAULT_PHONE_COUNTRY_CODE = '20';

export interface PhoneCountryOption {
  code: string;
  label: string;
}

export const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { code: '20', label: 'Egypt' },
  { code: '1', label: 'United States' },
  { code: '44', label: 'United Kingdom' },
  { code: '971', label: 'UAE' },
  { code: '966', label: 'Saudi Arabia' },
  { code: '965', label: 'Kuwait' },
  { code: '974', label: 'Qatar' },
  { code: '973', label: 'Bahrain' },
  { code: '968', label: 'Oman' },
  { code: '962', label: 'Jordan' },
  { code: '961', label: 'Lebanon' },
  { code: '49', label: 'Germany' },
  { code: '33', label: 'France' },
  { code: '39', label: 'Italy' },
  { code: '34', label: 'Spain' },
  { code: '91', label: 'India' },
  { code: '92', label: 'Pakistan' },
  { code: '61', label: 'Australia' },
];

function stripNationalTrunkPrefix(nationalDigits: string): string {
  return nationalDigits.replace(/^0+/, '');
}

/** Split stored digits into country code + local number. Defaults to Egypt (+20). */
export function parsePhoneNumberParts(
  rawDigits: string,
  defaultCountryCode = DEFAULT_PHONE_COUNTRY_CODE
): { countryCode: string; nationalNumber: string } {
  const digits = normalizePhoneDigits(rawDigits);
  if (!digits) {
    return { countryCode: defaultCountryCode, nationalNumber: '' };
  }

  const sorted = [...PHONE_COUNTRY_OPTIONS].sort((a, b) => b.code.length - a.code.length);
  for (const option of sorted) {
    if (digits === option.code) {
      return { countryCode: option.code, nationalNumber: '' };
    }
    if (digits.startsWith(option.code)) {
      const national = stripNationalTrunkPrefix(digits.slice(option.code.length));
      if (national) {
        return { countryCode: option.code, nationalNumber: national };
      }
    }
  }

  return {
    countryCode: defaultCountryCode,
    nationalNumber: stripNationalTrunkPrefix(digits),
  };
}

/** Build E.164 from country code and local number. */
export function buildPhoneE164FromParts(countryCode: string, nationalNumber: string): string {
  const national = stripNationalTrunkPrefix(normalizePhoneDigits(nationalNumber));
  return `+${countryCode}${national}`;
}

/** Full digits without + prefix (e.g. 201211884876). */
export function buildPhoneDigits(countryCode: string, nationalNumber: string): string {
  const national = stripNationalTrunkPrefix(normalizePhoneDigits(nationalNumber));
  if (!national) return '';
  return `${countryCode}${national}`;
}

export function isValidNationalPhoneNumber(nationalNumber: string): boolean {
  const digits = stripNationalTrunkPrefix(normalizePhoneDigits(nationalNumber));
  return digits.length >= 7 && digits.length <= 12;
}

/** Remove trunk prefix 0 after common country codes (e.g. +20 0xxx → +20 xxx). */
function stripTrunkPrefix(digits: string): string {
  return digits
    .replace(/^(20)0(\d{9,})$/, '$1$2')
    .replace(/^(44)0(\d{9,})$/, '$1$2')
    .replace(/^(61)0(\d{9,})$/, '$1$2');
}

/** Format raw input to E.164 (defaults to Egypt +20 when 10 digits). */
export function formatPhoneE164(raw: string, defaultCountryCode = '20'): string {
  const trimmed = raw.trim();
  let digits = normalizePhoneDigits(trimmed);

  if (trimmed.startsWith('+')) {
    digits = stripTrunkPrefix(digits);
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }
  digits = stripTrunkPrefix(digits);
  return `+${digits}`;
}

export function isLocalhostPhoneAuthBlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost';
}

export function mapPhoneAuthError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('recaptcha has already been rendered')) {
      return 'Security check needs a refresh. Reload the page and try again.';
    }
  }

  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-app-credential':
      case 'auth/invalid-app-credentials':
        if (isLocalhostPhoneAuthBlocked()) {
          return 'Phone SMS verification does not work on localhost. Open the app at http://127.0.0.1:3000 instead, or use a Firebase test phone number.';
        }
        return 'Security verification failed. Refresh the page and try again. If this persists, confirm Phone auth and your SMS region are enabled in Firebase Console.';
      case 'auth/invalid-phone-number':
        return 'Invalid phone number. Use international format, e.g. +201211884876 (include country code, no leading 0 after it).';
      case 'auth/missing-phone-number':
        return 'Please enter a phone number.';
      case 'auth/invalid-verification-code':
        return 'Incorrect verification code. Please try again.';
      case 'auth/code-expired':
        return 'Verification code expired.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      case 'auth/credential-already-in-use':
        return 'This phone number is already linked to another account.';
      case 'auth/provider-already-linked':
        return 'A phone number is already linked to this account.';
      case 'auth/captcha-check-failed':
        return 'Security check failed. Refresh the page and try again.';
      case 'auth/quota-exceeded':
        return 'SMS quota exceeded. Try again later or contact support.';
      case 'auth/operation-not-allowed':
        return 'Phone sign-in is not enabled. Enable Phone in Firebase Console → Authentication → Sign-in method, and allow your SMS region.';
      default:
        return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Phone verification failed. Please try again.';
}

function removeRecaptchaContainer(): void {
  if (recaptchaContainer) {
    recaptchaContainer.innerHTML = '';
    recaptchaContainer.remove();
    recaptchaContainer = null;
  }
}

export function destroyRecaptcha(): void {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // Widget may already be cleared.
    }
    recaptchaVerifier = null;
  }
  recaptchaRenderPromise = null;
  removeRecaptchaContainer();
}

export async function getRecaptchaVerifier(): Promise<RecaptchaVerifier> {
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  if (recaptchaRenderPromise) {
    return recaptchaRenderPromise;
  }

  recaptchaRenderPromise = (async () => {
    destroyRecaptcha();

    recaptchaContainer = document.createElement('div');
    recaptchaContainer.id = `phone-recaptcha-${Date.now()}`;
    recaptchaContainer.setAttribute('aria-hidden', 'true');
    recaptchaContainer.style.position = 'fixed';
    recaptchaContainer.style.bottom = '0';
    recaptchaContainer.style.right = '0';
    recaptchaContainer.style.width = '1px';
    recaptchaContainer.style.height = '1px';
    recaptchaContainer.style.overflow = 'hidden';
    document.body.appendChild(recaptchaContainer);

    const verifier = new RecaptchaVerifier(auth, recaptchaContainer, {
      size: 'invisible',
    });
    await verifier.render();
    recaptchaVerifier = verifier;
    return verifier;
  })();

  try {
    return await recaptchaRenderPromise;
  } catch (error) {
    destroyRecaptcha();
    throw error;
  } finally {
    recaptchaRenderPromise = null;
  }
}

export async function sendPhoneVerificationSms(phoneE164: string): Promise<PhoneVerificationSession> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to verify a phone number.');
  }

  if (isLocalhostPhoneAuthBlocked() && !auth.settings.appVerificationDisabledForTesting) {
    throw new FirebaseError('auth/invalid-app-credential', 'Phone auth blocked on localhost');
  }

  const verifier = await getRecaptchaVerifier();

  try {
    if (currentUser.phoneNumber) {
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(phoneE164, verifier);
      return { type: 'update', verificationId };
    }

    const confirmation = await linkWithPhoneNumber(currentUser, phoneE164, verifier);
    return { type: 'link', confirmation };
  } catch (error) {
    destroyRecaptcha();
    throw error;
  }
}

export async function sendPasswordResetPhoneSms(phoneE164: string): Promise<ConfirmationResult> {
  if (isLocalhostPhoneAuthBlocked() && !auth.settings.appVerificationDisabledForTesting) {
    throw new FirebaseError('auth/invalid-app-credential', 'Phone auth blocked on localhost');
  }

  const verifier = await getRecaptchaVerifier();
  try {
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (error) {
    destroyRecaptcha();
    throw error;
  }
}

export async function confirmPasswordResetPhoneCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<void> {
  await confirmation.confirm(code.replace(/\D/g, ''));
}

export async function signOutAfterPasswordReset(): Promise<void> {
  destroyRecaptcha();
  if (auth.currentUser) {
    await signOut(auth);
  }
}

export async function confirmPhoneVerificationCode(
  session: PhoneVerificationSession,
  code: string
): Promise<string> {
  const trimmedCode = code.replace(/\D/g, '');
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to verify a phone number.');
  }

  if (session.type === 'link') {
    const credential = await session.confirmation.confirm(trimmedCode);
    destroyRecaptcha();
    return credential.user.phoneNumber ?? '';
  }

  const phoneCredential = PhoneAuthProvider.credential(session.verificationId, trimmedCode);
  await updatePhoneNumber(currentUser, phoneCredential);
  destroyRecaptcha();
  return auth.currentUser?.phoneNumber ?? '';
}
