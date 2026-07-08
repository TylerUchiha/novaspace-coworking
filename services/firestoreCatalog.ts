import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  query,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { LocationData, Vendor } from '../types';
import { seedCatalogRemote, saveCatalogLocationRemote, saveCatalogVendorRemote } from './cloudFunctions';
import { ensureStaffFirebaseAuth } from './staffAuth';

export async function isCatalogEmpty(): Promise<boolean> {
  const snap = await getDocs(query(collection(db, 'vendors'), limit(1)));
  return snap.empty;
}

export async function ensureCatalogSeeded(): Promise<void> {
  if (!(await isCatalogEmpty())) return;
  try {
    await seedCatalogRemote();
  } catch (err) {
    console.warn('Auto-seed failed; using local fallback until seedCatalog runs.', err);
  }
}

export function subscribeVendors(callback: (vendors: Vendor[]) => void): () => void {
  return onSnapshot(
    collection(db, 'vendors'),
    (snap) => {
      const vendors = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Vendor));
      callback(vendors.sort((a, b) => a.name.localeCompare(b.name)));
    },
    (err) => console.error('subscribeVendors error', err),
  );
}

function stripStaffAccessCode<T extends Record<string, unknown>>(data: T): LocationData {
  const { staffAccessCode: _removed, ...rest } = data;
  return rest as unknown as LocationData;
}

export function subscribeLocations(callback: (locations: LocationData[]) => void): () => void {
  return onSnapshot(
    collection(db, 'locations'),
    (snap) => {
      const locations = snap.docs.map((d) =>
        stripStaffAccessCode({ ...d.data(), id: d.id } as Record<string, unknown>),
      );
      callback(locations);
    },
    (err) => console.error('subscribeLocations error', err),
  );
}

export async function saveVendor(vendor: Vendor): Promise<void> {
  const ready = await ensureStaffFirebaseAuth();
  if (!ready) {
    throw new Error('Staff Firebase authentication required to save vendor.');
  }
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    await setDoc(doc(db, 'vendors', vendor.id), vendor, { merge: true });
    return;
  }
  await saveCatalogVendorRemote(vendor as unknown as Record<string, unknown>);
}

export async function saveLocation(location: LocationData): Promise<void> {
  const ready = await ensureStaffFirebaseAuth();
  if (!ready) {
    throw new Error('Staff Firebase authentication required to save location.');
  }
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    const { staffAccessCode: _removed, ...publicLocation } = location as LocationData & {
      staffAccessCode?: string;
    };
    await setDoc(doc(db, 'locations', location.id), publicLocation, { merge: true });
    return;
  }
  await saveCatalogLocationRemote(location as unknown as Record<string, unknown>);
}
