import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './db';
import { assertStaffAuth } from './staffAuth';
import {
  assertStaffAccessCodeAvailable,
  getStaffAccessCodeForLocation,
  syncStaffAccessCodeForLocation,
} from './staffAccessCodes';

function validateLocationPayload(location: Record<string, unknown>): string {
  const id = location.id;
  if (typeof id !== 'string' || !id.trim()) {
    throw new HttpsError('invalid-argument', 'Location id is required.');
  }
  if (typeof location.vendorId !== 'string' || !location.vendorId.trim()) {
    throw new HttpsError('invalid-argument', 'Location vendorId is required.');
  }
  if (typeof location.name !== 'string' || !location.name.trim()) {
    throw new HttpsError('invalid-argument', 'Location name is required.');
  }
  if (!Array.isArray(location.floors)) {
    throw new HttpsError('invalid-argument', 'Location floors must be an array.');
  }
  return id;
}

function stripStaffAccessCode(location: Record<string, unknown>): Record<string, unknown> {
  const { staffAccessCode: _removed, ...rest } = location;
  return rest;
}

export const saveCatalogLocation = onCall({ cors: true }, async (request) => {
  await assertStaffAuth(request.auth);

  const location = request.data?.location;
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new HttpsError('invalid-argument', 'Location payload is required.');
  }

  const payload = location as Record<string, unknown>;
  const id = validateLocationPayload(payload);
  const staffAccessCode =
    typeof payload.staffAccessCode === 'string' ? payload.staffAccessCode : undefined;
  const vendorId = payload.vendorId as string;
  const locationName = payload.name as string;
  const floorId = Array.isArray(payload.floors)
    ? ((payload.floors[0] as { id?: string } | undefined)?.id ?? '')
    : '';

  if (staffAccessCode?.trim()) {
    await assertStaffAccessCodeAvailable(staffAccessCode, id);
  }

  await syncStaffAccessCodeForLocation({
    locationId: id,
    vendorId,
    floorId,
    locationName,
    code: staffAccessCode?.trim() || null,
  });

  await db.collection('locations').doc(id).set(stripStaffAccessCode(payload), { merge: true });
  return { success: true, id };
});

export const getStaffAccessCode = onCall({ cors: true }, async (request) => {
  await assertStaffAuth(request.auth);

  const locationId = request.data?.locationId;
  if (typeof locationId !== 'string' || !locationId.trim()) {
    throw new HttpsError('invalid-argument', 'locationId is required.');
  }

  const code = await getStaffAccessCodeForLocation(locationId.trim());
  return { code: code ?? '' };
});

export const saveCatalogVendor = onCall({ cors: true }, async (request) => {
  await assertStaffAuth(request.auth);

  const vendor = request.data?.vendor;
  if (!vendor || typeof vendor !== 'object' || Array.isArray(vendor)) {
    throw new HttpsError('invalid-argument', 'Vendor payload is required.');
  }

  const id = (vendor as Record<string, unknown>).id;
  if (typeof id !== 'string' || !id.trim()) {
    throw new HttpsError('invalid-argument', 'Vendor id is required.');
  }

  await db.collection('vendors').doc(id).set(vendor, { merge: true });
  return { success: true, id };
});
