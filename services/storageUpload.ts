import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

async function uploadFile(path: string, file: File): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function uploadVendorLogo(vendorId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  return uploadFile(`vendors/${vendorId}/logo.${ext}`, file);
}

export async function uploadMenuImage(
  scope: 'vendor' | 'location' | 'room',
  scopeId: string,
  itemId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const prefix = scope === 'vendor' ? 'vendors' : 'locations';
  return uploadFile(`${prefix}/${scopeId}/menu/${itemId}.${ext}`, file);
}

export async function uploadRoomImage(
  locationId: string,
  roomId: string,
  file: File,
  imageId?: string,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const id = imageId || `${roomId}-${Date.now()}`;
  return uploadFile(`locations/${locationId}/rooms/${id}.${ext}`, file);
}
