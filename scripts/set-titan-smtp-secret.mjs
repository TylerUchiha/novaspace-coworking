#!/usr/bin/env node
/**
 * Updates the Firestore Send Email extension SMTP secret (GoDaddy Titan).
 *
 * Usage:
 *   $env:TITAN_SMTP_PASSWORD = 'your-mailbox-password'
 *   node scripts/set-titan-smtp-secret.mjs
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_NUMBER = '1098807214267';
const EXTENSION_SECRET = 'firestore-send-email-SMTP_PASSWORD';

const password = process.env.TITAN_SMTP_PASSWORD?.trim();
if (!password) {
  console.error('Set TITAN_SMTP_PASSWORD to your support@novaspace.work mailbox password.');
  process.exit(1);
}

function loadRefreshToken() {
  const candidates = [
    join(homedir(), '.config', 'configstore', 'firebase-tools.json'),
    join(homedir(), 'AppData', 'Roaming', 'configstore', 'firebase-tools.json'),
  ];
  for (const path of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8'));
      const tokens = parsed?.tokens ?? parsed?.users?.default?.tokens;
      if (tokens?.refresh_token) return tokens.refresh_token;
    } catch {
      // try next
    }
  }
  throw new Error('Run `firebase login` first.');
}

async function getAccessToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`);
  }
  const json = await response.json();
  return json.access_token;
}

const refreshToken = loadRefreshToken();
const accessToken = await getAccessToken(refreshToken);
const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_NUMBER}/secrets/${EXTENSION_SECRET}:addVersion`;
const response = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    payload: { data: Buffer.from(password, 'utf8').toString('base64') },
  }),
});

const json = await response.json();
if (!response.ok) {
  console.error('Secret update failed:', json);
  process.exit(1);
}

console.log(`Updated ${EXTENSION_SECRET}:`, json.name);
