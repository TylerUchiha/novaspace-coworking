import {
  sendPasswordResetEmail,
} from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { FirebaseError } from 'firebase/app';
import { auth, app } from './firebase';
import { mapPhoneAuthError } from './phoneVerification';

const functions = getFunctions(app, 'us-central1');

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && typeof window !== 'undefined') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export function mapPasswordResetError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-not-found':
        return 'If an account exists for this email, a reset link has been sent.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      case 'functions/not-found':
        return error.message || 'No account found with this phone number.';
      case 'functions/failed-precondition':
        return error.message || 'This account cannot reset via phone.';
      case 'functions/permission-denied':
        return error.message || 'Phone verification failed.';
      case 'functions/deadline-exceeded':
        return 'Reset session expired. Start again.';
      case 'functions/invalid-argument':
        return error.message || 'Invalid request.';
      case 'functions/unauthenticated':
        return error.message || 'Verify your phone number first.';
      default:
        if (error.code.startsWith('auth/')) {
          return mapPhoneAuthError(error);
        }
        return error.message || 'Password reset failed.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Password reset failed. Please try again.';
}

export async function sendEmailPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function preparePhonePasswordResetRemote(phoneDigits: string): Promise<{ sessionId: string }> {
  const fn = httpsCallable<{ phone: string }, { sessionId: string }>(
    functions,
    'preparePhonePasswordReset',
  );
  const result = await fn({ phone: phoneDigits });
  return result.data;
}

export async function completePhonePasswordResetRemote(
  sessionId: string,
  newPassword: string,
): Promise<void> {
  const fn = httpsCallable<{ sessionId: string; newPassword: string }, { success: boolean }>(
    functions,
    'completePhonePasswordReset',
  );
  await fn({ sessionId, newPassword });
}
