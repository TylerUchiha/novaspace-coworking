import { getPerformance, trace as createTrace, PerformanceTrace } from 'firebase/performance';
import { app } from './firebase';

let performanceEnabled = false;
let crashlyticsReady = false;

type CrashlyticsModule = {
  getCrashlytics: (firebaseApp: typeof app) => unknown;
  initializeCrashlytics?: (firebaseApp: typeof app) => unknown;
  recordError: (crashlytics: unknown, error: Error) => void;
  log: (crashlytics: unknown, message: string) => void;
  setUserId: (crashlytics: unknown, userId: string) => void;
};

let crashlyticsInstance: unknown = null;
let crashlyticsApi: CrashlyticsModule | null = null;

const enableMonitoring = import.meta.env.PROD || import.meta.env.VITE_ENABLE_MONITORING === 'true';

export async function initFirebaseMonitoring(): Promise<void> {
  if (typeof window === 'undefined' || !enableMonitoring) {
    return;
  }

  try {
    getPerformance(app);
    performanceEnabled = true;
  } catch (error) {
    console.warn('Firebase Performance Monitoring unavailable:', error);
  }

  if (import.meta.env.VITE_ENABLE_CRASHLYTICS === 'false') {
    return;
  }

  try {
    const mod = (await import('@firebase/crashlytics')) as CrashlyticsModule;
    crashlyticsApi = mod;
    crashlyticsInstance =
      typeof mod.initializeCrashlytics === 'function'
        ? mod.initializeCrashlytics(app)
        : mod.getCrashlytics(app);
    crashlyticsReady = true;
  } catch (error) {
    console.warn('Firebase Crashlytics unavailable (install @firebase/crashlytics EAP):', error);
  }

  window.addEventListener('error', (event) => {
    reportError(event.error ?? new Error(event.message));
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportError(reason instanceof Error ? reason : new Error(String(reason)));
  });
}

export function reportError(error: Error, context?: Record<string, string>): void {
  if (context) {
    console.error('[NovaSpace]', context, error);
  } else {
    console.error('[NovaSpace]', error);
  }

  if (crashlyticsReady && crashlyticsApi && crashlyticsInstance) {
    for (const [key, value] of Object.entries(context ?? {})) {
      crashlyticsApi.log(crashlyticsInstance, `${key}=${value}`);
    }
    crashlyticsApi.recordError(crashlyticsInstance, error);
  }
}

export function setMonitoringUserId(userId: string | null): void {
  if (!crashlyticsReady || !crashlyticsApi || !crashlyticsInstance || !userId) {
    return;
  }
  crashlyticsApi.setUserId(crashlyticsInstance, userId);
}

export function startPerformanceTrace(name: string): PerformanceTrace | null {
  if (!performanceEnabled) {
    return null;
  }
  try {
    return createTrace(getPerformance(app), name);
  } catch {
    return null;
  }
}

export async function traceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const perfTrace = startPerformanceTrace(name);
  perfTrace?.start();
  try {
    return await fn();
  } finally {
    perfTrace?.stop();
  }
}
