import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { db } from './db';
import { notifyUser } from './notifications';
import { queueEmail, recordAnalyticsEvent } from './transactionHelpers';

const FIRESTORE_DATABASE_ID =
  'ai-studio-novaspacecoworki-863fc540-4213-48e8-8f94-f914c1f6fe77';

interface ReservationData {
  id?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  status?: string;
  orderStatus?: string;
  date?: string;
  time?: string;
  duration?: number;
  roomId?: string;
  locationId?: string;
  vendorId?: string;
  totalPrice?: number;
  paymentMethod?: string;
}

function reservationLabel(data: ReservationData): string {
  if (data.roomId === 'none') return 'takeaway order';
  return `booking on ${data.date} at ${data.time}`;
}

function buildStatusEmail(
  data: ReservationData,
  kind: 'created' | 'approved' | 'declined' | 'order_ready',
): { subject: string; html: string; text: string } {
  const label = reservationLabel(data);
  const subjects: Record<typeof kind, string> = {
    created: 'NovaSpace — booking received',
    approved: 'NovaSpace — booking approved',
    declined: 'NovaSpace — booking update',
    order_ready: 'NovaSpace — your order is ready',
  };
  const bodies: Record<typeof kind, string> = {
    created: `Hi ${data.userName || 'there'},\n\nWe received your ${label}. Status: ${data.status}.`,
    approved: `Hi ${data.userName || 'there'},\n\nYour ${label} has been approved.`,
    declined: `Hi ${data.userName || 'there'},\n\nYour ${label} was declined or cancelled.`,
    order_ready: `Hi ${data.userName || 'there'},\n\nYour order is ready for pickup.`,
  };
  const text = bodies[kind];
  return {
    subject: subjects[kind],
    html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
    text,
  };
}

export const onReservationCreated = onDocumentCreated(
  {
    document: 'reservations/{reservationId}',
    database: FIRESTORE_DATABASE_ID,
  },
  async (event) => {
    const data = event.data?.data() as ReservationData | undefined;
    if (!data) return;

    const reservationId = event.params.reservationId;

    await recordAnalyticsEvent('booking_created', {
      reservationId,
      userId: data.userId,
      vendorId: data.vendorId,
      locationId: data.locationId,
      status: data.status,
      totalPrice: data.totalPrice ?? 0,
      paymentMethod: data.paymentMethod ?? 'unknown',
    });

    if (data.userEmail) {
      const email = buildStatusEmail(data, 'created');
      await queueEmail(data.userEmail, email.subject, email.html, email.text);
    }

    if (data.userId && data.status === 'approved') {
      await notifyUser(
        data.userId,
        'Booking confirmed',
        `Your ${reservationLabel(data)} is approved.`,
        { reservationId, type: 'booking_approved' },
      );
    } else if (data.userId && data.status === 'pending') {
      await notifyUser(
        data.userId,
        'Booking submitted',
        `Your ${reservationLabel(data)} is pending approval.`,
        { reservationId, type: 'booking_pending' },
      );
    }

    logger.info('onReservationCreated', { reservationId, status: data.status });
  },
);

export const onReservationUpdated = onDocumentUpdated(
  {
    document: 'reservations/{reservationId}',
    database: FIRESTORE_DATABASE_ID,
  },
  async (event) => {
    const before = event.data?.before.data() as ReservationData | undefined;
    const after = event.data?.after.data() as ReservationData | undefined;
    if (!before || !after) return;

    const reservationId = event.params.reservationId;
    const userId = after.userId;

    if (before.status !== after.status) {
      await recordAnalyticsEvent('booking_status_changed', {
        reservationId,
        userId,
        from: before.status,
        to: after.status,
      });

      if (after.status === 'approved') {
        if (after.userEmail) {
          const email = buildStatusEmail(after, 'approved');
          await queueEmail(after.userEmail, email.subject, email.html, email.text);
        }
        if (userId) {
          await notifyUser(
            userId,
            'Booking approved',
            `Your ${reservationLabel(after)} has been approved.`,
            { reservationId, type: 'booking_approved' },
          );
        }
      } else if (after.status === 'declined') {
        if (after.userEmail) {
          const email = buildStatusEmail(after, 'declined');
          await queueEmail(after.userEmail, email.subject, email.html, email.text);
        }
        if (userId) {
          await notifyUser(
            userId,
            'Booking update',
            `Your ${reservationLabel(after)} was declined or cancelled.`,
            { reservationId, type: 'booking_declined' },
          );
        }

        if (after.paymentMethod === 'credits' && after.totalPrice && userId && before.status !== 'declined') {
          await refundCredits(userId, after.totalPrice, reservationId, after);
        }
      }
    }

    if (before.orderStatus !== after.orderStatus && after.orderStatus === 'confirmed') {
      await recordAnalyticsEvent('order_ready', { reservationId, userId });

      if (after.userEmail) {
        const email = buildStatusEmail(after, 'order_ready');
        await queueEmail(after.userEmail, email.subject, email.html, email.text);
      }
      if (userId) {
        await notifyUser(
          userId,
          'Order ready',
          'Your order is ready for pickup.',
          { reservationId, type: 'order_ready' },
        );
      }
    }

    logger.info('onReservationUpdated', {
      reservationId,
      status: after.status,
      orderStatus: after.orderStatus,
    });
  },
);

async function refundCredits(
  userId: string,
  amount: number,
  reservationId: string,
  data: ReservationData,
): Promise<void> {
  const userRef = db.collection('users').doc(userId);
  const { writeCreditTransaction } = await import('./transactionHelpers');

  await db.runTransaction(async (txn) => {
    const userSnap = await txn.get(userRef);
    const credits = (userSnap.data()?.credits as number) ?? 0;
    const newBalance = credits + amount;
    txn.update(userRef, { credits: newBalance });
    await writeCreditTransaction(txn, {
      userId,
      type: 'credit',
      amount,
      description: `Refund: ${reservationLabel(data)}`,
      category: 'refund',
      reservationId,
      paymentMethod: data.paymentMethod,
      balanceAfter: newBalance,
    });
  });
}
