import { getAnalytics, isSupported, logEvent, setUserId, Analytics } from 'firebase/analytics';
import { app } from './firebase';
import { hasAnalyticsConsent } from '../utils/analyticsConsent';

let analytics: Analytics | null = null;

export async function initAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  if (!hasAnalyticsConsent()) return null;
  if (analytics) return analytics;
  const supported = await isSupported();
  if (!supported) return null;
  analytics = getAnalytics(app);
  return analytics;
}

export async function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  const instance = await initAnalytics();
  if (!instance) return;
  logEvent(instance, name, params);
}

export async function trackSignUp(method: 'email' | 'google'): Promise<void> {
  await trackEvent('sign_up', { method });
}

export async function trackLogin(method: 'email' | 'google' | 'access_code'): Promise<void> {
  await trackEvent('login', { method });
}

export async function trackBookingCreated(params: {
  vendorId: string;
  locationId: string;
  roomCount: number;
  totalPrice: number;
  paymentMethod: string;
}): Promise<void> {
  await trackEvent('booking_created', params);
}

export async function trackTopUpAttempt(amount: number): Promise<void> {
  await trackEvent('top_up_attempt', { amount, currency: 'EGP' });
}

export async function trackTopUpSuccess(amount: number, newBalance: number): Promise<void> {
  await trackEvent('top_up_success', { amount, new_balance: newBalance, currency: 'EGP' });
}

export async function trackFeatureUsed(featureName: string): Promise<void> {
  await trackEvent('feature_used', { feature_name: featureName });
}

export async function setAnalyticsUserId(uid: string | null): Promise<void> {
  const instance = await initAnalytics();
  if (!instance) return;
  setUserId(instance, uid);
}
