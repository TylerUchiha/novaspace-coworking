import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './db';
import { writeCreditTransaction, recordAnalyticsEvent } from './transactionHelpers';
import { getRemoteConfigBool } from './remoteConfigServer';

const MIN_TOP_UP = 200;

export const topUpCredits = onCall({ cors: true }, async (request) => {
  const topUpEnabled = await getRemoteConfigBool('feature_credits_topup_enabled', false);
  if (!topUpEnabled) {
    throw new HttpsError('failed-precondition', 'Credit top-up is not available at this time.');
  }

  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to top up.');
  }

  const amount = request.data?.amount as number;
  if (typeof amount !== 'number' || amount < MIN_TOP_UP) {
    throw new HttpsError('invalid-argument', `Minimum top-up is ${MIN_TOP_UP} EGP.`);
  }

  const userId = request.auth.uid;
  const userRef = db.collection('users').doc(userId);

  await recordAnalyticsEvent('top_up_attempt', { userId, amount });

  const result = await db.runTransaction(async (txn) => {
    const userSnap = await txn.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const credits = (userSnap.data()?.credits as number) ?? 0;
    const newBalance = credits + amount;
    txn.update(userRef, { credits: newBalance });

    const txId = await writeCreditTransaction(txn, {
      userId,
      type: 'credit',
      amount,
      description: 'Account Top-Up',
      category: 'top_up',
      paymentMethod: 'manual',
      balanceAfter: newBalance,
    });

    return { txId, newBalance };
  });

  await recordAnalyticsEvent('top_up_success', { userId, amount, newBalance: result.newBalance });

  return { success: true, ...result };
});

export const registerFcmToken = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to register for notifications.');
  }

  const token = request.data?.token as string;
  if (typeof token !== 'string' || !token.trim()) {
    throw new HttpsError('invalid-argument', 'FCM token is required.');
  }

  const userId = request.auth.uid;
  const tokenId = Buffer.from(token).toString('base64url').slice(0, 128);
  const platform = (request.data?.platform as string) || 'web';

  await db
    .collection('users')
    .doc(userId)
    .collection('fcmTokens')
    .doc(tokenId)
    .set({
      token: token.trim(),
      platform,
      updatedAt: Date.now(),
    });

  return { success: true };
});

export const unregisterFcmToken = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const token = request.data?.token as string;
  if (typeof token !== 'string' || !token.trim()) {
    throw new HttpsError('invalid-argument', 'FCM token is required.');
  }

  const tokenId = Buffer.from(token).toString('base64url').slice(0, 128);
  await db
    .collection('users')
    .doc(request.auth.uid)
    .collection('fcmTokens')
    .doc(tokenId)
    .delete()
    .catch(() => {});

  return { success: true };
});
