const CONSENT_KEY = 'novaspace_analytics_consent';

export type AnalyticsConsent = 'accepted' | 'rejected' | null;

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(CONSENT_KEY);
  if (value === 'accepted' || value === 'rejected') return value;
  return null;
}

export function setAnalyticsConsent(value: 'accepted' | 'rejected'): void {
  localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent('novaspace:consent-changed', { detail: value }));
}

export function hasAnalyticsConsent(): boolean {
  return getAnalyticsConsent() === 'accepted';
}
