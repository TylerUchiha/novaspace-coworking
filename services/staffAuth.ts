import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase';
import { loadStaffAccessCode } from '../constants/auth';
import { validateAccessCodeRemote } from './cloudFunctions';

export async function ensureStaffFirebaseAuth(): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdTokenResult(true);
    if (token.claims.role === 'owner' || token.claims.role === 'employee') {
      return true;
    }
  }

  const code = loadStaffAccessCode();
  if (!code) return false;

  try {
    const result = await validateAccessCodeRemote(code);
    if (!result.customToken) return false;
    await signInWithCustomToken(auth, result.customToken);
    return true;
  } catch (error) {
    console.error('ensureStaffFirebaseAuth failed', error);
    return false;
  }
}
