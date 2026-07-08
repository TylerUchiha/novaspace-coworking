import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Reservation, PublicAvailability } from '../types';

function mapReservation(id: string, data: Record<string, unknown>): Reservation {
  return { ...data, id } as Reservation;
}

function mapPublicAvailabilityToReservation(slot: PublicAvailability): Reservation {
  return {
    id: slot.id,
    roomId: slot.roomId,
    locationId: slot.locationId,
    floorId: slot.floorId,
    vendorId: slot.vendorId,
    date: slot.date,
    time: slot.time,
    duration: slot.duration,
    status: slot.status,
    createdAt: slot.createdAt,
    userName: '',
    userEmail: '',
  };
}

export function mergeReservationLists(...lists: Iterable<Reservation>[]): Reservation[] {
  const merged = new Map<string, Reservation>();
  for (const list of lists) {
    for (const reservation of list) {
      merged.set(reservation.id, reservation);
    }
  }
  return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function subscribeReservationsByLocationAndDate(
  locationId: string,
  date: string,
  callback: (reservations: Reservation[]) => void,
): () => void {
  const q = query(
    collection(db, 'publicAvailability'),
    where('locationId', '==', locationId),
    where('date', '==', date),
    where('status', 'in', ['approved', 'pending']),
  );
  return onSnapshot(
    q,
    (snap) => callback(
      snap.docs.map((d) => mapPublicAvailabilityToReservation(d.data() as PublicAvailability)),
    ),
    (err) => console.error('subscribeReservationsByLocationAndDate error', err),
  );
}

export function subscribeUserReservations(
  userId: string,
  callback: (reservations: Reservation[]) => void,
): () => void {
  const q = query(
    collection(db, 'reservations'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => mapReservation(d.id, d.data() as Record<string, unknown>))),
    (err) => console.error('subscribeUserReservations error', err),
  );
}

export function subscribeStaffReservationsByVendor(
  vendorId: string,
  callback: (reservations: Reservation[]) => void,
): () => void {
  const q = query(
    collection(db, 'reservations'),
    where('vendorId', '==', vendorId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => mapReservation(d.id, d.data() as Record<string, unknown>))),
    (err) => console.error('subscribeStaffReservationsByVendor error', err),
  );
}

export async function updateReservationStatus(
  reservationId: string,
  status: Reservation['status'],
  extra?: Partial<Reservation>,
): Promise<void> {
  await updateDoc(doc(db, 'reservations', reservationId), { status, ...extra });
}
