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
import { seedCatalogRemote } from './cloudFunctions';

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

export function subscribeLocations(callback: (locations: LocationData[]) => void): () => void {
  return onSnapshot(
    collection(db, 'locations'),
    (snap) => {
      const locations = snap.docs.map((d) => ({ ...d.data(), id: d.id } as LocationData));
      callback(locations);
    },
    (err) => console.error('subscribeLocations error', err),
  );
}

export async function saveVendor(vendor: Vendor): Promise<void> {
  await setDoc(doc(db, 'vendors', vendor.id), vendor, { merge: true });
}

export async function saveLocation(location: LocationData): Promise<void> {
  await setDoc(doc(db, 'locations', location.id), location, { merge: true });
}
