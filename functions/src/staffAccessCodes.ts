import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './db';

export function normalizeStaffAccessCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function lookupStaffBranch(code: string): Promise<{
  vendorId: string;
  locationId: string;
  floorId: string;
  locationName: string;
} | null> {
  const normalized = normalizeStaffAccessCode(code);
  if (!normalized) return null;

  const codeSnap = await db.collection('staffAccessCodes').doc(normalized).get();
  if (codeSnap.exists) {
    const data = codeSnap.data()!;
    return {
      vendorId: data.vendorId as string,
      locationId: data.locationId as string,
      floorId: (data.floorId as string) || '',
      locationName: (data.locationName as string) || '',
    };
  }

  // Legacy fallback: codes still stored on location documents until migrated.
  const legacySnap = await db
    .collection('locations')
    .where('staffAccessCode', '==', normalized)
    .limit(1)
    .get();

  if (legacySnap.empty) return null;

  const loc = legacySnap.docs[0].data();
  const floorId = loc.floors?.[0]?.id || '';
  const branch = {
    vendorId: loc.vendorId as string,
    locationId: legacySnap.docs[0].id,
    floorId,
    locationName: loc.name as string,
  };

  await syncStaffAccessCodeForLocation({
    locationId: branch.locationId,
    vendorId: branch.vendorId,
    floorId: branch.floorId,
    locationName: branch.locationName,
    code: normalized,
  });

  return branch;
}

export async function getStaffAccessCodeForLocation(locationId: string): Promise<string | null> {
  const snap = await db.collection('staffAccessCodeByLocation').doc(locationId).get();
  const code = snap.data()?.code;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

export async function syncStaffAccessCodeForLocation(input: {
  locationId: string;
  vendorId: string;
  floorId: string;
  locationName: string;
  code?: string | null;
}): Promise<void> {
  const { locationId, vendorId, floorId, locationName } = input;
  const normalized = input.code ? normalizeStaffAccessCode(input.code) : '';

  const mappingRef = db.collection('staffAccessCodeByLocation').doc(locationId);
  const existingMapping = await mappingRef.get();
  const previousCode =
    typeof existingMapping.data()?.code === 'string'
      ? normalizeStaffAccessCode(existingMapping.data()!.code as string)
      : '';

  if (previousCode && previousCode !== normalized) {
    await db.collection('staffAccessCodes').doc(previousCode).delete();
  }

  if (!normalized) {
    if (previousCode) {
      await db.collection('staffAccessCodes').doc(previousCode).delete();
    }
    await mappingRef.delete();
    await db.collection('locations').doc(locationId).set(
      { staffAccessCode: FieldValue.delete() },
      { merge: true },
    );
    return;
  }

  await db.collection('staffAccessCodes').doc(normalized).set({
    locationId,
    vendorId,
    floorId,
    locationName,
    updatedAt: Date.now(),
  });

  await mappingRef.set({ code: normalized, updatedAt: Date.now() });

  await db.collection('locations').doc(locationId).set(
    { staffAccessCode: FieldValue.delete() },
    { merge: true },
  );
}

export async function assertStaffAccessCodeAvailable(
  code: string,
  locationId: string,
): Promise<void> {
  const normalized = normalizeStaffAccessCode(code);
  if (!normalized) return;

  const existing = await db.collection('staffAccessCodes').doc(normalized).get();
  if (existing.exists && existing.data()?.locationId !== locationId) {
    throw new HttpsError('already-exists', 'That access code is already used by another branch.');
  }
}
