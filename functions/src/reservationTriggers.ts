import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { db } from './db';
import { recordAnalyticsEvent } from './transactionHelpers';
import { sendUserEmailIfEnabled } from './emailNotifications';
import { syncPublicAvailability } from './publicAvailability';
import { shouldRefundCancellation } from './cancellationPolicy';

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
  cancelledAt?: number;
  cancelledBy?: string;
}

function reservationLabel(data: ReservationData): string {
  if (data.roomId === 'none') return 'takeaway order';
  return `booking on ${data.date} at ${data.time}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emailShell(title: string, bodyLines: string[]): { html: string; text: string } {
  const text = [title, '', ...bodyLines, '', '— NovaSpace'].join('\n');
  const htmlBody = bodyLines.map((line) => `<p style="margin:0 0 12px;color:#475569;line-height:1.6;">${escapeHtml(line)}</p>`).join('');
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#0f172a;margin:0 0 16px;font-size:22px;">${escapeHtml(title)}</h2>
      ${htmlBody}
      <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">NovaSpace · novaspace.work</p>
    </div>
  `;
  return { html, text };
}

type ReservationEmailKind =
  | 'order_placed'
  | 'reservation_pending'
  | 'reservation_approved'
  | 'reservation_declined'
  | 'order_ready';

function createdEmailKind(data: ReservationData): ReservationEmailKind {
  if (data.roomId === 'none') return 'order_placed';
  if (data.status === 'pending') return 'reservation_pending';
  return 'reservation_approved';
}

function buildStatusEmail(
  data: ReservationData,
  kind: ReservationEmailKind,
): { subject: string; html: string; text: string } {
  const name = data.userName || 'there';
  const label = reservationLabel(data);
  const detail =
    data.roomId === 'none'
      ? `Total: ${data.totalPrice ?? 0} credits`
      : `${data.date} at ${data.time}${data.duration ? ` · ${data.duration}h` : ''}`;

  const templates: Record<
    ReservationEmailKind,
    { subject: string; lines: string[] }
  > = {
    order_placed: {
      subject: 'NovaSpace — order placed',
      lines: [
        `Hi ${name},`,
        `Your order has been placed and is being prepared.`,
        detail,
        `We will email you when it is ready for pickup.`,
      ],
    },
    reservation_pending: {
      subject: 'NovaSpace — reservation pending',
      lines: [
        `Hi ${name},`,
        `Your workspace reservation is pending approval.`,
        detail,
        `We will notify you as soon as it is confirmed.`,
      ],
    },
    reservation_approved: {
      subject: 'NovaSpace — reservation confirmed',
      lines: [
        `Hi ${name},`,
        `Your ${label} has been confirmed.`,
        detail,
      ],
    },
    reservation_declined: {
      subject: 'NovaSpace — reservation update',
      lines: [
        `Hi ${name},`,
        `Your ${label} was declined or cancelled.`,
        `Contact support if you need help rebooking.`,
      ],
    },
    order_ready: {
      subject: 'NovaSpace — your order is ready',
      lines: [
        `Hi ${name},`,
        `Your order is ready for pickup.`,
        `Please collect it at the service counter.`,
      ],
    },
  };

  const template = templates[kind];
  const { html, text } = emailShell(template.subject.replace('NovaSpace — ', ''), template.lines);
  return { subject: template.subject, html, text };
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
      const email = buildStatusEmail(data, createdEmailKind(data));
      await sendUserEmailIfEnabled(data.userId, data.userEmail, email.subject, email.html, email.text);
    }

    logger.info('onReservationCreated', { reservationId, status: data.status });
    await syncPublicAvailability(reservationId, data);
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
          const email = buildStatusEmail(after, 'reservation_approved');
          await sendUserEmailIfEnabled(userId, after.userEmail, email.subject, email.html, email.text);
        }
      } else if (after.status === 'declined') {
        if (after.userEmail) {
          const email = buildStatusEmail(after, 'reservation_declined');
          await sendUserEmailIfEnabled(userId, after.userEmail, email.subject, email.html, email.text);
        }

        if (
          after.paymentMethod === 'credits' &&
          after.totalPrice &&
          userId &&
          before.status !== 'declined' &&
          shouldRefundCancellation(after, after.cancelledAt ?? Date.now())
        ) {
          await refundCredits(userId, after.totalPrice, reservationId, after);
        }
      }
    }

    if (before.orderStatus !== after.orderStatus && after.orderStatus === 'confirmed') {
      await recordAnalyticsEvent('order_ready', { reservationId, userId });

      if (after.userEmail) {
        const email = buildStatusEmail(after, 'order_ready');
        await sendUserEmailIfEnabled(userId, after.userEmail, email.subject, email.html, email.text);
      }
    }

    logger.info('onReservationUpdated', {
      reservationId,
      status: after.status,
      orderStatus: after.orderStatus,
    });
    await syncPublicAvailability(reservationId, after);
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
