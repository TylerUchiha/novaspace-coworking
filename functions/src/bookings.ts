import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './db';
import { writeCreditTransaction } from './transactionHelpers';
import { isUserCancellationAllowed } from './cancellationPolicy';

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
    if (!selfSnap.exists) {
      throw new HttpsError('failed-precondition', 'Complete your profile before booking.');
    }
    const selfData = selfSnap.data();
    if (selfData?.emailVerified !== true) {
      throw new HttpsError('failed-precondition', 'Verify your email before booking.');
    }
    if (selfData?.phoneVerified !== true) {
      throw new HttpsError('failed-precondition', 'Verify your phone number before booking.');
    }
  }

  const bookingNow = Date.now();
  const userId =
    actingStaff && targetUserId
      ? targetUserId
      : actingStaff && (targetUserEmail || targetUserName)
        ? `guest-${bookingNow}`
        : request.auth.uid;
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

  const cancelledAt = Date.now();
  const isUserCancel = res.userId === request.auth.uid && !isStaff(request.auth);

  if (isUserCancel) {
    const eligibility = isUserCancellationAllowed(
      { date: res.date as string, time: res.time as string },
      cancelledAt,
    );
    if (!eligibility.allowed) {
      throw new HttpsError('failed-precondition', eligibility.reason ?? 'Cancellation not allowed.');
    }
  }

  await ref.update({
    status: 'declined',
    orderStatus: 'cancelled',
    cancelledAt,
    cancelledBy: isUserCancel ? 'user' : 'staff',
  });

  return { success: true };
});

export const updateReservationStatus = onCall({ cors: true }, async (request) => {
  if (!isStaff(request.auth)) {
    throw new HttpsError('permission-denied', 'Staff only.');
  }

  const reservationId = request.data?.reservationId as string;
  const status = request.data?.status as string | undefined;
  const orderStatus = request.data?.orderStatus as string | undefined;

  if (!reservationId || (!status && !orderStatus)) {
    throw new HttpsError(
      'invalid-argument',
      'reservationId and at least one of status or orderStatus are required.',
    );
  }

  const ref = db.collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Reservation not found.');
  }

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (orderStatus) updates.orderStatus = orderStatus;
  if (status === 'declined') {
    updates.cancelledAt = Date.now();
    updates.cancelledBy = 'staff';
  }
  await ref.update(updates);

  return { success: true };
});

export const appendReservationOrder = onCall({ cors: true }, async (request) => {
  if (!isStaff(request.auth)) {
    throw new HttpsError('permission-denied', 'Staff only.');
  }

  const reservationId = request.data?.reservationId as string;
  const menuItems = request.data?.menuItems as MenuItemInput[] | undefined;
  const totalPrice = request.data?.totalPrice as number | undefined;
  const orderComment = request.data?.orderComment as string | undefined;
  const paymentMethod = request.data?.paymentMethod as string | undefined;

  if (!reservationId || !menuItems?.length || totalPrice === undefined) {
    throw new HttpsError('invalid-argument', 'reservationId, menuItems, and totalPrice are required.');
  }

  const ref = db.collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Reservation not found.');
  }

  const res = snap.data()!;
  const userId = res.userId as string | undefined;
  const userEmail = res.userEmail as string | undefined;

  await db.runTransaction(async (txn) => {
    const fresh = await txn.get(ref);
    if (!fresh.exists) {
      throw new HttpsError('not-found', 'Reservation not found.');
    }
    const data = fresh.data()!;
    const existingItems = (data.selectedMenuItems as MenuItemInput[]) || [];
    const existingComment = (data.totalOrderComment as string) || '';
    const existingTotal = (data.totalPrice as number) || 0;

    let balanceAfter: number | undefined;

    if (paymentMethod === 'credits' && totalPrice > 0 && userId) {
      const userRef = db.collection('users').doc(userId);
      const userSnap = await txn.get(userRef);
      const credits = (userSnap.data()?.credits as number) ?? 0;
      if (credits < totalPrice) {
        throw new HttpsError('failed-precondition', 'Insufficient credits.');
      }
      balanceAfter = credits - totalPrice;
      txn.update(userRef, { credits: balanceAfter });
    }

    txn.update(ref, {
      selectedMenuItems: [...existingItems, ...menuItems],
      totalOrderComment: existingComment
        ? `${existingComment}\n${orderComment || ''}`.trim()
        : orderComment || '',
      hasInstorePurchases: true,
      totalPrice: existingTotal + totalPrice,
    });

    if (paymentMethod === 'credits' && totalPrice > 0 && userId && balanceAfter !== undefined) {
      await writeCreditTransaction(txn, {
        userId,
        type: 'debit',
        amount: totalPrice,
        description: `Add-on order for reservation ${reservationId}`,
        category: 'order',
        reservationId,
        paymentMethod,
        balanceAfter,
      });
    }
  });

  return { success: true, userEmail };
});

export const syncReservationUserName = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const newName = request.data?.name as string | undefined;
  const targetUserId = (request.data?.userId as string | undefined) || request.auth.uid;

  if (!newName?.trim()) {
    throw new HttpsError('invalid-argument', 'name is required.');
  }

  if (targetUserId !== request.auth.uid && !isStaff(request.auth)) {
    throw new HttpsError('permission-denied', 'Not allowed to update this user.');
  }

  const snap = await db.collection('reservations').where('userId', '==', targetUserId).get();
  if (snap.empty) {
    return { success: true, updated: 0 };
  }

  const batch = db.batch();
  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { userName: newName.trim() });
  });
  await batch.commit();

  return { success: true, updated: snap.size };
});

export { lookupStaffBranch } from './staffAccessCodes';

