import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'refined-legend-420223';
const DATABASE = 'ai-studio-novaspacecoworki-863fc540-4213-48e8-8f94-f914c1f6fe77';
const TEST_TO = process.env.TEST_EMAIL_TO || 'support@novaspace.work';

function loadRefreshToken() {
  const path = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  return JSON.parse(readFileSync(path, 'utf8')).tokens.refresh_token;
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
  const json = await response.json();
  if (!response.ok) throw new Error(json.error_description || 'Token refresh failed');
  return json.access_token;
}

function parseFields(fields = {}) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value.stringValue !== undefined) out[key] = value.stringValue;
    else if (value.mapValue) out[key] = parseFields(value.mapValue.fields);
  }
  return out;
}

const accessToken = await getAccessToken(loadRefreshToken());
const auth = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

const body = {
  fields: {
    to: { stringValue: TEST_TO },
    from: { stringValue: 'NovaSpace <support@novaspace.work>' },
    replyTo: { stringValue: 'support@novaspace.work' },
    message: {
      mapValue: {
        fields: {
          subject: { stringValue: 'NovaSpace SMTP test' },
          html: { stringValue: '<p>Test email after GoDaddy SMTP username fix.</p>' },
          text: { stringValue: 'Test email after GoDaddy SMTP username fix.' },
        },
      },
    },
  },
};

const createUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents/mail`;
const createRes = await fetch(createUrl, { method: 'POST', headers: auth, body: JSON.stringify(body) });
const created = await createRes.json();
if (!createRes.ok) {
  console.error('Create failed:', created);
  process.exit(1);
}

const docName = created.name;
console.log('Queued mail doc:', docName.split('/').pop());
console.log('Waiting for delivery...');

for (let i = 0; i < 45; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const getRes = await fetch(`https://firestore.googleapis.com/v1/${docName}`, { headers: auth });
  const doc = await getRes.json();
  const data = parseFields(doc.fields || {});
  const state = data.delivery?.state;
  if (state === 'SUCCESS') {
    console.log(`SUCCESS — email sent to ${TEST_TO}`);
    process.exit(0);
  }
  if (state === 'ERROR') {
    console.error('FAILED:', data.delivery.error);
    process.exit(1);
  }
  if (i % 5 === 4) console.log(`Still waiting (${(i + 1) * 2}s)...`, state || 'no status yet');
}

console.error('Timed out waiting for delivery status.');
process.exit(1);
