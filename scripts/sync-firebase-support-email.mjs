#!/usr/bin/env node
/**
 * Sync Firebase Auth settings for NovaSpace support email + authorized domains.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const PROJECT_ID = 'refined-legend-420223';
const SUPPORT_EMAIL = 'support@novaspace.work';
const EXTRA_DOMAINS = ['novaspace.work', 'www.novaspace.work'];

function loadRefreshToken() {
  const candidates = [
    join(homedir(), '.config', 'configstore', 'firebase-tools.json'),
    join(homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  ];

  for (const path of candidates) {
    try {
      const raw = readFileSync(path, 'utf8');
      const parsed = JSON.parse(raw);
      const tokens = parsed?.tokens ?? parsed?.users?.default?.tokens;
      const refreshToken = tokens?.refresh_token;
      if (refreshToken) return refreshToken;
    } catch {
      // try next path
    }
  }

  throw new Error('Could not find Firebase CLI refresh token. Run `firebase login` first.');
}

async function getAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh access token: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  return json.access_token;
}

async function syncAuthorizedDomains(accessToken) {
  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`;
  const currentResponse = await fetch(configUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!currentResponse.ok) {
    throw new Error(`Failed to load auth config (${currentResponse.status}): ${await currentResponse.text()}`);
  }

  const current = await currentResponse.json();
  const authorizedDomains = [...new Set([...(current.authorizedDomains ?? []), ...EXTRA_DOMAINS])];

  const patchResponse = await fetch(`${configUrl}?updateMask=authorizedDomains`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authorizedDomains }),
  });

  if (!patchResponse.ok) {
    throw new Error(`Failed to update authorized domains (${patchResponse.status}): ${await patchResponse.text()}`);
  }

  console.log('Updated Firebase authorized domains.');
}

function deployAuthProviders() {
  const result = spawnSync('firebase', ['deploy', '--only', 'auth', '--project', PROJECT_ID], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error('firebase deploy --only auth failed');
  }

  console.log(`Deployed Google sign-in support email (${SUPPORT_EMAIL}) via firebase.json.`);
}

try {
  const refreshToken = loadRefreshToken();
  const accessToken = await getAccessToken(refreshToken);
  await syncAuthorizedDomains(accessToken);
  deployAuthProviders();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
