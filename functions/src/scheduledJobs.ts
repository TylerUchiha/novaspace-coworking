import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { db } from './db';
import { sendPushToTokens } from './notifications';
import { recordAnalyticsEvent } from './transactionHelpers';
import { sendUserEmailIfEnabled } from './emailNotifications';

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function reservationStartMs(date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const mins = timeToMinutes(time);
  const dt = new Date(y, (mo || 1) - 1, d || 1, Math.floor(mins / 60), mins % 60, 0, 0);
  return dt.getTime();
}

/** Decline pending bookings whose start time has passed. */
export const autoDeclineExpiredPending = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'Africa/Cairo' },
  async () => {
    const now = Date.now();
    const snap = await db.collection('reservations').where('status', '==', 'pending').get();
    let declined = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const startMs = reservationStartMs(data.date as string, data.time as string);
      if (startMs <= now) {
        await docSnap.ref.update({ status: 'declined', autoDeclinedAt: now });
        declined++;
      }
    }

    if (declined > 0) {
      await recordAnalyticsEvent('auto_decline_batch', { count: declined });
    }
    logger.info('autoDeclineExpiredPending', { declined });
  },
);

/** Send reminders ~1 hour before approved bookings. */
export const sendBookingReminders = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'Africa/Cairo' },
  async () => {
    const now = Date.now();
    const windowStart = now + 45 * 60 * 1000;
    const windowEnd = now + 75 * 60 * 1000;

    const snap = await db.collection('reservations').where('status', '==', 'approved').get();
    let sent = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.reminderSentAt) continue;

      const startMs = reservationStartMs(data.date as string, data.time as string);
      if (startMs >= windowStart && startMs <= windowEnd && data.userId) {
        const userEmail = data.userEmail as string | undefined;
        const subject = 'NovaSpace — booking reminder';
        const lines = [
          `Hi ${(data.userName as string) || 'there'},`,
          `Reminder: your booking on ${data.date} at ${data.time} starts in about an hour.`,
        ];
        const text = [subject, '', ...lines, '', '— NovaSpace'].join('\n');
        const html = `
          <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
            <h2 style="color:#0f172a;margin:0 0 16px;font-size:22px;">Booking reminder</h2>
            ${lines.map((line) => `<p style="margin:0 0 12px;color:#475569;line-height:1.6;">${line}</p>`).join('')}
          </div>
        `;
        const emailed = await sendUserEmailIfEnabled(
          data.userId as string,
          userEmail,
          subject,
          html,
          text,
        );
        if (emailed) {
          await docSnap.ref.update({ reminderSentAt: now });
          sent++;
        }
      }
    }

    logger.info('sendBookingReminders', { sent });
  },
);

/** Notify staff with upcoming shifts (within 30 minutes). */
export const sendShiftReminders = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'Africa/Cairo' },
  async () => {
    const now = Date.now();
    const windowEnd = now + 30 * 60 * 1000;

    const empSnap = await db.collection('employees').get();
    let sent = 0;

    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      const shifts = (emp.shifts as Array<{
        id: string;
        startTime: number;
        endTime: number | null;
        reminderSentAt?: number;
      }>) || [];

      for (const shift of shifts) {
        if (shift.endTime) continue;
        if (shift.startTime < now || shift.startTime > windowEnd) continue;
        if (shift.reminderSentAt) continue;

        const staffUserSnap = await db
          .collection('users')
          .where('role', 'in', ['employee', 'owner'])
          .limit(20)
          .get();

        const tokens: string[] = [];
        for (const u of staffUserSnap.docs) {
          const tokenSnap = await u.ref.collection('fcmTokens').get();
          tokenSnap.docs.forEach((t) => {
            const token = t.data().token as string;
            if (token) tokens.push(token);
          });
        }

        if (tokens.length > 0) {
          await sendPushToTokens(
            tokens,
            'Shift starting soon',
            `${emp.name}'s shift starts in less than 30 minutes.`,
            { type: 'shift_reminder', employeeId: empDoc.id },
          );
        }

        await empDoc.ref.update({
          shifts: shifts.map((s) =>
            s.id === shift.id ? { ...s, reminderSentAt: now } : s,
          ),
        });
        sent++;
      }
    }

    logger.info('sendShiftReminders', { sent });
  },
);

/** Daily rollup for custom analytics dashboards. */
export const dailyAnalyticsRollup = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'Africa/Cairo' },
  async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = yesterday.toISOString().split('T')[0];
    const dayStart = new Date(`${dateKey}T00:00:00`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const [resSnap, eventsSnap, usersSnap] = await Promise.all([
      db.collection('reservations').where('date', '==', dateKey).get(),
      db
        .collection('analytics_events')
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<', dayEnd)
        .get(),
      db
        .collection('users')
        .where('role', '==', 'customer')
        .get(),
    ]);

    let revenue = 0;
    let bookings = 0;
    let approved = 0;
    let pending = 0;
    let declined = 0;

    resSnap.docs.forEach((d) => {
      const r = d.data();
      bookings++;
      revenue += (r.totalPrice as number) || 0;
      if (r.status === 'approved') approved++;
      else if (r.status === 'pending') pending++;
      else if (r.status === 'declined') declined++;
    });

    const eventCounts: Record<string, number> = {};
    eventsSnap.docs.forEach((d) => {
      const name = d.data().eventName as string;
      eventCounts[name] = (eventCounts[name] || 0) + 1;
    });

    const signUps = usersSnap.docs.filter((d) => {
      const created = d.data().createdAt as number | undefined;
      return created && created >= dayStart && created < dayEnd;
    }).length;

    let topUpTotal = 0;
    let topUpCount = 0;
    for (const userDoc of usersSnap.docs) {
      const txSnap = await userDoc.ref
        .collection('transactions')
        .where('category', '==', 'top_up')
        .where('createdAt', '>=', dayStart)
        .where('createdAt', '<', dayEnd)
        .get();
      txSnap.docs.forEach((t) => {
        topUpCount++;
        topUpTotal += (t.data().amount as number) || 0;
      });
    }

    await db.collection('analytics_daily').doc(dateKey).set({
      date: dateKey,
      bookings,
      approved,
      pending,
      declined,
      revenue,
      signUps,
      topUpCount,
      topUpTotal,
      eventCounts,
      rolledUpAt: Date.now(),
    });

    logger.info('dailyAnalyticsRollup', { dateKey, bookings, revenue });
  },
);
