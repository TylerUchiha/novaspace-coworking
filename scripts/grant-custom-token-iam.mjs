/**
 * Grant the Cloud Functions runtime service account permission to sign custom auth tokens.
 *
 * Usage: node scripts/grant-custom-token-iam.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const projectId = 'refined-legend-420223';
const projectNumber = '1098807214267';
const serviceAccountEmail = `${projectNumber}-compute@developer.gserviceaccount.com`;
const member = `serviceAccount:${serviceAccountEmail}`;
const role = 'roles/iam.serviceAccountTokenCreator';

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

const resource = `projects/${projectId}/serviceAccounts/${serviceAccountEmail}`;
const policyUrl = `https://iam.googleapis.com/v1/${resource}:getIamPolicy`;

const getRes = await fetch(policyUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
});
const policy = await getRes.json();
if (!getRes.ok) {
  console.error('Failed to read IAM policy:', policy);
  process.exit(1);
}

const bindings = policy.bindings ?? [];
const existing = bindings.find((binding) => binding.role === role);
if (existing?.members?.includes(member)) {
  console.log('Token creator role already granted for', serviceAccountEmail);
  process.exit(0);
}

if (existing) {
  existing.members = [...new Set([...(existing.members ?? []), member])];
} else {
  bindings.push({ role, members: [member] });
}

const setRes = await fetch(`https://iam.googleapis.com/v1/${resource}:setIamPolicy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ policy: { ...policy, bindings } }),
  },
);

const setBody = await setRes.json();
if (!setRes.ok) {
  console.error('Failed to set IAM policy:', setBody);
  process.exit(1);
}

console.log('Granted', role, 'to', serviceAccountEmail);
console.log('Redeploy is not required — retry Global Access login.');
