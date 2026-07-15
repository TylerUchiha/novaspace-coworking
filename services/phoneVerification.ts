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
/** Bumped on destroy so in-flight render() results are discarded. */
let recaptchaGeneration = 0;

/** Client-side cooldown after Firebase auth/too-many-requests (persisted). */
const RATE_LIMIT_STORAGE_PREFIX = 'novaspace_phone_rate_limit:';
/**
 * UI cooldown after a real Firebase rate-limit hit.
 * Firebase project/IP/phone lockouts are often ~1 hour (sometimes longer) and
 * cannot be cleared from the app — this only stops users from extending them.
 */
export const PHONE_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;
export const PHONE_RATE_LIMIT_COOLDOWN_SECONDS = PHONE_RATE_LIMIT_COOLDOWN_MS / 1000;

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

function rateLimitStorageKey(phoneE164: string): string {
  const digits = normalizePhoneDigits(phoneE164);
  const uid = auth.currentUser?.uid ?? 'anon';
  return `${RATE_LIMIT_STORAGE_PREFIX}${uid}:${digits}`;
}

/** Seconds remaining on the local post-rate-limit cooldown (0 if clear). */
export function getPhoneRateLimitRemainingSeconds(phoneE164: string): number {
  if (typeof window === 'undefined' || !phoneE164) return 0;
  try {
    const raw = localStorage.getItem(rateLimitStorageKey(phoneE164));
    if (!raw) return 0;
    const until = Number(raw);
    if (!Number.isFinite(until)) return 0;
    const remainingMs = until - Date.now();
    if (remainingMs <= 0) {
      localStorage.removeItem(rateLimitStorageKey(phoneE164));
      return 0;
    }
    return Math.ceil(remainingMs / 1000);
  } catch {
    return 0;
  }
}

export function recordPhoneRateLimitHit(phoneE164: string): void {
  if (typeof window === 'undefined' || !phoneE164) return;
  try {
    const until = Date.now() + PHONE_RATE_LIMIT_COOLDOWN_MS;
    localStorage.setItem(rateLimitStorageKey(phoneE164), String(until));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function clearPhoneRateLimit(phoneE164: string): void {
  if (typeof window === 'undefined' || !phoneE164) return;
  try {
    localStorage.removeItem(rateLimitStorageKey(phoneE164));
  } catch {
    // Ignore.
  }
}

/** Wipe every persisted phone rate-limit key (all users/phones in this browser). */
export function clearAllPhoneRateLimits(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(RATE_LIMIT_STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore.
  }
}

/** Block Send locally after a real Firebase rate-limit so retries do not extend the lockout. */
function assertClientRateLimitAllowsSend(phoneE164: string): void {
  const remaining = getPhoneRateLimitRemainingSeconds(phoneE164);
  if (remaining > 0) {
    throw new FirebaseError(
      'auth/too-many-requests',
      `Client cooldown active (${remaining}s remaining). Firebase lockout may still be in effect.`,
    );
  }
}

function formatRateLimitWaitHint(remainingSeconds?: number): string {
  if (remainingSeconds && remainingSeconds > 0) {
    const mins = Math.max(1, Math.ceil(remainingSeconds / 60));
    return `Wait about ${mins} minute${mins === 1 ? '' : 's'} (Firebase lockouts are often ~1 hour). `;
  }
  return 'Wait about 1 hour without retrying — Firebase owns this lockout and the app cannot clear it. ';
}

function formatFirebaseErrorDetail(error: FirebaseError): string {
  const parts = [error.code];
  if (error.message?.trim()) parts.push(error.message.trim());
  return parts.join(' — ');
}

export function mapPhoneAuthError(error: unknown, phoneE164?: string): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('recaptcha has already been rendered')) {
      return 'Security check needs a refresh. Reload the page and try again. (reCAPTCHA already rendered)';
    }
  }

  if (error instanceof FirebaseError) {
    const detail = formatFirebaseErrorDetail(error);
    switch (error.code) {
      case 'auth/invalid-app-credential':
      case 'auth/invalid-app-credentials':
        if (isLocalhostPhoneAuthBlocked()) {
          return `Phone SMS does not work on localhost (${detail}). Use http://127.0.0.1 instead.`;
        }
        return `Security verification failed (${detail}). Refresh and try again. Confirm Phone auth + App Check/reCAPTCHA in Firebase Console.`;
      case 'auth/invalid-phone-number':
        return `Invalid phone number (${detail}). Use international format, e.g. +201211884876.`;
      case 'auth/missing-phone-number':
        return `Please enter a phone number. (${detail})`;
      case 'auth/invalid-verification-code':
        return `Incorrect verification code. (${detail})`;
      case 'auth/code-expired':
        return `Verification code expired. (${detail})`;
      case 'auth/too-many-requests': {
        const remaining = phoneE164
          ? getPhoneRateLimitRemainingSeconds(phoneE164)
          : undefined;
        return `Too many verification attempts (${detail}). ${formatRateLimitWaitHint(remaining)}Do not keep tapping Send — each attempt can extend the lockout. Use a different phone number, or a Firebase Console test number, if you need to verify sooner.`;
      }
      case 'auth/credential-already-in-use':
        return `This phone number is already linked to another account. (${detail})`;
      case 'auth/provider-already-linked':
        return `Use the new number below, then send a fresh verification code. (${detail})`;
      case 'auth/requires-recent-login':
        return `Sign out and sign back in, then verify your phone. (${detail})`;
      case 'auth/session-expired':
      case 'auth/invalid-verification-id':
        return `Verification session expired (${detail}). Send a new code.`;
      case 'auth/account-exists-with-different-credential':
        return `This phone number is already linked to another account. (${detail})`;
      case 'auth/captcha-check-failed':
        return `Security check failed (${detail}). Refresh the page and try again.`;
      case 'auth/quota-exceeded':
        return `SMS quota exceeded (${detail}). Check Firebase Blaze billing / SMS quota.`;
      case 'auth/operation-not-allowed':
        return `Phone sign-in is not enabled (${detail}). Enable Phone in Firebase Console → Authentication.`;
      default:
        return `Phone verification failed (${detail}).`;
    }
  }
  if (error instanceof Error) {
    return `Phone verification failed: ${error.message}`;
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
  recaptchaGeneration += 1;
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

  const generationAtStart = recaptchaGeneration;

  recaptchaRenderPromise = (async () => {
    if (!recaptchaContainer) {
      // Visible enough for Enterprise→v2 fallback challenges. Do not use
      // 1×1px, overflow:hidden, or aria-hidden — those break the v2 widget.
      recaptchaContainer = document.createElement('div');
      recaptchaContainer.id = `phone-recaptcha-${Date.now()}`;
      recaptchaContainer.style.position = 'fixed';
      recaptchaContainer.style.bottom = '16px';
      recaptchaContainer.style.right = '16px';
      recaptchaContainer.style.zIndex = '2147483646';
      document.body.appendChild(recaptchaContainer);
    }

    // Invisible size; container must not be clipped so v2 challenge fallback can render.
    const verifier = new RecaptchaVerifier(auth, recaptchaContainer, {
      size: 'invisible',
    });
    await verifier.render();

    if (generationAtStart !== recaptchaGeneration) {
      try {
        verifier.clear();
      } catch {
        // Stale widget after destroy — ignore.
      }
      throw new FirebaseError('auth/captcha-check-failed', 'reCAPTCHA was reset during render');
    }

    recaptchaVerifier = verifier;
    return verifier;
  })();

  try {
    return await recaptchaRenderPromise;
  } catch (error) {
    if (generationAtStart === recaptchaGeneration) {
      destroyRecaptcha();
    }
    throw error;
  } finally {
    if (recaptchaRenderPromise) {
      recaptchaRenderPromise = null;
    }
  }
}

export function isPhoneRateLimitError(error: unknown): boolean {
  return error instanceof FirebaseError && error.code === 'auth/too-many-requests';
}

function isRetryablePhoneAuthError(error: unknown): boolean {
  if (!(error instanceof FirebaseError)) return false;
  // Never auto-retry too-many-requests — that worsens Firebase rate limits.
  return [
    'auth/captcha-check-failed',
    'auth/invalid-app-credential',
    'auth/invalid-app-credentials',
  ].includes(error.code);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Recreate invisible reCAPTCHA only when the previous widget is known-bad. */
async function getRecaptchaVerifierAfterReset(): Promise<RecaptchaVerifier> {
  destroyRecaptcha();
  await wait(400);
  return getRecaptchaVerifier();
}

export async function sendPhoneVerificationSms(
  phoneE164: string,
  retryAttempt = 0,
): Promise<PhoneVerificationSession> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to verify a phone number.');
  }

  if (isLocalhostPhoneAuthBlocked() && !auth.settings.appVerificationDisabledForTesting) {
    throw new FirebaseError('auth/invalid-app-credential', 'Phone auth blocked on localhost');
  }

  // After a real Firebase rate-limit, stop further Identity Toolkit calls for the UI cooldown
  // so retries do not extend the project/IP/phone lockout.
  assertClientRateLimitAllowsSend(phoneE164);

  // Reuse an existing verifier when possible — destroy/recreate burns reCAPTCHA quota.
  const verifier =
    retryAttempt > 0 ? await getRecaptchaVerifierAfterReset() : await getRecaptchaVerifier();

  try {
    if (currentUser.phoneNumber) {
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(phoneE164, verifier);
      return { type: 'update', verificationId };
    }

    try {
      const confirmation = await linkWithPhoneNumber(currentUser, phoneE164, verifier);
      return { type: 'link', confirmation };
    } catch (linkError) {
      if (
        linkError instanceof FirebaseError &&
        linkError.code === 'auth/provider-already-linked'
      ) {
        // Same verifier can often continue; only reset if verify fails later via retry path.
        const provider = new PhoneAuthProvider(auth);
        const verificationId = await provider.verifyPhoneNumber(phoneE164, verifier);
        return { type: 'update', verificationId };
      }
      throw linkError;
    }
  } catch (error) {
    if (isPhoneRateLimitError(error)) {
      recordPhoneRateLimitHit(phoneE164);
      destroyRecaptcha();
      throw error;
    }
    if (retryAttempt < 1 && isRetryablePhoneAuthError(error)) {
      destroyRecaptcha();
      await wait(2000);
      return sendPhoneVerificationSms(phoneE164, retryAttempt + 1);
    }
    destroyRecaptcha();
    throw error;
  }
}

export async function sendPasswordResetPhoneSms(phoneE164: string): Promise<ConfirmationResult> {
  if (isLocalhostPhoneAuthBlocked() && !auth.settings.appVerificationDisabledForTesting) {
    throw new FirebaseError('auth/invalid-app-credential', 'Phone auth blocked on localhost');
  }

  assertClientRateLimitAllowsSend(phoneE164);

  const verifier = await getRecaptchaVerifier();
  try {
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (error) {
    if (isPhoneRateLimitError(error)) {
      recordPhoneRateLimitHit(phoneE164);
    }
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
