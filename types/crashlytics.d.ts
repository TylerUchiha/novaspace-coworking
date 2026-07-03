declare module '@firebase/crashlytics' {
  import type { FirebaseApp } from 'firebase/app';

  export function getCrashlytics(app: FirebaseApp): unknown;
  export function initializeCrashlytics(app: FirebaseApp): unknown;
  export function recordError(crashlytics: unknown, error: Error): void;
  export function log(crashlytics: unknown, message: string): void;
  export function setUserId(crashlytics: unknown, userId: string): void;
}
