/**
 * Enables Firebase Phone Auth and allows Egypt (EG) for SMS verification.
 * Uses the logged-in Firebase CLI credentials.
 */
const path = require('path');

const firebaseToolsRoot = path.join(
  process.env.APPDATA || path.join(process.env.HOME || '', '.config'),
  'npm',
  'node_modules',
  'firebase-tools'
);

const auth = require(path.join(firebaseToolsRoot, 'lib/gcp/auth'));
const { Client } = require(path.join(firebaseToolsRoot, 'lib/apiv2'));
const { identityOrigin } = require(path.join(firebaseToolsRoot, 'lib/api'));
const { requireAuth } = require(path.join(firebaseToolsRoot, 'lib/requireAuth'));
const { configstore } = require(path.join(firebaseToolsRoot, 'lib/configstore'));

const PROJECT_ID = 'refined-legend-420223';

async function authenticate() {
  const options = {
    project: PROJECT_ID,
    projectId: PROJECT_ID,
    user: configstore.get('user'),
    tokens: configstore.get('tokens'),
  };

  await requireAuth(options);
  return options;
}

async function main() {
  await authenticate();
  const apiClient = new Client({ urlPrefix: identityOrigin(), auth: true });

  console.log('Fetching current auth config...');
  const current = await apiClient.get(`/admin/v2/projects/${PROJECT_ID}/config`, {
    headers: { 'x-goog-user-project': PROJECT_ID },
  });
  console.log(
    'Current SMS region config:',
    JSON.stringify(current.body.smsRegionConfig ?? current.body.sms_region_config ?? null)
  );
  console.log(
    'Current phone provider:',
    JSON.stringify(
      current.body.signIn?.phoneNumber ??
        current.body.sign_in?.phone_number ??
        null
    )
  );

  console.log('\nSetting SMS region allowlist to Egypt (EG)...');
  await auth.setAllowSmsRegionPolicy(PROJECT_ID, ['EG']);
  console.log('SMS region policy updated.');

  console.log('\nEnabling Phone sign-in provider...');
  const patchRes = await apiClient.patch(
    `/admin/v2/projects/${PROJECT_ID}/config`,
    {
      signIn: {
        phoneNumber: {
          enabled: true,
        },
      },
    },
    {
      queryParams: { updateMask: 'signIn.phoneNumber' },
      headers: { 'x-goog-user-project': PROJECT_ID },
    }
  );

  if (patchRes.status !== 200) {
    throw new Error(`Failed to enable phone auth: HTTP ${patchRes.status}`);
  }

  console.log('Phone sign-in enabled.');

  const updated = await apiClient.get(`/admin/v2/projects/${PROJECT_ID}/config`, {
    headers: { 'x-goog-user-project': PROJECT_ID },
  });

  const phoneEnabled =
    updated.body.signIn?.phoneNumber?.enabled ??
    updated.body.sign_in?.phone_number?.enabled;
  const smsConfig =
    updated.body.smsRegionConfig ?? updated.body.sms_region_config;

  console.log('\nVerification:');
  console.log('- Phone auth enabled:', phoneEnabled);
  console.log('- SMS region config:', JSON.stringify(smsConfig));

  if (!phoneEnabled) {
    process.exitCode = 1;
    console.error('Phone auth may not be enabled — check Firebase Console.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
