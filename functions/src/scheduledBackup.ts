import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { GoogleAuth } from 'google-auth-library';

const FIRESTORE_DATABASE_ID =
  'ai-studio-novaspacecoworki-863fc540-4213-48e8-8f94-f914c1f6fe77';

function getBackupBucket(projectId: string): string {
  return process.env.FIRESTORE_BACKUP_BUCKET || `${projectId}-firestore-backups`;
}

async function runFirestoreExport(): Promise<{ outputUriPrefix: string; operationName?: string }> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/datastore'],
  });
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  if (!projectId) {
    throw new Error('GCLOUD_PROJECT is not set.');
  }

  const bucket = getBackupBucket(projectId);
  const datePrefix = new Date().toISOString().slice(0, 10);
  const outputUriPrefix = `gs://${bucket}/exports/${datePrefix}-${Date.now()}`;
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}:exportDocuments`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ outputUriPrefix }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Firestore export failed (${response.status}): ${JSON.stringify(body)}`);
  }

  logger.info('Firestore export started', { outputUriPrefix, operationName: body.name });
  return { outputUriPrefix, operationName: body.name };
}

/** Daily 03:00 Africa/Cairo — requires Blaze plan + FIRESTORE_BACKUP_BUCKET GCS bucket. */
export const scheduledFirestoreExport = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Africa/Cairo',
    region: 'us-central1',
    retryCount: 2,
  },
  async () => {
    await runFirestoreExport();
  },
);

/** Manual trigger for testing — protect with ?key= matching FIRESTORE_EXPORT_TRIGGER_KEY env. */
export const triggerFirestoreExport = onRequest({ cors: false, region: 'us-central1' }, async (req, res) => {
  const expectedKey = process.env.FIRESTORE_EXPORT_TRIGGER_KEY;
  if (expectedKey && req.query.key !== expectedKey) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const result = await runFirestoreExport();
    res.json({ status: 'started', ...result });
  } catch (error) {
    logger.error('Manual Firestore export failed', error);
    res.status(500).json({ error: String(error) });
  }
});
