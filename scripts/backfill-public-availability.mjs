/**
 * Backfill publicAvailability using deployed Cloud Functions.
 * Uses validateAccessCode (owner) + backfillPublicAvailability callable.
 *
 * Usage: node scripts/backfill-public-availability.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const projectId = 'refined-legend-420223';
const apiKey = 'AIzaSyCRzC0nSmZY-Y7mBZbdsVVT4Q-vEKf4GaQ';
const region = 'us-central1';
const ownerPasscode = process.env.OWNER_PASSCODE || 'Global Access';

async function callCallable(name, data, idToken) {
  const url = `https://${region}-${projectId}.cloudfunctions.net/${name}`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${name} failed (${res.status}): ${JSON.stringify(body)}`);
  }
  if (body.error) {
    throw new Error(`${name} error: ${JSON.stringify(body.error)}`);
  }
  return body.result;
}

async function signInWithCustomToken(customToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`signInWithCustomToken failed: ${JSON.stringify(body)}`);
  }
  return body.idToken;
}

console.log('Validating owner access code...');
const access = await callCallable('validateAccessCode', { code: ownerPasscode });
if (!access?.customToken) {
  throw new Error(
    'No custom token returned. Set OWNER_PASSCODE env var to your configured owner passcode.',
  );
}

console.log('Signing in as owner...');
const idToken = await signInWithCustomToken(access.customToken);

console.log('Running backfillPublicAvailability...');
const result = await callCallable('backfillPublicAvailability', {}, idToken);
console.log('Backfill complete:', result);
