import { getRemoteConfig } from 'firebase-admin/remote-config';

const CACHE_TTL_MS = 60_000;

let cachedAt = 0;
let cachedParams: Record<string, string> = {};

async function refreshRemoteConfigParams(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS && Object.keys(cachedParams).length > 0) {
    return cachedParams;
  }

  const template = await getRemoteConfig().getTemplate();
  const params: Record<string, string> = {};

  for (const [key, param] of Object.entries(template.parameters ?? {})) {
    const defaultValue = param.defaultValue;
    if (defaultValue && 'value' in defaultValue && typeof defaultValue.value === 'string') {
      params[key] = defaultValue.value;
    }
  }

  cachedAt = now;
  cachedParams = params;
  return params;
}

export async function getRemoteConfigBool(key: string, fallback = false): Promise<boolean> {
  const raw = (await getRemoteConfigString(key, '')).toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

export async function getRemoteConfigString(key: string, fallback = ''): Promise<string> {
  try {
    const params = await refreshRemoteConfigParams();
    return params[key]?.trim() || fallback;
  } catch (error) {
    console.warn(`Remote Config read failed for "${key}":`, error);
    return fallback;
  }
}

export const DEFAULT_OWNER_PASSCODE = 'Evelyn';

/** Remote Config overrides Secret Manager when set — allows passcode rotation without redeploy. */
export async function resolveOwnerPasscode(secretValue: string): Promise<string> {
  const remotePasscode = await getRemoteConfigString('owner_passcode', '');
  return remotePasscode || secretValue.trim() || DEFAULT_OWNER_PASSCODE;
}

export function ownerPasscodesMatch(input: string, expected: string): boolean {
  const normalizedInput = input.trim();
  const normalizedExpected = expected.trim();
  if (!normalizedInput || !normalizedExpected) return false;
  if (normalizedInput === normalizedExpected) return true;
  if (normalizedInput.toLowerCase() === normalizedExpected.toLowerCase()) return true;
  return normalizedInput.replace(/\s+/g, '') === normalizedExpected.replace(/\s+/g, '');
}
