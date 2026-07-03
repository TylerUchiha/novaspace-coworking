import { onCall } from 'firebase-functions/v2/https';
import { db } from './db';
import seedData from './seed-data.json';

interface SeedData {
  vendors: Record<string, unknown>[];
  locations: Record<string, unknown>[];
}

const catalog = seedData as SeedData;

export const seedCatalog = onCall({ cors: true }, async () => {
  const metaRef = db.doc('meta/catalog');
  const metaSnap = await metaRef.get();

  if (metaSnap.exists && metaSnap.data()?.seeded === true) {
    return { seeded: false, message: 'Catalog already seeded.' };
  }

  const batch = db.batch();

  for (const vendor of catalog.vendors) {
    const id = vendor.id as string;
    batch.set(db.collection('vendors').doc(id), vendor, { merge: true });
  }

  for (const location of catalog.locations) {
    const id = location.id as string;
    batch.set(db.collection('locations').doc(id), location, { merge: true });
  }

  batch.set(metaRef, { seeded: true, seededAt: Date.now() });

  await batch.commit();

  return {
    seeded: true,
    vendors: catalog.vendors.length,
    locations: catalog.locations.length,
  };
});

/** Auto-seed on first health check if catalog is empty (dev convenience). */
export async function ensureCatalogSeeded(): Promise<boolean> {
  const metaSnap = await db.doc('meta/catalog').get();
  if (metaSnap.exists && metaSnap.data()?.seeded === true) {
    return false;
  }

  const vendorSnap = await db.collection('vendors').limit(1).get();
  if (!vendorSnap.empty) {
    await db.doc('meta/catalog').set({ seeded: true, seededAt: Date.now() }, { merge: true });
    return false;
  }

  const batch = db.batch();
  for (const vendor of catalog.vendors) {
    batch.set(db.collection('vendors').doc(vendor.id as string), vendor, { merge: true });
  }
  for (const location of catalog.locations) {
    batch.set(db.collection('locations').doc(location.id as string), location, { merge: true });
  }
  batch.set(db.doc('meta/catalog'), { seeded: true, seededAt: Date.now() });
  await batch.commit();
  return true;
}
