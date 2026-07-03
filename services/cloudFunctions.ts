import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import { Reservation } from '../types';
import { traceAsync } from './firebaseMonitoring';

export type AccessCodeResult = {
  role: 'owner' | 'employee';
  customToken?: string;
  branch?: {
    vendorId: string;
    locationId: string;
    floorId: string;
    locationName: string;
  };
};

export interface CreateBookingInput {
  rooms?: { id: string; name: string; pricePerHour: number }[];
  locationId: string;
  floorId: string;
  vendorId: string;
  date: string;
  time: string;
  duration: number;
  paymentMethod: string;
  selectedMenuItems?: { itemId: string; quantity: number; comment?: string; deliveryTime?: string }[];
  totalOrderComment?: string;
  totalPrice?: number;
  targetUserId?: string;
  targetUserName?: string;
  targetUserEmail?: string;
  autoApprove?: boolean;
}

export interface CreateBookingResult {
  reservationIds: string[];
  totalPrice: number;
  status: string;
}

const functions = getFunctions(app, 'us-central1');

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && typeof window !== 'undefined') {
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

const validateAccessCodeFn = httpsCallable<{ code: string }, AccessCodeResult>(
  functions,
  'validateAccessCode',
);

export async function validateAccessCodeRemote(code: string): Promise<AccessCodeResult> {
  const result = await validateAccessCodeFn({ code });
  return result.data;
}

export async function seedCatalogRemote(): Promise<{ seeded: boolean; message?: string }> {
  const fn = httpsCallable(functions, 'seedCatalog');
  const result = await fn({});
  return result.data as { seeded: boolean; message?: string };
}

export async function createBookingRemote(input: CreateBookingInput): Promise<CreateBookingResult> {
  const fn = httpsCallable<CreateBookingInput, CreateBookingResult>(functions, 'createBooking');
  const result = await fn(input);
  return result.data;
}

export async function cancelBookingRemote(reservationId: string): Promise<{ success: boolean }> {
  const fn = httpsCallable<{ reservationId: string }, { success: boolean }>(functions, 'cancelBooking');
  const result = await fn({ reservationId });
  return result.data;
}

export async function updateReservationStatusRemote(
  reservationId: string,
  status: Reservation['status'],
  orderStatus?: Reservation['orderStatus'],
): Promise<{ success: boolean }> {
  const fn = httpsCallable<
    { reservationId: string; status: string; orderStatus?: string },
    { success: boolean }
  >(functions, 'updateReservationStatus');
  const result = await fn({ reservationId, status, orderStatus });
  return result.data;
}

export interface NovaBotChatInput {
  userPrompt: string;
  locations: Array<{
    id: string;
    name: string;
    city?: string;
    description?: string;
    tags?: string[];
  }>;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  allAvailableTags?: string[];
  allAvailableCities?: string[];
  userName?: string;
  userProfession?: string;
}

export interface NovaBotChatResult {
  reply: string;
  matchingLocationIds: string[];
  matchingTags: string[];
  matchingCities: string[];
  filterAction: 'replace' | 'append';
}

export async function novaBotChatRemote(input: NovaBotChatInput): Promise<NovaBotChatResult> {
  return traceAsync('nova_bot_chat', async () => {
    const fn = httpsCallable<NovaBotChatInput, NovaBotChatResult>(functions, 'novaBotChat');
    const result = await fn(input);
    return result.data;
  });
}

export async function supportChatRemote(message: string): Promise<{ reply: string }> {
  const fn = httpsCallable<{ message: string }, { reply: string }>(functions, 'supportChat');
  const result = await fn({ message });
  return result.data;
}

export async function topUpCreditsRemote(amount: number): Promise<{ success: boolean; newBalance: number; txId: string }> {
  const fn = httpsCallable<{ amount: number }, { success: boolean; newBalance: number; txId: string }>(
    functions,
    'topUpCredits',
  );
  const result = await fn({ amount });
  return result.data;
}

export async function registerFcmTokenRemote(token: string, platform = 'web'): Promise<{ success: boolean }> {
  const fn = httpsCallable<{ token: string; platform?: string }, { success: boolean }>(
    functions,
    'registerFcmToken',
  );
  const result = await fn({ token, platform });
  return result.data;
}

export async function unregisterFcmTokenRemote(token: string): Promise<{ success: boolean }> {
  const fn = httpsCallable<{ token: string }, { success: boolean }>(functions, 'unregisterFcmToken');
  const result = await fn({ token });
  return result.data;
}

export const functionsHealthUrl =
  'https://us-central1-refined-legend-420223.cloudfunctions.net/health';
