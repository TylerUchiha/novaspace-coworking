/**
 * One-time GCS bucket + IAM setup for scheduled Firestore exports.
 *
 * Usage:
 *   node scripts/setup-firestore-backup.mjs
 *
 * Optional env:
 *   FIRESTORE_BACKUP_BUCKET=refined-legend-420223-firestore-backups
 *
 * Requires: gcloud CLI authenticated with project refined-legend-420223
 */

import { execSync } from 'node:child_process';

const projectId = 'refined-legend-420223';
const bucket = process.env.FIRESTORE_BACKUP_BUCKET || `${projectId}-firestore-backups`;
const region = 'us-central1';
const serviceAccount = `${projectId}@appspot.gserviceaccount.com`;

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

console.log(`Setting up Firestore backup bucket: gs://${bucket}`);

run(`gcloud config set project ${projectId}`);
run(`gsutil mb -p ${projectId} -l ${region} -b on gs://${bucket}/ || echo Bucket may already exist`);
run(`gsutil iam ch serviceAccount:${serviceAccount}:roles/storage.admin gs://${bucket}`);

console.log(`
Done. Deploy functions to enable scheduledFirestoreExport:
  npm run functions:deploy

Manual test (set FIRESTORE_EXPORT_TRIGGER_KEY on the function first):
  curl "https://us-central1-${projectId}.cloudfunctions.net/triggerFirestoreExport?key=YOUR_KEY"

Console: Firebase → Remote Config → publish remote-config.template.json via:
  npm run deploy:remote-config
`);
