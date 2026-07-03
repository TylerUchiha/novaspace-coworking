import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID =
  'ai-studio-novaspacecoworki-863fc540-4213-48e8-8f94-f914c1f6fe77';

if (!getApps().length) {
  initializeApp();
}

export const db = getFirestore(FIRESTORE_DATABASE_ID);
