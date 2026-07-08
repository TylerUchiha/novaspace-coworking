import { db } from './db';
import { queueEmail } from './transactionHelpers';

export async function userWantsEmailNotifications(userId?: string): Promise<boolean> {
  if (!userId) return true;
  const snap = await db.collection('users').doc(userId).get();
  return snap.data()?.emailNotificationsEnabled !== false;
}

export async function sendUserEmailIfEnabled(
  userId: string | undefined,
  userEmail: string | undefined,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  if (!userEmail?.trim()) return false;
  if (!(await userWantsEmailNotifications(userId))) return false;
  await queueEmail(userEmail.trim(), subject, html, text);
  return true;
}
