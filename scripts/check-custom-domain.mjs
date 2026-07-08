#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_ID = 'refined-legend-420223';
const SITE_ID = 'refined-legend-420223';

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

function printDnsRecords(domain, customDomain) {
  console.log(`\n=== ${domain} ===`);
  console.log(`Status: host=${customDomain.hostState}, ownership=${customDomain.ownershipState}`);

  for (const group of customDomain.requiredDnsUpdates?.desired ?? []) {
    for (const record of group.records ?? []) {
      if (record.requiredAction === 'ADD' || !record.requiredAction) {
        console.log(`  ADD ${record.type} | ${record.domainName} | ${record.rdata}`);
      }
    }
  }

  for (const group of customDomain.requiredDnsUpdates?.discovered ?? []) {
    for (const record of group.records ?? []) {
      if (record.requiredAction === 'REMOVE') {
        console.log(`  REMOVE ${record.type} | ${record.domainName} | ${record.rdata}`);
      }
    }
  }

  for (const group of customDomain.cert?.verification?.dns?.desired ?? []) {
    for (const record of group.records ?? []) {
      console.log(`  ADD ${record.type} | ${record.domainName} | ${record.rdata} (SSL)`);
    }
  }

  if (customDomain.issues?.length) {
    console.log('Issues:', customDomain.issues.map((i) => i.message).join('; '));
  }
}

const token = await getAccessToken(loadRefreshToken());
const list = await (
  await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${SITE_ID}/customDomains`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
).json();

console.log('Custom domains:', (list.customDomains ?? []).map((d) => d.name?.split('/').pop()).join(', ') || '(none)');

for (const d of list.customDomains ?? []) {
  const detail = await (
    await fetch(`https://firebasehosting.googleapis.com/v1beta1/${d.name}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  printDnsRecords(d.name.split('/').pop(), detail);
}

