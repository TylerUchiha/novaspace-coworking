import { db } from './db';

export interface PublicAvailabilityData {
  id: string;
  roomId: string;
  locationId: string;
  floorId: string;
  vendorId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  createdAt: number;
}

type ReservationLike = {
  id?: string;
  roomId?: string;
  locationId?: string;
  floorId?: string;
  vendorId?: string;
  date?: string;
  time?: string;
  duration?: number;
  status?: string;
  createdAt?: number;
};

export function toPublicAvailability(
  reservationId: string,
  data: ReservationLike,
): PublicAvailabilityData | null {
  if (!data.locationId || !data.date || !data.time || data.duration === undefined) {
    return null;
  }
  if (data.status !== 'approved' && data.status !== 'pending') {
    return null;
  }

  return {
    id: reservationId,
    roomId: data.roomId || 'none',
    locationId: data.locationId,
    floorId: data.floorId || 'none',
    vendorId: data.vendorId || '',
    date: data.date,
    time: data.time,
    duration: data.duration,
    status: data.status,
    createdAt: data.createdAt ?? Date.now(),
  };
}

export async function syncPublicAvailability(
  reservationId: string,
  data: ReservationLike,
): Promise<void> {
  const publicData = toPublicAvailability(reservationId, data);
  const ref = db.collection('publicAvailability').doc(reservationId);
  if (!publicData) {
    await ref.delete().catch(() => undefined);
    return;
  }
  await ref.set(publicData);
}

export async function removePublicAvailability(reservationId: string): Promise<void> {
  await db.collection('publicAvailability').doc(reservationId).delete().catch(() => undefined);
}

export async function backfillAllPublicAvailability(): Promise<{ synced: number; removed: number }> {
  const snap = await db.collection('reservations').get();
  let synced = 0;
  let removed = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const publicData = toPublicAvailability(docSnap.id, data);
    const ref = db.collection('publicAvailability').doc(docSnap.id);
    if (!publicData) {
      await ref.delete().catch(() => undefined);
      removed += 1;
    } else {
      await ref.set(publicData);
      synced += 1;
    }
  }

  return { synced, removed };
}
