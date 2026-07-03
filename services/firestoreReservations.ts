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
import { Reservation } from '../types';

function mapReservation(id: string, data: Record<string, unknown>): Reservation {
  return { ...data, id } as Reservation;
}

export function subscribeReservationsByLocationAndDate(
  locationId: string,
  date: string,
  callback: (reservations: Reservation[]) => void,
): () => void {
  const q = query(
    collection(db, 'reservations'),
    where('locationId', '==', locationId),
    where('date', '==', date),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => mapReservation(d.id, d.data() as Record<string, unknown>))),
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

export function subscribeAllReservations(
  callback: (reservations: Reservation[]) => void,
): () => void {
  const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => mapReservation(d.id, d.data() as Record<string, unknown>))),
    (err) => console.error('subscribeAllReservations error', err),
  );
}

export async function updateReservationStatus(
  reservationId: string,
  status: Reservation['status'],
  extra?: Partial<Reservation>,
): Promise<void> {
  await updateDoc(doc(db, 'reservations', reservationId), { status, ...extra });
}
