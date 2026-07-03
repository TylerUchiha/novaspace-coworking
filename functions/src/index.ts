import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';
import { seedCatalog, ensureCatalogSeeded } from './seedCatalog';
import {
  createBooking,
  cancelBooking,
  updateReservationStatus,
  lookupStaffBranch,
} from './bookings';
import { novaBotChat } from './novaBot';
import { supportChat } from './supportChat';
import { scheduledFirestoreExport, triggerFirestoreExport } from './scheduledBackup';
import { ownerPasscodeSecret } from './secrets';
import { resolveOwnerPasscode } from './remoteConfigServer';
import { topUpCredits, registerFcmToken, unregisterFcmToken } from './transactions';
import { onReservationCreated, onReservationUpdated } from './reservationTriggers';
import {
  autoDeclineExpiredPending,
  sendBookingReminders,
  sendShiftReminders,
  dailyAnalyticsRollup,
} from './scheduledJobs';
import { db } from './db';
import { sendEmailVerificationCode, verifyEmailCode } from './emailVerification';

if (!getApps().length) {
  initializeApp();
}

setGlobalOptions({ region: 'us-central1' });

export {
  seedCatalog,
  createBooking,
  cancelBooking,
  updateReservationStatus,
  novaBotChat,
  supportChat,
  scheduledFirestoreExport,
  triggerFirestoreExport,
  topUpCredits,
  registerFcmToken,
  unregisterFcmToken,
  onReservationCreated,
  onReservationUpdated,
  autoDeclineExpiredPending,
  sendBookingReminders,
  sendShiftReminders,
  dailyAnalyticsRollup,
  sendEmailVerificationCode,
  verifyEmailCode,
};

export const health = onRequest(async (_req, res) => {
  try {
    const seeded = await ensureCatalogSeeded();
    res.json({
      status: 'ok',
      service: 'novaspace-functions',
      catalogSeeded: seeded,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: String(err) });
  }
});

export const sendTestEmail = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  const to =
    typeof request.data?.to === 'string' && request.data.to.trim()
      ? request.data.to.trim()
      : 'novaspace.org@gmail.com';

  const ref = await db.collection('mail').add({
    to,
    message: {
      subject: 'NovaSpace test email',
      html: '<p>If you got this, the Trigger Email from Firestore extension works.</p>',
      text: 'If you got this, the Trigger Email from Firestore extension works.',
    },
  });

  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const snap = await ref.get();
    const delivery = snap.data()?.delivery;
    if (delivery) {
      return { docId: ref.id, to, delivery };
    }
  }

  const snap = await ref.get();
  return {
    docId: ref.id,
    to,
    delivery: snap.data()?.delivery ?? null,
    document: snap.data(),
    message: 'Timed out waiting for delivery status. Check extension logs.',
  };
});

export const validateAccessCode = onCall({ cors: true, secrets: [ownerPasscodeSecret] }, async (request) => {
  const rawCode = request.data?.code;
  if (typeof rawCode !== 'string' || !rawCode.trim()) {
    throw new HttpsError('invalid-argument', 'Access code is required.');
  }

  const code = rawCode.trim();
  const ownerPasscode = await resolveOwnerPasscode(ownerPasscodeSecret.value());
  let role: 'owner' | 'employee';
  let branch: Awaited<ReturnType<typeof lookupStaffBranch>> = null;

  if (code === ownerPasscode) {
    role = 'owner';
  } else {
    branch = await lookupStaffBranch(code);
    if (!branch) {
      throw new HttpsError('permission-denied', 'Invalid access code.');
    }
    role = 'employee';
  }

  const uid = role === 'owner' ? 'code-owner-global' : `code-staff-${branch!.locationId}`;
  const claims: Record<string, string> = { role };
  if (branch) {
    claims.vendorId = branch.vendorId;
    claims.locationId = branch.locationId;
    claims.floorId = branch.floorId;
  }

  const customToken = await getAuth().createCustomToken(uid, claims);

  return {
    role,
    branch: branch || undefined,
    customToken,
  };
});
