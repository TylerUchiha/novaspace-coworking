import { onCall } from 'firebase-functions/v2/https';
import { db } from './db';
import seedData from './seed-data.json';
import { syncStaffAccessCodeForLocation } from './staffAccessCodes';

interface SeedData {
  vendors: Record<string, unknown>[];
  locations: Record<string, unknown>[];
}

const catalog = seedData as SeedData;

async function writeSeedCatalog(): Promise<{ vendors: number; locations: number }> {
  const batch = db.batch();

  for (const vendor of catalog.vendors) {
    const id = vendor.id as string;
    batch.set(db.collection('vendors').doc(id), vendor, { merge: true });
  }

  for (const location of catalog.locations) {
    const id = location.id as string;
    const staffAccessCode =
      typeof location.staffAccessCode === 'string' ? location.staffAccessCode : undefined;
    const { staffAccessCode: _removed, ...publicLocation } = location;

    batch.set(db.collection('locations').doc(id), publicLocation, { merge: true });

    if (staffAccessCode?.trim()) {
      await syncStaffAccessCodeForLocation({
        locationId: id,
        vendorId: location.vendorId as string,
        floorId: ((location.floors as { id?: string }[] | undefined)?.[0]?.id) || '',
        locationName: location.name as string,
        code: staffAccessCode,
      });
    }
  }

  batch.set(db.doc('meta/catalog'), { seeded: true, seededAt: Date.now() });

  await batch.commit();

  return {
    vendors: catalog.vendors.length,
    locations: catalog.locations.length,
  };
}

export const seedCatalog = onCall({ cors: true }, async () => {
  const metaRef = db.doc('meta/catalog');
  const metaSnap = await metaRef.get();

  if (metaSnap.exists && metaSnap.data()?.seeded === true) {
    return { seeded: false, message: 'Catalog already seeded.' };
  }

  const counts = await writeSeedCatalog();

  return {
    seeded: true,
    vendors: counts.vendors,
    locations: counts.locations,
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

  await writeSeedCatalog();
  return true;
}
