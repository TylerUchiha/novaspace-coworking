#!/usr/bin/env node
/**
 * Delete and re-register Firebase Hosting custom domains to force fresh DNS verification.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_ID = 'refined-legend-420223';
const SITE_ID = 'refined-legend-420223';
const DOMAINS = ['www.novaspace.work', 'novaspace.work'];

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
    } catch {}
  }
  throw new Error('Run firebase login first');
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
  const json = await response.json();
  return json.access_token;
}

async function waitForOperation(accessToken, operationName, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/${operationName}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const op = await response.json();
    if (op.done) {
      if (op.error) throw new Error(JSON.stringify(op.error));
      return op.response ?? op;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Operation timed out: ${operationName}`);
}

async function deleteDomain(accessToken, domain) {
  const name = `projects/${PROJECT_ID}/sites/${SITE_ID}/customDomains/${domain}`;
  const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/${name}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) {
    console.log(`Already absent: ${domain}`);
    return;
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`Delete ${domain} failed (${response.status}): ${text}`);
  const op = JSON.parse(text);
  if (op.name) await waitForOperation(accessToken, op.name);
  console.log(`Deleted: ${domain}`);
}

async function createDomain(accessToken, domain) {
  const url = `https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${SITE_ID}/customDomains?customDomainId=${encodeURIComponent(domain)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Create ${domain} failed (${response.status}): ${text}`);
  const op = JSON.parse(text);
  await waitForOperation(accessToken, op.name);
  console.log(`Created: ${domain}`);
}

function printStatus(domain, detail) {
  console.log(`\n=== ${domain} ===`);
  console.log(`host=${detail.hostState} ownership=${detail.ownershipState} cert=${detail.cert?.state}`);
  for (const group of detail.requiredDnsUpdates?.desired ?? []) {
    for (const record of group.records ?? []) {
      if (record.requiredAction === 'ADD' || !record.requiredAction) {
        console.log(`  ADD ${record.type} | ${record.domainName} | ${record.rdata}`);
      }
    }
  }
  for (const group of detail.cert?.verification?.dns?.desired ?? []) {
    for (const record of group.records ?? []) {
      console.log(`  ADD ${record.type} | ${record.domainName} | ${record.rdata} (SSL)`);
    }
  }
}

const token = await getAccessToken(loadRefreshToken());

console.log('Resetting custom domains...');
for (const domain of DOMAINS) await deleteDomain(token, domain);
await new Promise((resolve) => setTimeout(resolve, 5000));
for (const domain of [...DOMAINS].reverse()) await createDomain(token, domain);

console.log('\nFresh verification state:');
for (const domain of DOMAINS) {
  const name = `projects/${PROJECT_ID}/sites/${SITE_ID}/customDomains/${domain}`;
  const detail = await (
    await fetch(`https://firebasehosting.googleapis.com/v1beta1/${name}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  printStatus(domain, detail);
}
