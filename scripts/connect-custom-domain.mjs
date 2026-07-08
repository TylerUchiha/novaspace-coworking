#!/usr/bin/env node
/**
 * Register novaspace.work (and optionally www) with Firebase Hosting and print DNS records.
 * Uses the Firebase CLI login token from configstore.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_ID = 'refined-legend-420223';
const SITE_ID = 'refined-legend-420223';
const DOMAINS = ['novaspace.work', 'www.novaspace.work'];

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

async function listCustomDomains(accessToken) {
  const url = `https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${SITE_ID}/customDomains`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`List custom domains failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

async function getCustomDomain(accessToken, domain) {
  const name = `projects/${PROJECT_ID}/sites/${SITE_ID}/customDomains/${domain}`;
  const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/${name}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Get custom domain failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

async function createCustomDomain(accessToken, domain) {
  const url = `https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${SITE_ID}/customDomains?customDomainId=${encodeURIComponent(domain)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Create custom domain failed (${response.status}): ${text}`);
  }

  return JSON.parse(text);
}

async function waitForOperation(accessToken, operationName, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/${operationName}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Operation poll failed (${response.status}): ${await response.text()}`);
    }

    const op = await response.json();
    if (op.done) {
      if (op.error) {
        throw new Error(`Operation failed: ${JSON.stringify(op.error)}`);
      }
      return op.response ?? op;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Operation timed out: ${operationName}`);
}

function printDnsRecords(domain, customDomain) {
  console.log(`\n=== DNS records for ${domain} ===`);
  console.log(`Status: host=${customDomain.hostState}, ownership=${customDomain.ownershipState}`);

  const desired = customDomain.requiredDnsUpdates?.desired ?? [];
  for (const group of desired) {
    for (const record of group.records ?? []) {
      if (record.requiredAction === 'ADD' || !record.requiredAction) {
        console.log(`  ADD ${record.type} | ${record.domainName} | ${record.rdata}`);
      }
    }
  }

  const remove = customDomain.requiredDnsUpdates?.discovered ?? [];
  for (const group of remove) {
    for (const record of group.records ?? []) {
      if (record.requiredAction === 'REMOVE') {
        console.log(`  REMOVE ${record.type} | ${record.domainName} | ${record.rdata}`);
      }
    }
  }

  const acme = customDomain.cert?.verification?.dns?.desired ?? [];
  for (const group of acme) {
    for (const record of group.records ?? []) {
      console.log(`  ADD ${record.type} | ${record.domainName} | ${record.rdata} (SSL)`);
    }
  }

  if (customDomain.issues?.length) {
    console.log('Issues:', customDomain.issues.map((i) => i.message).join('; '));
  }
}

async function ensureDomain(accessToken, domain) {
  const existing = await getCustomDomain(accessToken, domain);
  if (existing) {
    console.log(`Custom domain already registered: ${domain}`);
    printDnsRecords(domain, existing);
    return existing;
  }

  console.log(`Registering custom domain: ${domain}`);
  const operation = await createCustomDomain(accessToken, domain);
  const result = await waitForOperation(accessToken, operation.name);
  const customDomain = result?.name ? result : await getCustomDomain(accessToken, domain);
  printDnsRecords(domain, customDomain ?? result);
  return customDomain ?? result;
}

try {
  const refreshToken = loadRefreshToken();
  const accessToken = await getAccessToken(refreshToken);

  const listed = await listCustomDomains(accessToken);
  console.log('Existing custom domains:', (listed.customDomains ?? []).map((d) => d.name?.split('/').pop()).join(', ') || '(none)');

  for (const domain of DOMAINS) {
    await ensureDomain(accessToken, domain);
  }

  console.log('\nNext: add the DNS records above in GoDaddy, then wait for SSL provisioning (up to 24h).');
  console.log(`Firebase Hosting: https://console.firebase.google.com/project/${PROJECT_ID}/hosting/sites/${SITE_ID}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
