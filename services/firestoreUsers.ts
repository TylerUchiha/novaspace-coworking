import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';

export function subscribeAllUsers(callback: (users: UserProfile[]) => void): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const users = snap.docs
        .map((d) => ({ ...d.data(), uid: d.id } as UserProfile))
        .filter((u) => u.role !== 'owner' && u.role !== 'employee');
      callback(users.sort((a, b) => a.name.localeCompare(b.name)));
    },
    (err) => console.error('subscribeAllUsers error', err),
  );
}
