import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';
import { seedCatalog } from './seedCatalog';
import {
  createBooking,
  cancelBooking,
  updateReservationStatus,
  appendReservationOrder,
  syncReservationUserName,
} from './bookings';
import { lookupStaffBranch } from './staffAccessCodes';
import { novaBotChat } from './novaBot';
import { supportChat } from './supportChat';
import { scheduledFirestoreExport, triggerFirestoreExport } from './scheduledBackup';
import { ownerPasscodeSecret } from './secrets';
import { ownerPasscodesMatch, resolveOwnerPasscode } from './remoteConfigServer';
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
import { preparePhonePasswordReset, completePhonePasswordReset } from './passwordReset';
import { saveCatalogLocation, saveCatalogVendor, getStaffAccessCode } from './catalog';
import { backfillAllPublicAvailability } from './publicAvailability';
import { createWalkInMember } from './staffMembers';
import { SUPPORT_EMAIL } from './contact';
import { submitSupportInquiry } from './supportInquiry';
import { verifyRecaptcha } from './recaptcha';
import { onAuthUserDeleted, adminDeleteUser, deleteMyAccount, wipeUserData } from './deleteAccount';
import { confirmPhoneVerified } from './phoneVerificationConfirm';

if (!getApps().length) {
  initializeApp();
}

setGlobalOptions({ region: 'us-central1' });

export {
  seedCatalog,
  createBooking,
  cancelBooking,
  updateReservationStatus,
  appendReservationOrder,
  syncReservationUserName,
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
  preparePhonePasswordReset,
  completePhonePasswordReset,
  saveCatalogLocation,
  saveCatalogVendor,
  getStaffAccessCode,
  createWalkInMember,
  submitSupportInquiry,
  verifyRecaptcha,
  onAuthUserDeleted,
  adminDeleteUser,
  deleteMyAccount,
  wipeUserData,
  confirmPhoneVerified,
};

export const health = onRequest({ cors: true }, async (_req, res) => {
  res.json({
    status: 'ok',
    service: 'novaspace-functions',
    timestamp: new Date().toISOString(),
  });
});

export const sendTestEmail = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  if (!request.auth?.token?.role || (request.auth.token.role !== 'owner' && request.auth.token.role !== 'employee')) {
    throw new HttpsError('permission-denied', 'Staff access required.');
  }

  const to =
    typeof request.data?.to === 'string' && request.data.to.trim()
      ? request.data.to.trim()
      : SUPPORT_EMAIL;

  const ref = await db.collection('mail').add({
    to,
    from: `NovaSpace <${SUPPORT_EMAIL}>`,
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
  const isOwnerCode = ownerPasscodesMatch(code, ownerPasscode);
  let role: 'owner' | 'employee';
  let branch: Awaited<ReturnType<typeof lookupStaffBranch>> = null;

  if (isOwnerCode) {
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

  let customToken: string | undefined;
  try {
    customToken = await getAuth().createCustomToken(uid, claims);
  } catch (error) {
    console.error('createCustomToken failed — returning role without token', error);
  }

  return {
    role,
    branch: branch || undefined,
    customToken,
  };
});

export const backfillPublicAvailability = onCall({ cors: true }, async (request) => {
  if (request.auth?.token?.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Owner access required.');
  }
  return backfillAllPublicAvailability();
});
