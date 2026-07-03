
export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  MAINTENANCE = 'MAINTENANCE',
  SELECTED = 'SELECTED'
}

export type RoomType = 'Private' | 'Meeting' | 'Lounge' | 'HotDesk' | 'Service';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  status: RoomStatus;
  amenities: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  pricePerHour: number;
  images?: string[];
  categories?: Category[];
  menu?: MenuItem[];
}

export interface Floor {
  id: string;
  name: string;
  rooms: Room[];
}

export interface LocationData {
  id: string;
  vendorId: string;
  name: string;
  description?: string;
  image?: string;
  mapUrl?: string;
  address?: string;
  floors: Floor[];
  tags?: string[];
  city?: string;
  staffAccessCode?: string;
  cancellationPolicy?: string;
  categories?: Category[];
  menu?: MenuItem[];
}

export interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
  name?: string;
}

export type CreditTransactionCategory = 'top_up' | 'booking' | 'refund' | 'order' | 'initial';

export interface CreditTransaction {
  id: string;
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: number;
  category: CreditTransactionCategory;
  reservationId?: string;
  paymentMethod?: string;
  balanceAfter?: number;
  roomName?: string;
  locationName?: string;
  floorName?: string;
  duration?: number;
  hasInstorePurchases?: boolean;
}

export interface UserProfile {
  uid?: string;
  name: string;
  role: string;
  email: string;
  pfp: string;
  phone?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  credits: number; // In EGP
  paymentMethods?: PaymentMethod[];
  profession?: string;
  createdAt?: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  image?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string; // This will still store the category ID or name for reference
  image?: string;
}

export interface Vendor {
  id: string;
  name: string;
  logo: string;
  description: string;
  color: string;
  locationCount: number;
  access?: string;
  cancellationPolicy?: string;
  categories?: Category[];
  menu?: MenuItem[];
  tags?: string[];
}

export interface Reservation {
  id: string;
  userId?: string;
  roomId: string;
  locationId: string;
  floorId: string;
  vendorId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:00
  duration: number; // Hours
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'declined';
  orderStatus?: 'pending' | 'confirmed' | 'cancelled';
  createdAt: number; // Unix timestamp for analytics
  selectedMenuItems?: { itemId: string; quantity: number; comment?: string; deliveryTime?: string }[];
  totalOrderComment?: string;
  totalPrice?: number;
  paymentMethod?: string;
}

export interface EmployeeShift {
  id: string;
  startTime: number;
  endTime: number | null;
  breaks: { start: number; end: number | null }[];
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  pfp: string;
  pinCode: string;
  shifts: EmployeeShift[];
}

export interface AIRecommendation {
  roomId: string;
  reasoning: string;
}
