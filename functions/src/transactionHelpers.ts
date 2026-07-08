import { db } from './db';
import { MAIL_FROM, SUPPORT_EMAIL } from './contact';

export type TransactionCategory =
  | 'top_up'
  | 'booking'
  | 'refund'
  | 'order'
  | 'initial';

export interface CreditTransactionInput {
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  category: TransactionCategory;
  reservationId?: string;
  paymentMethod?: string;
  balanceAfter: number;
  metadata?: Record<string, unknown>;
}

export async function writeCreditTransaction(
  txn: FirebaseFirestore.Transaction | null,
  input: CreditTransactionInput,
): Promise<string> {
  const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ref = db.collection('users').doc(input.userId).collection('transactions').doc(txId);
  const data = {
    id: txId,
    userId: input.userId,
    type: input.type,
    amount: input.amount,
    description: input.description,
    category: input.category,
    createdAt: Date.now(),
    balanceAfter: input.balanceAfter,
    ...(input.reservationId ? { reservationId: input.reservationId } : {}),
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  if (txn) {
    txn.set(ref, data);
  } else {
    await ref.set(data);
  }
  return txId;
}

export async function recordAnalyticsEvent(
  eventName: string,
  params: Record<string, unknown>,
): Promise<void> {
  await db.collection('analytics_events').add({
    eventName,
    params,
    createdAt: Date.now(),
  });
}

export async function queueEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!to) return;
  await db.collection('mail').add({
    to,
    from: MAIL_FROM,
    replyTo: SUPPORT_EMAIL,
    message: { subject, html, text },
  });
}
