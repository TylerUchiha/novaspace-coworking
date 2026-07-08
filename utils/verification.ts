import { User } from 'firebase/auth';
import { UserProfile } from '../types';
import { normalizePhoneDigits } from '../services/phoneVerification';

export function isEmailVerified(profile: UserProfile | null | undefined): boolean {
  return profile?.emailVerified === true;
}

export function isPhoneVerified(
  profile: UserProfile | null | undefined,
  firebaseUser: User | null | undefined,
): boolean {
  if (profile?.phoneVerified === true) return true;
  const authDigits = normalizePhoneDigits(firebaseUser?.phoneNumber ?? undefined);
  const profileDigits = normalizePhoneDigits(profile?.phone);
  return !!authDigits && !!profileDigits && authDigits === profileDigits;
}

export function isContactVerified(
  profile: UserProfile | null | undefined,
  firebaseUser: User | null | undefined,
): boolean {
  return isEmailVerified(profile) && isPhoneVerified(profile, firebaseUser);
}

export function contactVerificationMessage(
  profile: UserProfile | null | undefined,
  firebaseUser: User | null | undefined,
): string | null {
  const emailOk = isEmailVerified(profile);
  const phoneOk = isPhoneVerified(profile, firebaseUser);
  if (emailOk && phoneOk) return null;
  const parts: string[] = [];
  if (!emailOk) parts.push('email');
  if (!phoneOk) parts.push('phone');
  return `Verify your ${parts.join(' and ')} before booking.`;
}
