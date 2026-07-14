/**
 * Create or update Secret Manager secrets for Cloud Functions.
 *
 * Usage:
 *   node scripts/setup-secrets.mjs GEMINI_API_KEY "your-gemini-api-key"
 *   node scripts/setup-secrets.mjs OWNER_PASSCODE "your-owner-passcode"
 *
 * After creating secrets, redeploy functions so defineSecret bindings take effect:
 *   npm run functions:deploy
 *
 * Firebase CLI alternative (recommended — auto-grants runtime access):
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   firebase functions:secrets:set OWNER_PASSCODE
 */

import fs from 'node:fs';
import path from 'node:path';

const secretId = process.argv[2];
const secretValue = process.argv[3];

if (!secretId || !secretValue) {
  console.error('Usage: node scripts/setup-secrets.mjs <SECRET_ID> <value>');
  console.error('Example: node scripts/setup-secrets.mjs OWNER_PASSCODE "Evelyn"');
  process.exit(1);
}

const projectNumber = '1098807214267';
const configPath = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.config',
  'configstore',
  'firebase-tools.json',
);

if (!fs.existsSync(configPath)) {
  console.error('firebase-tools.json not found. Run `firebase login` first.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let accessToken = config.tokens?.access_token;

if (!accessToken || Date.now() > config.tokens.expires_at - 60_000) {
  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: config.tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const refreshData = await refreshRes.json();
  if (!refreshData.access_token) {
    console.error('Failed to refresh access token:', refreshData);
    process.exit(1);
  }
  accessToken = refreshData.access_token;
}

const createUrl = `https://secretmanager.googleapis.com/v1/projects/${projectNumber}/secrets?secretId=${encodeURIComponent(secretId)}`;
const createRes = await fetch(createUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ replication: { automatic: {} } }),
});

if (!createRes.ok && createRes.status !== 409) {
  const body = await createRes.json();
  console.error('Secret create failed:', body);
  process.exit(1);
}

const versionUrl = `https://secretmanager.googleapis.com/v1/projects/${projectNumber}/secrets/${secretId}:addVersion`;
const versionRes = await fetch(versionUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    payload: { data: Buffer.from(secretValue, 'utf8').toString('base64') },
  }),
});

const versionBody = await versionRes.json();
if (!versionRes.ok) {
  console.error('Secret version add failed:', versionBody);
  process.exit(1);
}

console.log(`Secret ${secretId} updated:`, versionBody.name);
console.log('Next: firebase deploy --only functions');
