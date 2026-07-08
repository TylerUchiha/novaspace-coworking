const CANCELLATION_REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface CancellationReservation {
  date?: string;
  time?: string;
}

export function parseReservationStartMs(date?: string, time?: string): number | null {
  if (!date || !time) return null;

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute = 0] = time.split(':').map(Number);

  if (!year || !month || !day || Number.isNaN(hour)) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

export function shouldRefundCancellation(
  reservation: CancellationReservation,
  cancelledAtMs: number = Date.now(),
): boolean {
  const startMs = parseReservationStartMs(reservation.date, reservation.time);
  if (!startMs) return false;

  return startMs - cancelledAtMs >= CANCELLATION_REFUND_WINDOW_MS;
}

export function isUserCancellationAllowed(
  reservation: CancellationReservation,
  cancelledAtMs: number = Date.now(),
): { allowed: boolean; reason?: string } {
  const startMs = parseReservationStartMs(reservation.date, reservation.time);
  if (!startMs) {
    return { allowed: false, reason: 'Invalid booking time.' };
  }

  if (startMs - cancelledAtMs < CANCELLATION_REFUND_WINDOW_MS) {
    return {
      allowed: false,
      reason:
        'Cancellations within 24 hours of the booking start time are non-refundable and cannot be cancelled online. Contact support@novaspace.work for assistance.',
    };
  }

  return { allowed: true };
}
