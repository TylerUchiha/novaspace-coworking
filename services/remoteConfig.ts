import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  RemoteConfig,
} from 'firebase/remote-config';
import { app } from './firebase';

export interface AppRemoteConfigValues {
  featureNovaBotEnabled: boolean;
  featurePhoneAuthEnabled: boolean;
  featureCreditsTopUpEnabled: boolean;
  minTopUpAmount: number;
  defaultCancellationPolicyText: string;
}

export const REMOTE_CONFIG_DEFAULTS: AppRemoteConfigValues = {
  featureNovaBotEnabled: true,
  featurePhoneAuthEnabled: true,
  featureCreditsTopUpEnabled: true,
  minTopUpAmount: 200,
  defaultCancellationPolicyText:
    'Cancellations made more than 24 hours before the booking start time receive a full refund in NovaSpace credits. Cancellations within 24 hours are non-refundable. No-shows forfeit the full booking amount.',
};

let remoteConfigInstance: RemoteConfig | null = null;

function getBool(rc: RemoteConfig, key: string, fallback: boolean): boolean {
  const raw = getValue(rc, key).asString();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

function getNumber(rc: RemoteConfig, key: string, fallback: number): number {
  const parsed = Number(getValue(rc, key).asString());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getString(rc: RemoteConfig, key: string, fallback: string): string {
  const raw = getValue(rc, key).asString();
  return raw.trim() || fallback;
}

export function readRemoteConfigValues(rc: RemoteConfig): AppRemoteConfigValues {
  return {
    featureNovaBotEnabled: getBool(rc, 'feature_nova_bot_enabled', REMOTE_CONFIG_DEFAULTS.featureNovaBotEnabled),
    featurePhoneAuthEnabled: getBool(rc, 'feature_phone_auth_enabled', REMOTE_CONFIG_DEFAULTS.featurePhoneAuthEnabled),
    featureCreditsTopUpEnabled: getBool(
      rc,
      'feature_credits_topup_enabled',
      REMOTE_CONFIG_DEFAULTS.featureCreditsTopUpEnabled,
    ),
    minTopUpAmount: getNumber(rc, 'min_top_up_amount', REMOTE_CONFIG_DEFAULTS.minTopUpAmount),
    defaultCancellationPolicyText: getString(
      rc,
      'default_cancellation_policy_text',
      REMOTE_CONFIG_DEFAULTS.defaultCancellationPolicyText,
    ),
  };
}

export async function initRemoteConfig(): Promise<AppRemoteConfigValues> {
  if (typeof window === 'undefined') {
    return REMOTE_CONFIG_DEFAULTS;
  }

  if (!remoteConfigInstance) {
    remoteConfigInstance = getRemoteConfig(app);
    remoteConfigInstance.settings = {
      minimumFetchIntervalMillis: import.meta.env.DEV ? 0 : 60_000,
      fetchTimeoutMillis: 10_000,
    };
    remoteConfigInstance.defaultConfig = {
      feature_nova_bot_enabled: String(REMOTE_CONFIG_DEFAULTS.featureNovaBotEnabled),
      feature_phone_auth_enabled: String(REMOTE_CONFIG_DEFAULTS.featurePhoneAuthEnabled),
      feature_credits_topup_enabled: String(REMOTE_CONFIG_DEFAULTS.featureCreditsTopUpEnabled),
      min_top_up_amount: String(REMOTE_CONFIG_DEFAULTS.minTopUpAmount),
      default_cancellation_policy_text: REMOTE_CONFIG_DEFAULTS.defaultCancellationPolicyText,
    };
  }

  try {
    await fetchAndActivate(remoteConfigInstance);
  } catch (error) {
    console.warn('Remote Config fetch failed; using defaults.', error);
  }

  return readRemoteConfigValues(remoteConfigInstance);
}
