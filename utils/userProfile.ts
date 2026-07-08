import { User } from 'firebase/auth';
import { UserProfile } from '../types';

export function normalizeUserProfile(
  profile: UserProfile,
  firebaseUser?: User | null,
): UserProfile {
  const credits =
    typeof profile.credits === 'number' && Number.isFinite(profile.credits)
      ? profile.credits
      : 1000;

  return {
    ...profile,
    credits,
    paymentMethods: profile.paymentMethods ?? [],
    favoritedRoomIds: profile.favoritedRoomIds ?? [],
    role:
      profile.role === 'owner' || profile.role === 'employee'
        ? profile.role
        : 'customer',
    emailVerified:
      profile.emailVerified === true || firebaseUser?.emailVerified === true,
  };
}

export function formatCredits(credits: number | undefined | null): string {
  const value =
    typeof credits === 'number' && Number.isFinite(credits) ? credits : 0;
  return value.toLocaleString();
}
