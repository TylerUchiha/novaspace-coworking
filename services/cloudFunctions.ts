import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import { Reservation, UserProfile } from '../types';
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

export async function saveCatalogLocationRemote(
  location: Record<string, unknown>,
): Promise<{ success: boolean; id: string }> {
  const fn = httpsCallable<{ location: Record<string, unknown> }, { success: boolean; id: string }>(
    functions,
    'saveCatalogLocation',
  );
  const result = await fn({ location });
  return result.data;
}

export async function saveCatalogVendorRemote(
  vendor: Record<string, unknown>,
): Promise<{ success: boolean; id: string }> {
  const fn = httpsCallable<{ vendor: Record<string, unknown> }, { success: boolean; id: string }>(
    functions,
    'saveCatalogVendor',
  );
  const result = await fn({ vendor });
  return result.data;
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
  status?: Reservation['status'],
  orderStatus?: Reservation['orderStatus'],
): Promise<{ success: boolean }> {
  const fn = httpsCallable<
    { reservationId: string; status?: string; orderStatus?: string },
    { success: boolean }
  >(functions, 'updateReservationStatus');
  const result = await fn({ reservationId, status, orderStatus });
  return result.data;
}

export async function getStaffAccessCodeRemote(locationId: string): Promise<{ code: string }> {
  const fn = httpsCallable<{ locationId: string }, { code: string }>(functions, 'getStaffAccessCode');
  const result = await fn({ locationId });
  return result.data;
}

export async function appendReservationOrderRemote(input: {
  reservationId: string;
  menuItems: { itemId: string; quantity: number; comment?: string; deliveryTime?: string }[];
  totalPrice: number;
  orderComment?: string;
  paymentMethod?: string;
}): Promise<{ success: boolean }> {
  const fn = httpsCallable<typeof input, { success: boolean }>(functions, 'appendReservationOrder');
  const result = await fn(input);
  return result.data;
}

export async function syncReservationUserNameRemote(
  name: string,
  userId?: string,
): Promise<{ success: boolean; updated: number }> {
  const fn = httpsCallable<{ name: string; userId?: string }, { success: boolean; updated: number }>(
    functions,
    'syncReservationUserName',
  );
  const result = await fn({ name, userId });
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
  shouldApplyFilters: boolean;
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

export interface SubmitSupportInquiryInput {
  name: string;
  number: string;
  email: string;
  inquiry: string;
}

export async function submitSupportInquiryRemote(
  input: SubmitSupportInquiryInput,
): Promise<{ success: boolean }> {
  const fn = httpsCallable<SubmitSupportInquiryInput, { success: boolean }>(
    functions,
    'submitSupportInquiry',
  );
  const result = await fn(input);
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

export interface CreateWalkInMemberInput {
  name: string;
  email: string;
  phone: string;
}

export interface CreateWalkInMemberResult {
  uid: string;
  profile: UserProfile;
  created: boolean;
}

export async function createWalkInMemberRemote(
  input: CreateWalkInMemberInput,
): Promise<CreateWalkInMemberResult> {
  const fn = httpsCallable<CreateWalkInMemberInput, CreateWalkInMemberResult>(
    functions,
    'createWalkInMember',
  );
  const result = await fn(input);
  return result.data;
}

export async function verifyRecaptchaRemote(token: string): Promise<{ success: boolean }> {
  const fn = httpsCallable<{ token: string }, { success: boolean }>(functions, 'verifyRecaptcha');
  const result = await fn({ token });
  return result.data;
}

export async function adminDeleteUserRemote(
  targetUserId: string,
): Promise<{ success: boolean; targetUserId: string }> {
  const fn = httpsCallable<{ targetUserId: string }, { success: boolean; targetUserId: string }>(
    functions,
    'adminDeleteUser',
  );
  const result = await fn({ targetUserId });
  return result.data;
}

export async function confirmPhoneVerifiedRemote(
  phoneDigits: string,
): Promise<{ success: boolean; phone: string; phoneVerified: true }> {
  const fn = httpsCallable<
    { phoneDigits: string },
    { success: boolean; phone: string; phoneVerified: true }
  >(functions, 'confirmPhoneVerified');
  const result = await fn({ phoneDigits });
  return result.data;
}

export async function deleteMyAccountRemote(): Promise<{ success: boolean }> {
  const fn = httpsCallable<void, { success: boolean }>(functions, 'deleteMyAccount');
  const result = await fn();
  return result.data;
}

const FUNCTIONS_PROJECT_ID = 'refined-legend-420223';
const FUNCTIONS_REGION = 'us-central1';

export const functionsHealthUrl =
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
    ? `http://127.0.0.1:5001/${FUNCTIONS_PROJECT_ID}/${FUNCTIONS_REGION}/health`
    : `https://${FUNCTIONS_REGION}-${FUNCTIONS_PROJECT_ID}.cloudfunctions.net/health`;
