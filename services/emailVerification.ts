import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseError } from 'firebase/app';
import { app } from './firebase';

const functions = getFunctions(app, 'us-central1');

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && typeof window !== 'undefined') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export interface SendEmailVerificationResult {
  success: boolean;
  email?: string;
  alreadyVerified?: boolean;
  expiresInSeconds?: number;
}

export interface VerifyEmailCodeResult {
  success: boolean;
}

function mapEmailVerificationError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'functions/unauthenticated':
        return 'You must be signed in to verify your email.';
      case 'functions/invalid-argument':
        return error.message || 'Invalid verification code.';
      case 'functions/not-found':
        return 'No verification code found. Request a new one.';
      case 'functions/deadline-exceeded':
        return 'This code has expired. Request a new one.';
      case 'functions/resource-exhausted':
        return error.message || 'Please wait before trying again.';
      case 'functions/failed-precondition':
        return error.message || 'Could not send verification email.';
      default:
        return error.message || 'Email verification failed.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Email verification failed. Please try again.';
}

export async function sendEmailVerificationCodeRemote(): Promise<SendEmailVerificationResult> {
  const fn = httpsCallable<void, SendEmailVerificationResult>(
    functions,
    'sendEmailVerificationCode',
  );
  const result = await fn();
  return result.data;
}

export async function verifyEmailCodeRemote(code: string): Promise<VerifyEmailCodeResult> {
  const fn = httpsCallable<{ code: string }, VerifyEmailCodeResult>(
    functions,
    'verifyEmailCode',
  );
  const result = await fn({ code });
  return result.data;
}

export { mapEmailVerificationError };
