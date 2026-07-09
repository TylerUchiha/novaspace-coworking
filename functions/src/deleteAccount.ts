import { auth } from 'firebase-functions/v1';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { db } from './db';
import { assertStaffAuth } from './staffAuth';
import { removePublicAvailability } from './publicAvailability';

const BATCH_LIMIT = 400;

async function deleteSubcollection(path: string): Promise<number> {
  const col = db.collection(path);
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await col.limit(BATCH_LIMIT).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < BATCH_LIMIT) break;
  }
  return deleted;
}

/**
 * Wipe Firestore data for a user. Auth user may already be deleted (onDelete)
 * or still exist (admin callable — caller deletes Auth after this).
 */
export async function wipeUserData(uid: string): Promise<{
  reservationsAnonymized: number;
  fcmTokensDeleted: number;
  transactionsDeleted: number;
  profileDeleted: boolean;
}> {
  if (!uid || uid.startsWith('code-')) {
    logger.info('wipeUserData skipped for protected uid', { uid });
    return {
      reservationsAnonymized: 0,
      fcmTokensDeleted: 0,
      transactionsDeleted: 0,
      profileDeleted: false,
    };
  }

  const reservationsSnap = await db.collection('reservations').where('userId', '==', uid).get();
  let reservationsAnonymized = 0;
  for (const docSnap of reservationsSnap.docs) {
    const data = docSnap.data();
    const status = data.status as string | undefined;
    // Future/active slots: remove public availability; keep reservation anonymized for accounting.
    if (status === 'approved' || status === 'pending') {
      await removePublicAvailability(docSnap.id);
      await docSnap.ref.set(
        {
          status: 'declined',
          userId: `deleted-${uid}`,
          userName: 'Deleted user',
          userEmail: FieldValue.delete(),
          deletedAt: Date.now(),
        },
        { merge: true },
      );
    } else {
      await docSnap.ref.set(
        {
          userId: `deleted-${uid}`,
          userName: 'Deleted user',
          userEmail: FieldValue.delete(),
          deletedAt: Date.now(),
        },
        { merge: true },
      );
    }
    reservationsAnonymized += 1;
  }

  const fcmTokensDeleted = await deleteSubcollection(`users/${uid}/fcmTokens`);
  const transactionsDeleted = await deleteSubcollection(`users/${uid}/transactions`);

  await db.collection('emailVerifications').doc(uid).delete().catch(() => undefined);

  try {
    const resetsSnap = await db.collection('phonePasswordResets').where('uid', '==', uid).get();
    if (!resetsSnap.empty) {
      const batch = db.batch();
      resetsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    logger.warn('phonePasswordResets cleanup failed (index may be missing)', { uid, err });
  }

  // Best-effort analytics scrub — may be slow; failures are non-fatal.
  try {
    const eventsSnap = await db
      .collection('analytics_events')
      .where('params.userId', '==', uid)
      .limit(BATCH_LIMIT)
      .get();
    if (!eventsSnap.empty) {
      const batch = db.batch();
      eventsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    logger.warn('analytics_events scrub skipped or failed', { uid, err });
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await userRef.delete();
  }

  logger.info('wipeUserData complete', {
    uid,
    reservationsAnonymized,
    fcmTokensDeleted,
    transactionsDeleted,
    profileDeleted: userSnap.exists,
  });

  return {
    reservationsAnonymized,
    fcmTokensDeleted,
    transactionsDeleted,
    profileDeleted: userSnap.exists,
  };
}

/** Fires after an Auth user is deleted in Console or via Admin SDK. */
export const onAuthUserDeleted = auth.user().onDelete(async (user) => {
  try {
    await wipeUserData(user.uid);
  } catch (err) {
    logger.error('onAuthUserDeleted wipe failed', { uid: user.uid, err });
  }
});

/** Staff/owner callable: wipe Firestore then delete Auth user. */
export const adminDeleteUser = onCall({ cors: true }, async (request) => {
  const staff = await assertStaffAuth(request.auth);
  if (staff.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only owners can delete user accounts.');
  }

  const targetUserId = (request.data?.targetUserId as string | undefined)?.trim();
  if (!targetUserId || targetUserId.length > 128) {
    throw new HttpsError('invalid-argument', 'targetUserId is required.');
  }
  if (targetUserId.startsWith('code-')) {
    throw new HttpsError('invalid-argument', 'Cannot delete staff code-session accounts.');
  }
  if (targetUserId === staff.uid) {
    throw new HttpsError('invalid-argument', 'Cannot delete your own account via adminDeleteUser.');
  }

  const targetSnap = await db.collection('users').doc(targetUserId).get();
  const targetRole = targetSnap.data()?.role;
  if (targetRole === 'owner' || targetRole === 'employee') {
    throw new HttpsError('permission-denied', 'Cannot delete staff profiles with this tool.');
  }

  await wipeUserData(targetUserId);

  try {
    await getAuth().deleteUser(targetUserId);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== 'auth/user-not-found') {
      logger.error('adminDeleteUser Auth delete failed after wipe', { targetUserId, err });
      throw new HttpsError('internal', 'Profile wiped but Auth delete failed. Check Auth console.');
    }
  }

  return { success: true, targetUserId };
});

/** Customer self-service: wipe Firestore data then delete Auth user. */
export const deleteMyAccount = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const uid = request.auth.uid;
  if (uid.startsWith('code-')) {
    throw new HttpsError('permission-denied', 'Staff code sessions cannot delete accounts this way.');
  }

  const tokenRole = request.auth.token.role;
  if (tokenRole === 'owner' || tokenRole === 'employee') {
    throw new HttpsError('permission-denied', 'Staff accounts cannot use self-delete.');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const docRole = userSnap.data()?.role;
  if (docRole === 'owner' || docRole === 'employee') {
    throw new HttpsError('permission-denied', 'Staff accounts cannot use self-delete.');
  }

  await wipeUserData(uid);

  try {
    await getAuth().deleteUser(uid);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== 'auth/user-not-found') {
      logger.error('deleteMyAccount Auth delete failed after wipe', { uid, err });
      throw new HttpsError('internal', 'Profile wiped but Auth delete failed. Contact support.');
    }
  }

  return { success: true };
});
