import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/v2';
import { db } from './db';

export async function getUserFcmTokens(userId: string): Promise<string[]> {
  const snap = await db.collection('users').doc(userId).collection('fcmTokens').get();
  return snap.docs.map((d) => d.data().token as string).filter(Boolean);
}

export async function getStaffFcmTokensForLocation(locationId: string): Promise<string[]> {
  const locSnap = await db.collection('locations').doc(locationId).get();
  if (!locSnap.exists) return [];

  const tokens: string[] = [];
  const staffSnap = await db.collection('users').where('role', 'in', ['employee', 'owner']).get();
  for (const doc of staffSnap.docs) {
    const tokenSnap = await doc.ref.collection('fcmTokens').get();
    tokenSnap.docs.forEach((t) => {
      const token = t.data().token as string;
      if (token) tokens.push(token);
    });
  }
  return [...new Set(tokens)];
}

export async function sendPushToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (tokens.length === 0) return;

  const messaging = getMessaging();
  const unique = [...new Set(tokens)];

  const response = await messaging.sendEachForMulticast({
    tokens: unique,
    notification: { title, body },
    data: data ?? {},
    webpush: {
      fcmOptions: { link: '/' },
    },
  });

  if (response.failureCount > 0) {
    const stale: string[] = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        logger.warn('FCM send failed', { token: unique[idx], error: res.error?.message });
        if (
          res.error?.code === 'messaging/registration-token-not-registered' ||
          res.error?.code === 'messaging/invalid-registration-token'
        ) {
          stale.push(unique[idx]);
        }
      }
    });
    if (stale.length > 0) {
      await removeStaleTokens(stale);
    }
  }
}

async function removeStaleTokens(tokens: string[]): Promise<void> {
  const usersSnap = await db.collectionGroup('fcmTokens').get();
  const batch = db.batch();
  let count = 0;
  for (const doc of usersSnap.docs) {
    if (tokens.includes(doc.data().token as string)) {
      batch.delete(doc.ref);
      count++;
    }
  }
  if (count > 0) await batch.commit();
}

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const tokens = await getUserFcmTokens(userId);
  await sendPushToTokens(tokens, title, body, data);
}
