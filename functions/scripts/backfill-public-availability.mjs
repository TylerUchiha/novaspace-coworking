/**
 * One-time backfill for publicAvailability slots from existing reservations.
 * Usage: npm --prefix functions run backfill:availability
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { backfillAllPublicAvailability } from '../lib/publicAvailability.js';

if (!getApps().length) {
  initializeApp({ projectId: 'refined-legend-420223' });
}

const result = await backfillAllPublicAvailability();
console.log('Backfill complete:', result);
