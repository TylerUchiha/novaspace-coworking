import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { db } from './db';

export async function assertStaffAuth(
  auth: CallableRequest['auth'],
): Promise<{ uid: string; role: 'owner' | 'employee' }> {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to continue.');
  }

  const tokenRole = auth.token.role;
  if (tokenRole === 'owner' || tokenRole === 'employee') {
    return { uid: auth.uid, role: tokenRole };
  }

  const userSnap = await db.collection('users').doc(auth.uid).get();
  const docRole = userSnap.data()?.role;
  if (docRole === 'owner' || docRole === 'employee') {
    return { uid: auth.uid, role: docRole };
  }

  throw new HttpsError('permission-denied', 'Staff access required.');
}
