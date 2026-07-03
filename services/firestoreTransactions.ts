import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { CreditTransaction } from '../types';

function mapTransaction(id: string, data: Record<string, unknown>): CreditTransaction {
  const metadata = data.metadata as Record<string, unknown> | undefined;
  return {
    id,
    userId: data.userId as string,
    type: data.type as 'credit' | 'debit',
    amount: data.amount as number,
    description: data.description as string,
    createdAt: data.createdAt as number,
    category: data.category as CreditTransaction['category'],
    reservationId: data.reservationId as string | undefined,
    paymentMethod: data.paymentMethod as string | undefined,
    balanceAfter: data.balanceAfter as number | undefined,
    roomName: metadata?.roomName as string | undefined,
    locationName: metadata?.locationName as string | undefined,
    floorName: metadata?.floorName as string | undefined,
    duration: metadata?.duration as number | undefined,
    hasInstorePurchases: metadata?.hasInstorePurchases as boolean | undefined,
  };
}

export function subscribeUserTransactions(
  userId: string,
  callback: (transactions: CreditTransaction[]) => void,
): () => void {
  const q = query(
    collection(db, 'users', userId, 'transactions'),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  return onSnapshot(
    q,
    (snap) =>
      callback(
        snap.docs.map((d) => mapTransaction(d.id, d.data() as Record<string, unknown>)),
      ),
    (err) => console.error('subscribeUserTransactions error', err),
  );
}
