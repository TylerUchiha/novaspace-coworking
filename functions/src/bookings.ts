import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './db';
import { writeCreditTransaction } from './transactionHelpers';

interface RoomInput {
  id: string;
  name: string;
  pricePerHour: number;
}

interface MenuItemInput {
  itemId: string;
  quantity: number;
  comment?: string;
  deliveryTime?: string;
}

interface CreateBookingInput {
  rooms?: RoomInput[];
  locationId: string;
  floorId: string;
  vendorId: string;
  date: string;
  time: string;
  duration: number;
  paymentMethod: string;
  selectedMenuItems?: MenuItemInput[];
  totalOrderComment?: string;
  totalPrice?: number;
  targetUserId?: string;
  targetUserName?: string;
  targetUserEmail?: string;
  autoApprove?: boolean;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isStaff(auth: { token: Record<string, unknown> } | undefined): boolean {
  const role = auth?.token?.role;
  return role === 'owner' || role === 'employee';
}

export const createBooking = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to book.');
  }

  const data = request.data as CreateBookingInput;
  const {
    rooms = [],
    locationId,
    floorId,
    vendorId,
    date,
    time,
    duration,
    paymentMethod,
    selectedMenuItems,
    totalOrderComment,
    totalPrice: totalPriceOverride,
    targetUserId,
    targetUserName,
    targetUserEmail,
    autoApprove,
  } = data;

  if (!locationId || !vendorId || !date || !time) {
    throw new HttpsError('invalid-argument', 'Missing required booking fields.');
  }

  const actingStaff = isStaff(request.auth);
  if (!actingStaff) {
    const userRef = db.collection('users').doc(request.auth.uid);
    const selfSnap = await userRef.get();
    if (selfSnap.exists && selfSnap.data()?.emailVerified !== true) {
      throw new HttpsError('failed-precondition', 'Verify your email before booking.');
    }
  }

  const userId = actingStaff && targetUserId ? targetUserId : request.auth.uid;
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  const userData = userSnap.data();

  const userName =
    targetUserName ||
    (userData?.name as string) ||
    request.auth.token.name ||
    'Member';
  const userEmail =
    targetUserEmail ||
    (userData?.email as string) ||
    request.auth.token.email ||
    '';

  const totalPrice =
    totalPriceOverride !== undefined
      ? totalPriceOverride
      : rooms.reduce((sum, r) => sum + r.pricePerHour, 0) * duration;

  if (paymentMethod === 'credits' && totalPrice > 0) {
    const credits = (userData?.credits as number) ?? 0;
    if (credits < totalPrice) {
      throw new HttpsError('failed-precondition', 'Insufficient credits.');
    }
  }

  const newStart = timeToMinutes(time);
  const newEnd = newStart + duration * 60;

  if (rooms.length > 0) {
    const conflictSnap = await db
      .collection('reservations')
      .where('locationId', '==', locationId)
      .where('date', '==', date)
      .get();

    for (const room of rooms) {
      for (const docSnap of conflictSnap.docs) {
        const res = docSnap.data();
        if (res.roomId !== room.id || res.status === 'declined') continue;
        const resStart = timeToMinutes(res.time as string);
        const resEnd = resStart + (res.duration as number) * 60;
        if (Math.max(newStart, resStart) < Math.min(newEnd, resEnd)) {
          throw new HttpsError(
            'already-exists',
            `Conflict in ${room.name || room.id}.`,
          );
        }
      }
    }
  }

  const now = Date.now();
  const status =
    autoApprove || actingStaff ? 'approved' : rooms.length === 0 ? 'approved' : 'pending';

  const reservationIds: string[] = [];

  await db.runTransaction(async (txn) => {
    let balanceAfter = (userData?.credits as number) ?? 0;

    if (paymentMethod === 'credits' && totalPrice > 0) {
      const freshUser = await txn.get(userRef);
      const credits = (freshUser.data()?.credits as number) ?? 0;
      if (credits < totalPrice) {
        throw new HttpsError('failed-precondition', 'Insufficient credits.');
      }
      balanceAfter = credits - totalPrice;
      txn.update(userRef, { credits: balanceAfter });
    }

    if (rooms.length === 0) {
      const id = `res-${now}-takeaway`;
      reservationIds.push(id);
      txn.set(db.collection('reservations').doc(id), {
        id,
        userId,
        roomId: 'none',
        locationId,
        floorId: floorId || 'none',
        vendorId,
        date,
        time,
        duration: 0,
        userName,
        userEmail,
        status: 'approved',
        createdAt: now,
        selectedMenuItems: selectedMenuItems || [],
        totalOrderComment: totalOrderComment || '',
        totalPrice,
        paymentMethod,
        hasInstorePurchases: true,
      });

      if (paymentMethod === 'credits' && totalPrice > 0) {
        await writeCreditTransaction(txn, {
          userId,
          type: 'debit',
          amount: totalPrice,
          description: `Order at location ${locationId}`,
          category: 'order',
          reservationId: id,
          paymentMethod,
          balanceAfter,
        });
      }
      return;
    }

    const pricePerRoom = totalPrice / rooms.length;
    for (const room of rooms) {
      const id = `res-${now}-${room.id}`;
      reservationIds.push(id);
      txn.set(db.collection('reservations').doc(id), {
        id,
        userId,
        roomId: room.id,
        locationId,
        floorId,
        vendorId,
        date,
        time,
        duration,
        userName,
        userEmail,
        status,
        createdAt: now,
        selectedMenuItems: selectedMenuItems || [],
        totalOrderComment: totalOrderComment || '',
        totalPrice: pricePerRoom,
        paymentMethod,
      });
    }

    if (paymentMethod === 'credits' && totalPrice > 0) {
      const description =
        rooms.length === 1
          ? `Reservation: ${rooms[0].name || rooms[0].id}`
          : `Booking (${rooms.length} rooms)`;
      await writeCreditTransaction(txn, {
        userId,
        type: 'debit',
        amount: totalPrice,
        description,
        category: 'booking',
        reservationId: reservationIds[0],
        paymentMethod,
        balanceAfter,
        metadata: {
          reservationIds,
          rooms: rooms.map((r) => ({ id: r.id, name: r.name })),
        },
      });
    }
  });

  return { reservationIds, totalPrice, status };
});

export const cancelBooking = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to cancel.');
  }

  const reservationId = request.data?.reservationId as string;
  if (!reservationId) {
    throw new HttpsError('invalid-argument', 'reservationId is required.');
  }

  const ref = db.collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Reservation not found.');
  }

  const res = snap.data()!;
  if (res.userId !== request.auth.uid && !isStaff(request.auth)) {
    throw new HttpsError('permission-denied', 'Not allowed to cancel this reservation.');
  }

  await ref.update({ status: 'declined', orderStatus: 'cancelled' });

  return { success: true };
});

export const updateReservationStatus = onCall({ cors: true }, async (request) => {
  if (!isStaff(request.auth)) {
    throw new HttpsError('permission-denied', 'Staff only.');
  }

  const reservationId = request.data?.reservationId as string;
  const status = request.data?.status as string;
  const orderStatus = request.data?.orderStatus as string | undefined;

  if (!reservationId || !status) {
    throw new HttpsError('invalid-argument', 'reservationId and status are required.');
  }

  const ref = db.collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Reservation not found.');
  }

  const updates: Record<string, unknown> = { status };
  if (orderStatus) updates.orderStatus = orderStatus;
  await ref.update(updates);

  return { success: true };
});

export async function lookupStaffBranch(code: string): Promise<{
  vendorId: string;
  locationId: string;
  floorId: string;
  locationName: string;
} | null> {
  const normalized = code.trim().toUpperCase();
  const snap = await db
    .collection('locations')
    .where('staffAccessCode', '==', normalized)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const loc = snap.docs[0].data();
  const floorId = loc.floors?.[0]?.id || '';
  return {
    vendorId: loc.vendorId as string,
    locationId: snap.docs[0].id,
    floorId,
    locationName: loc.name as string,
  };
}

