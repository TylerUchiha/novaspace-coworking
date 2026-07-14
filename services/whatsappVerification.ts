import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseError } from 'firebase/app';
import { app } from './firebase';

const functions = getFunctions(app, 'us-central1');

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && typeof window !== 'undefined') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export interface SendWhatsAppVerificationResult {
  success: boolean;
  phone?: string;
  channel?: 'whatsapp';
  alreadyVerified?: boolean;
  expiresInSeconds?: number;
}

export interface VerifyWhatsAppCodeResult {
  success: boolean;
  phone: string;
  phoneE164?: string;
  phoneVerified: true;
}

export function mapWhatsAppVerificationError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'functions/unauthenticated':
        return 'You must be signed in to verify your phone.';
      case 'functions/invalid-argument':
        return error.message || 'Invalid verification code.';
      case 'functions/not-found':
        return 'No verification code found. Request a new one on WhatsApp.';
      case 'functions/deadline-exceeded':
        return 'This code has expired. Request a new one.';
      case 'functions/resource-exhausted':
        return error.message || 'Please wait before trying again.';
      case 'functions/failed-precondition':
        return error.message || 'WhatsApp verification is not ready yet.';
      case 'functions/unavailable':
        return error.message || 'Could not send WhatsApp message. Try again shortly.';
      case 'functions/permission-denied':
        return error.message || 'You cannot verify phone this way.';
      default:
        return error.message || 'WhatsApp verification failed.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'WhatsApp verification failed. Please try again.';
}

export async function sendWhatsAppVerificationCodeRemote(
  phoneDigits: string,
): Promise<SendWhatsAppVerificationResult> {
  try {
    const fn = httpsCallable<{ phoneDigits: string }, SendWhatsAppVerificationResult>(
      functions,
      'sendWhatsAppVerificationCode',
    );
    const result = await fn({ phoneDigits });
    return result.data;
  } catch (error) {
    throw new Error(mapWhatsAppVerificationError(error));
  }
}

export async function verifyWhatsAppCodeRemote(
  code: string,
  phoneDigits: string,
): Promise<VerifyWhatsAppCodeResult> {
  try {
    const fn = httpsCallable<
      { action: 'verify'; code: string; phoneDigits: string },
      VerifyWhatsAppCodeResult
    >(functions, 'sendWhatsAppVerificationCode');
    const result = await fn({ action: 'verify', code, phoneDigits });
    return result.data;
  } catch (error) {
    throw new Error(mapWhatsAppVerificationError(error));
  }
}
