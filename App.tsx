
import React, { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Room, RoomStatus, Reservation, UserProfile, Vendor, Floor, LocationData, Employee } from './types';
import { LOCATIONS, ROOM_COLORS, INITIAL_RESERVATIONS, VENDORS } from './constants';
import ShiftTimerWidget from './components/ShiftTimerWidget';
import { Building2, Map as MapIcon, MapPin, LogOut, ShieldCheck, Settings, Eye, X, Plus, Search, User, Check, Mail, ChevronLeft, Globe, Calendar, Wallet, Coins, Utensils, ShoppingCart, BarChart3, AlertCircle, Clock, KeyRound, Ban, Star } from 'lucide-react';

import { useAuth } from './components/AuthProvider';
import { useRemoteConfig } from './components/RemoteConfigProvider';
import { loadStaffBranchSession } from './constants/auth';
import { createBookingRemote, cancelBookingRemote, updateReservationStatusRemote, topUpCreditsRemote } from './services/cloudFunctions';
import {
  ensureCatalogSeeded,
  subscribeVendors,
  subscribeLocations,
  saveVendor,
  saveLocation,
} from './services/firestoreCatalog';
import { subscribeAllReservations } from './services/firestoreReservations';
import { subscribeAllUsers } from './services/firestoreUsers';
import { subscribeEmployees, saveEmployee, deleteEmployee } from './services/firestoreEmployees';
import { subscribeUserTransactions } from './services/firestoreTransactions';
import { trackBookingCreated, trackTopUpAttempt, trackTopUpSuccess, trackFeatureUsed } from './services/analytics';
import { CreditTransaction } from './types';
import { normalizePhoneDigits } from './services/phoneVerification';

const RoomDetail = lazy(() => import('./components/RoomDetail'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const VendorSelection = lazy(() => import('./components/VendorSelection'));
const LocationSelection = lazy(() => import('./components/LocationSelection'));
const EmployeeDashboard = lazy(() => import('./components/EmployeeDashboard'));
const PropertyConfig = lazy(() => import('./components/PropertyConfig'));
const ProfilePage = lazy(() => import('./components/ProfilePage'));
const CreateSpacePage = lazy(() => import('./components/CreateSpacePage'));
const MyBookingsPage = lazy(() => import('./components/MyBookingsPage'));
const MenuConfig = lazy(() => import('./components/MenuConfig'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const ShiftRegistryDashboard = lazy(() => import('./components/ShiftRegistryDashboard'));
const PrivacyPage = lazy(() => import('./components/PrivacyPage'));
const TermsPage = lazy(() => import('./components/TermsPage'));
const SupportPage = lazy(() => import('./components/SupportPage'));
const APIStatusPage = lazy(() => import('./components/APIStatusPage'));
const CancellationPoliciesPage = lazy(() => import('./components/CancellationPoliciesPage').then(m => ({ default: m.CancellationPoliciesPage })));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <p className="text-slate-400 font-bold">Loading...</p>
  </div>
);

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const App: React.FC = () => {
  const { user, userProfile, loading, isAuthenticated, enterStaffSession, signInWithAccessCode, signOut, updateUserProfile, profileSyncError } = useAuth();
  const {
    minTopUpAmount,
    featureCreditsTopUpEnabled,
    defaultCancellationPolicyText,
  } = useRemoteConfig();
  const setUserProfile = updateUserProfile;
  const isLoggedIn = isAuthenticated;
  const userRole = (userProfile?.role as 'customer' | 'employee' | 'owner') || null;
  const isStaff = userRole === 'employee' || userRole === 'owner';
  const [allVendors, setAllVendors] = useState<Vendor[]>(VENDORS);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const [favoritedRooms, setFavoritedRooms] = useState<string[]>([]);
  
  // New: Sub-tab state for configuration
  const [configView, setConfigView] = useState<'layout' | 'brand' | 'branch' | 'tags'>('layout');
  const [postLoginAction, setPostLoginAction] = useState<'select_network' | 'edit_profile' | 'create_space' | 'privacy' | 'terms' | 'support' | 'api_status' | null>(null);

  const [clockedInEmployeeIds, setClockedInEmployeeIds] = useState<string[]>([]);

  const [isShiftActive, setIsShiftActive] = useState(false);

  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const [allLocations, setAllLocations] = useState<LocationData[]>(LOCATIONS);
  const [allReservations, setAllReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);

  useEffect(() => {
    let unsubVendors: (() => void) | undefined;
    let unsubLocations: (() => void) | undefined;

    void (async () => {
      await ensureCatalogSeeded();
      unsubVendors = subscribeVendors((vendors) => {
        if (vendors.length > 0) setAllVendors(vendors);
        setCatalogLoading(false);
      });
      unsubLocations = subscribeLocations((locations) => {
        if (locations.length > 0) setAllLocations(locations);
      });
    })();

    return () => {
      unsubVendors?.();
      unsubLocations?.();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeAllReservations(setAllReservations);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isStaff || !user) return;
    return subscribeAllUsers(setAllUsers);
  }, [isStaff, user]);

  useEffect(() => {
    if (!isStaff || !user) return;
    return subscribeEmployees(setAllEmployees);
  }, [isStaff, user]);

  const handleSetAllEmployees = useCallback((action: React.SetStateAction<Employee[]>) => {
    setAllEmployees((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isStaff && user) {
        const nextIds = new Set(next.map((e) => e.id));
        for (const emp of next) {
          const old = prev.find((e) => e.id === emp.id);
          if (!old || JSON.stringify(old) !== JSON.stringify(emp)) {
            void saveEmployee(emp);
          }
        }
        for (const emp of prev) {
          if (!nextIds.has(emp.id)) {
            void deleteEmployee(emp.id);
          }
        }
      }
      return next;
    });
  }, [isStaff, user]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  const allGlobalTags = useMemo(() => {
    const tags = new Set<string>();
    allVendors.forEach(v => v.tags?.forEach(t => tags.add(t)));
    allLocations.forEach(loc => {
      loc.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [allLocations, allVendors]);

  const allGlobalCities = useMemo(() => {
    const cities = new Set<string>();
    allLocations.forEach(loc => {
      if (loc.city) cities.add(loc.city);
    });
    return Array.from(cities).sort();
  }, [allLocations]);

  const vendorLocations = useMemo(() => allLocations.filter(loc => loc.vendorId === selectedVendor?.id), [allLocations, selectedVendor]);
  const [currentLocationId, setCurrentLocationId] = useState('');
  const [currentFloorId, setCurrentFloorId] = useState('');
  
  const currentLocation = useMemo(() => vendorLocations.find(l => l.id === currentLocationId) || vendorLocations[0], [currentLocationId, vendorLocations]);
  const currentFloor = useMemo(() => currentLocation?.floors.find(f => f.id === currentFloorId) || currentLocation?.floors[0], [currentFloorId, currentLocation]);

  useEffect(() => {
    if (currentLocationId) {
      // Refresh IDs if the current ones are no longer valid for the selected vendor
      const currentLoc = vendorLocations.find(l => l.id === currentLocationId);
      if (!currentLoc) {
          setCurrentLocationId(vendorLocations[0]?.id || '');
          setCurrentFloorId(vendorLocations[0]?.floors[0]?.id || '');
      }
    } else if (vendorLocations.length > 0) {
      setCurrentLocationId(vendorLocations[0].id);
      setCurrentFloorId(vendorLocations[0].floors[0]?.id || '');
    }
  }, [vendorLocations, currentLocationId]);

  const [activeTab, setActiveTab] = useState<'blueprint' | 'staff_registry' | 'property_config' | 'menu_config' | 'analytics' | 'profile' | 'my_bookings' | 'credits' | 'staff_management' | 'cancellation_policies'>('blueprint');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeInput, setTimeInput] = useState("09:00");
  const [timePeriod, setTimePeriod] = useState<"AM" | "PM">("AM");
  const [bookingDuration, setBookingDuration] = useState(0);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [basketComments, setBasketComments] = useState<Record<string, string>>({});
  const [basketDeliveryTimes, setBasketDeliveryTimes] = useState<Record<string, string>>({});
  const [totalOrderComment, setTotalOrderComment] = useState("");
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const [isReviewMenuOpen, setIsReviewMenuOpen] = useState(false);
  const [showAccessCodeModal, setShowAccessCodeModal] = useState(false);
  const [activeServiceCategory, setActiveServiceCategory] = useState<string | null>(null);
  const [menuSource, setMenuSource] = useState<{ type: 'global' | 'branch' | 'room', id?: string }>({ type: 'global' });

  useEffect(() => {
    setBasket({});
    setBasketComments({});
    setBasketDeliveryTimes({});
    setTotalOrderComment("");
  }, [currentLocationId]);

  useEffect(() => {
    if (userRole === 'employee') setActiveTab('staff_registry');
    else if (userRole === 'owner') setActiveTab('property_config');
    else setActiveTab('blueprint');
  }, [userRole]);

  useEffect(() => {
    if (activeTab === 'analytics') void trackFeatureUsed('analytics_dashboard');
    else if (activeTab === 'shift_summary') void trackFeatureUsed('staff_analytics');
    else if (activeTab === 'credits') void trackFeatureUsed('credits_wallet');
  }, [activeTab]);

  useEffect(() => {
    if (!user?.uid || userRole !== 'customer') return;
    return subscribeUserTransactions(user.uid, setTransactions);
  }, [user?.uid, userRole]);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'employee' || selectedVendor) return;

    const branch = loadStaffBranchSession();
    if (!branch) return;

    const vendor = allVendors.find(v => v.id === branch.vendorId);
    const loc = allLocations.find(l => l.id === branch.locationId);
    if (!vendor || !loc) return;

    setSelectedVendor(vendor);
    setCurrentLocationId(branch.locationId);
    setCurrentFloorId(branch.floorId || loc.floors[0]?.id || '');
    setIsLocationConfirmed(true);
  }, [isAuthenticated, userRole, selectedVendor, allVendors, allLocations]);

  const selectedTime24h = useMemo(() => {
    const parts = timeInput.split(':');
    let hours = parseInt(parts[0], 10);
    let minutes = parseInt(parts[1], 10);
    if (isNaN(hours)) hours = 9; if (isNaN(minutes)) minutes = 0;
    let h24 = hours % 12;
    if (timePeriod === "PM") h24 += 12;
    if (timePeriod === "AM" && hours === 12) h24 = 0;
    return `${h24.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`;
  }, [timeInput, timePeriod]);

  const displayTime12h = useMemo(() => {
    const parts = timeInput.split(':');
    let hours = parseInt(parts[0], 10);
    let minutes = parseInt(parts[1], 10);
    if (isNaN(hours)) hours = 9; if (isNaN(minutes)) minutes = 0;
    let hDisplay = hours;
    if (hDisplay === 0) hDisplay = 12;
    if (hDisplay > 12) hDisplay = hDisplay % 12 || 12;
    return `${hDisplay}:${(minutes || 0).toString().padStart(2, '0')} ${timePeriod}`;
  }, [timeInput, timePeriod]);

  const deliveryTimeOptions = useMemo(() => {
    const options = ["At start of reservation"];
    for (let i = 15; i < bookingDuration * 60; i += 15) {
      if (i < 60) {
        options.push(`${i} mins into reservation`);
      } else {
        const hours = Math.floor(i / 60);
        const mins = i % 60;
        const hourText = hours === 1 ? "1h" : `${hours}h`;
        if (mins === 0) {
          options.push(`${hourText} into reservation`);
        } else {
          options.push(`${hourText} ${mins} min into reservation`);
        }
      }
    }
    options.push("At end of reservation");
    return options;
  }, [bookingDuration]);

  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [reservationTimer, setReservationTimer] = useState<number | null>(null);
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);

  // Reservation Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (reservationTimer !== null && reservationTimer > 0) {
      interval = setInterval(() => {
        setReservationTimer(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (reservationTimer === 0) {
      setSelectedRoomIds([]);
      setReservationTimer(null);
      setBookingError("Reservation time expired. Please re-select.");
      setTimeout(() => setBookingError(null), 5000);
    }
    return () => clearInterval(interval);
  }, [reservationTimer]);

  useEffect(() => {
    if (selectedRoomIds.length > 0 && userRole === 'customer') {
      if (reservationTimer === null) {
        setReservationTimer(60); // 1 minute
      }
    } else {
      setReservationTimer(null);
    }
  }, [selectedRoomIds, userRole]);

  useEffect(() => {
    if (selectedRoomIds.length === 1) {
      setMenuSource({ type: 'room', id: selectedRoomIds[0] });
    } else {
      setMenuSource({ type: 'branch', id: currentLocationId });
    }
  }, [selectedRoomIds, currentLocationId]);

  const reservationsForFloor = useMemo(() => {
    if (!currentFloor) return [];
    return allReservations.filter(r =>
      r.floorId === currentFloor.id &&
      r.date === selectedDate &&
      r.status !== 'declined'
    );
  }, [allReservations, currentFloor, selectedDate]);

  const roomsForCurrentView = useMemo(() => {
    if (!currentFloor) return [];
    const selectedMinutes = timeToMinutes(selectedTime24h);
    return (currentFloor.rooms || []).map(room => {
      const res = reservationsForFloor.find(r => {
        if (r.roomId !== room.id) return false;
        const resStart = timeToMinutes(r.time);
        const resEnd = resStart + (r.duration * 60);
        return selectedMinutes >= resStart && selectedMinutes < resEnd;
      });
      let status = RoomStatus.AVAILABLE;
      if (res) status = res.status === 'pending' ? RoomStatus.RESERVED : RoomStatus.OCCUPIED;
      return { ...room, status, activeReservation: res };
    });
  }, [currentFloor, reservationsForFloor, selectedTime24h]);

  const handleBook = async (
    roomsToBook: Room[],
    duration: number,
    paymentMethod: string,
    targetUser?: UserProfile,
    selectedMenuItems?: { itemId: string; quantity: number; comment?: string }[],
    totalPriceOverride?: number,
    totalOrderComment?: string,
  ) => {
    if (!selectedVendor || !userProfile) return;
    const finalUser = targetUser || userProfile;

    const totalPrice =
      totalPriceOverride !== undefined
        ? totalPriceOverride
        : roomsToBook.reduce((sum, r) => sum + r.pricePerHour, 0) * duration;

    if (paymentMethod === 'credits' && !targetUser && userProfile.credits < totalPrice) {
      setBookingError('Insufficient credits');
      setTimeout(() => setBookingError(null), 3000);
      return;
    }

    const menuPayload = selectedMenuItems?.map((item) => ({
      ...item,
      comment: basketComments?.[item.itemId] || item.comment,
      deliveryTime: basketDeliveryTimes?.[item.itemId] || (item as { deliveryTime?: string }).deliveryTime,
    }));

    try {
      await createBookingRemote({
        rooms: roomsToBook.map((r) => ({ id: r.id, name: r.name, pricePerHour: r.pricePerHour })),
        locationId: currentLocationId,
        floorId: currentFloorId,
        vendorId: selectedVendor.id,
        date: selectedDate,
        time: selectedTime24h,
        duration,
        paymentMethod,
        selectedMenuItems: menuPayload,
        totalOrderComment,
        totalPrice,
        targetUserId: targetUser?.uid,
        targetUserName: finalUser.name,
        targetUserEmail: finalUser.email,
        autoApprove: userRole === 'employee',
      });

      void trackBookingCreated({
        vendorId: selectedVendor.id,
        locationId: currentLocationId,
        roomCount: roomsToBook.length,
        totalPrice,
        paymentMethod,
      });

      setSelectedRoomIds([]);
      setShowBookingSuccess(true);
      setTimeout(() => setShowBookingSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Booking failed.';
      setBookingError(message.includes('Conflict') ? message : 'Could not complete booking. Try again.');
      setTimeout(() => setBookingError(null), 5000);
    }
  };

  const handleUpdateVendor = (vendorId: string, updates: Partial<Vendor>) => {
    setAllVendors((prev) => {
      const next = prev.map((v) => (v.id === vendorId ? { ...v, ...updates } : v));
      const updated = next.find((v) => v.id === vendorId);
      if (updated && isStaff) void saveVendor(updated);
      return next;
    });
    if (selectedVendor?.id === vendorId) {
      setSelectedVendor((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const handleUpdateLocationMeta = (locId: string, updates: Partial<LocationData> | ((prev: LocationData) => Partial<LocationData>)) => {
    setAllLocations((prev) => {
      const next = prev.map((l) => {
        if (l.id === locId) {
          const actualUpdates = typeof updates === 'function' ? updates(l) : updates;
          return { ...l, ...actualUpdates };
        }
        return l;
      });
      const updated = next.find((l) => l.id === locId);
      if (updated && isStaff) void saveLocation(updated);
      return next;
    });
  };

  const handleAddLocation = () => {
    if (!selectedVendor) return;
    const newId = `loc-${Date.now()}`;
    const catId = `cat-new-loc-${Date.now()}`;
    const categoryName = 'Branch Specialty Feed';
    const price1 = Math.floor(Math.random() * 21) + 30; // 30-50
    const price2 = Math.floor(Math.random() * 31) + 50; // 50-80
    const price3 = Math.floor(Math.random() * 41) + 80; // 80-120

    const newLoc: LocationData = {
      id: newId,
      vendorId: selectedVendor.id,
      name: 'New Branch Location',
      description: 'Describe this new workspace branch...',
      address: 'Enter physical address here',
      categories: [{ id: catId, name: categoryName, description: 'Catering for the new branch' }],
      menu: [
        { id: `m-loc1-${Date.now()}`, name: 'Signature Brewed Espresso', price: price1, description: 'Premium rich barista blend.', category: categoryName, image: 'https://picsum.photos/200/200?seed=sig-esp' },
        { id: `m-loc2-${Date.now()}`, name: 'Butter Glazed Croissant', price: price2, description: 'Warm and flaky fresh oven bake.', category: categoryName, image: 'https://picsum.photos/200/200?seed=butter-cro' },
        { id: `m-loc3-${Date.now()}`, name: 'Exotic Sliced Fruits', price: price3, description: 'Platter of sweet tropical organic fruits.', category: categoryName, image: 'https://picsum.photos/200/200?seed=exo-fru' }
      ],
      floors: [
        {
          id: `floor-${Date.now()}`,
          name: 'Main Floor',
          rooms: []
        }
      ]
    };
    setAllLocations((prev) => {
      const next = [...prev, newLoc];
      if (isStaff) void saveLocation(newLoc);
      return next;
    });
    setCurrentLocationId(newId);
    setCurrentFloorId(newLoc.floors[0].id);
  };

  const handleCodeLogin = async (code: string) => {
    const success = await signInWithAccessCode(code);
    if (!success) {
      const normalizedCode = code.trim().toUpperCase();
      const loc = allLocations.find((l) => l.staffAccessCode?.toUpperCase() === normalizedCode);
      if (!loc) return false;
      const vendor = allVendors.find((v) => v.id === loc.vendorId);
      if (!vendor) return false;
      const floorId = loc.floors[0]?.id || '';
      setSelectedVendor(vendor);
      setCurrentLocationId(loc.id);
      setCurrentFloorId(floorId);
      setIsLocationConfirmed(true);
      await enterStaffSession({ vendorId: vendor.id, locationId: loc.id, floorId });
      return true;
    }

    const branch = loadStaffBranchSession();
    if (branch) {
      const vendor = allVendors.find((v) => v.id === branch.vendorId);
      const loc = allLocations.find((l) => l.id === branch.locationId);
      if (vendor && loc) {
        setSelectedVendor(vendor);
        setCurrentLocationId(loc.id);
        setCurrentFloorId(branch.floorId || loc.floors[0]?.id || '');
        setIsLocationConfirmed(true);
      }
    }
    return success;
  };

  const handleLogout = async () => { await signOut(); setSelectedVendor(null); setIsLocationConfirmed(false); setSelectedRoomIds([]); setPostLoginAction(null); setBasket({}); setBasketComments({}); setBasketDeliveryTimes({}); setTotalOrderComment(""); };

  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(200);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [topUpLoading, setTopUpLoading] = useState(false);

  useEffect(() => {
    setTopUpAmount((prev) => (prev < minTopUpAmount ? minTopUpAmount : prev));
  }, [minTopUpAmount]);

  const effectiveCancellationPolicy =
    selectedVendor?.cancellationPolicy?.trim() || defaultCancellationPolicyText;

  const topUpPresets = useMemo(() => {
    const presets = [minTopUpAmount, 500, 1000].filter((v, i, arr) => arr.indexOf(v) === i);
    return presets.sort((a, b) => a - b);
  }, [minTopUpAmount]);

  const handleTopUp = async () => {
    if (topUpAmount < minTopUpAmount) {
      setBookingError(`Minimum deposit is ${minTopUpAmount} EGP`);
      setTimeout(() => setBookingError(null), 3000);
      return;
    }
    setTopUpLoading(true);
    void trackTopUpAttempt(topUpAmount);
    try {
      const result = await topUpCreditsRemote(topUpAmount);
      void trackTopUpSuccess(topUpAmount, result.newBalance);
      if (userProfile) {
        handleUpdateProfile({ ...userProfile, credits: result.newBalance });
      }
      setIsTopUpOpen(false);
      setShowBookingSuccess(true);
      setTimeout(() => setShowBookingSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Top-up failed.';
      setBookingError(message);
      setTimeout(() => setBookingError(null), 5000);
    } finally {
      setTopUpLoading(false);
    }
  };

  const handleUpdateProfile = (newProfile: UserProfile) => {
    if (newProfile.name !== userProfile.name) {
      setAllReservations(prev => prev.map(r => r.userName === userProfile.name ? { ...r, userName: newProfile.name } : r));
    }
    setUserProfile(newProfile);
  };

  const handleCancelReservation = async (id: string) => {
    try {
      await cancelBookingRemote(id);
    } catch (err) {
      console.error('Cancel failed', err);
    }
  };

  const handleAppendToReservation = (reservationId: string, menuItems: { itemId: string; quantity: number; comment?: string; deliveryTime?: string }[], totalPrice: number, orderComment?: string, paymentMethod?: string) => {
    setAllReservations(prev => prev.map(r => {
      if (r.id === reservationId) {
        if (paymentMethod === 'credits' && r.userEmail) {
           setAllUsers(users => users.map(u => u.email === r.userEmail ? { ...u, credits: Math.max(0, u.credits - totalPrice) } : u));
           if (userProfile.email === r.userEmail) {
             setUserProfile(p => ({ ...p, credits: Math.max(0, p.credits - totalPrice) }));
           }
        }
        return {
           ...r, 
           selectedMenuItems: [...(r.selectedMenuItems || []), ...menuItems],
           totalOrderComment: r.totalOrderComment ? `${r.totalOrderComment}\n${orderComment || ''}` : (orderComment || ''),
           hasInstorePurchases: true,
           totalPrice: r.totalPrice + totalPrice
        };
      }
      return r;
    }));
  };

  const currentMenuData = useMemo(() => {
    if (menuSource.type === 'room' && menuSource.id) {
      const room = roomsForCurrentView.find(r => r.id === menuSource.id);
      if (room?.menu && room.menu.length > 0) return { categories: room.categories || [], menu: room.menu };
    }
    // If it's a branch or room fallback, use the location's menu
    if (menuSource.type === 'branch' || (menuSource.type === 'room' && menuSource.id)) {
      return { categories: currentLocation?.categories || [], menu: currentLocation?.menu || [] };
    }
    // Global fallback (vendor level)
    return { categories: selectedVendor?.categories || [], menu: selectedVendor?.menu || [] };
  }, [menuSource, roomsForCurrentView, currentLocation, selectedVendor]);

  const menuItemById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof currentMenuData.menu>[number]>();
    for (const item of currentMenuData.menu || []) map.set(item.id, item);
    for (const item of selectedVendor?.menu || []) if (!map.has(item.id)) map.set(item.id, item);
    for (const item of currentLocation?.menu || []) if (!map.has(item.id)) map.set(item.id, item);
    for (const floor of currentLocation?.floors || []) {
      for (const room of floor.rooms || []) {
        for (const item of room.menu || []) if (!map.has(item.id)) map.set(item.id, item);
      }
    }
    return map;
  }, [currentMenuData, selectedVendor, currentLocation]);

  const getMenuItemById = useCallback((id: string) => menuItemById.get(id), [menuItemById]);

  const { basketTotal, basketCount } = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const [id, qty] of Object.entries(basket)) {
      const item = menuItemById.get(id);
      if (item) {
        total += item.price * (qty as number);
        count += qty as number;
      }
    }
    return { basketTotal: total, basketCount: count };
  }, [basket, menuItemById]);

  const handleUpdateRoom = (roomId: string, updates: Partial<Room>) => {
    setAllLocations(prev => prev.map(loc => ({
      ...loc,
      floors: loc.floors.map(floor => ({
        ...floor,
        rooms: floor.rooms.map(room => room.id === roomId ? { ...room, ...updates } : room)
      }))
    })));
  };

  const allSelectedRooms = useMemo(() => {
    if (!selectedVendor) return [];
    const rooms: Room[] = [];
    for (const loc of vendorLocations) {
      for (const floor of loc.floors) {
        for (const room of floor.rooms) {
          if (selectedRoomIds.includes(room.id)) {
            rooms.push(room);
          }
        }
      }
    }
    return rooms;
  }, [selectedVendor, vendorLocations, selectedRoomIds]);

  const renderContent = () => {
    if (activeTab === 'blueprint') {
      return (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col bg-slate-50/30 overflow-auto">
            <div className="p-10 pb-0 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Live View Portal</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100">
                    <select value={currentFloorId} onChange={e => setCurrentFloorId(e.target.value)} className="bg-transparent border-none outline-none text-xs font-black text-slate-900 cursor-pointer">
                      {currentLocation?.floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{selectedDate} @ {displayTime12h}</p>
                  {currentLocation?.mapUrl ? (
                    <a 
                      href={currentLocation.mapUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors"
                    >
                      <MapPin size={14} className="text-rose-500" />
                      {currentLocation.name}
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <MapPin size={14} className="text-slate-300" />
                      {currentLocation?.name}
                    </div>
                  )}
               </div>
              </div>
            </div>
            <div className="flex-1 relative bg-white border-t border-slate-200 blueprint-grid overflow-hidden mt-6" onClick={() => setSelectedRoomIds([])}>
              {roomsForCurrentView.map(room => (
                <div 
                  key={room.id} 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (room.type !== 'Service' && (userRole === 'employee' || room.status === RoomStatus.AVAILABLE)) setSelectedRoomIds(prev => prev.includes(room.id) ? prev.filter(id => id !== room.id) : [...prev, room.id]); 
                  }} 
                  className={`group absolute transition-all duration-300 cursor-pointer border-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md p-2 ${ROOM_COLORS[selectedRoomIds.includes(room.id) ? RoomStatus.SELECTED : room.status]} ${(!isStaff && favoritedRooms.includes(room.id)) ? 'ring-4 ring-amber-400 border-transparent' : ''}`} 
                  style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.width}%`, height: `${room.height}%` }}
                >
                  <span className="uppercase tracking-tighter font-black text-xs leading-none">{room.name}</span>
                  {room.type !== 'Service' && <span className="text-[8px] font-black uppercase mt-1 opacity-60">{room.status}</span>}
                  
                  {room.type !== 'Service' && !isStaff && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFavoritedRooms(prev => prev.includes(room.id) ? prev.filter(id => id !== room.id) : [...prev, room.id]);
                      }}
                      className={`absolute top-1 right-1 p-1 rounded-full transition-opacity ${
                        favoritedRooms.includes(room.id) ? 'text-amber-400 opacity-100' : 'text-slate-400/50 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                      }`}
                    >
                      <Star size={12} className={favoritedRooms.includes(room.id) ? "fill-amber-400 text-amber-400" : ""} />
                    </button>
                  )}
                </div>
              ))}
              <div className="absolute bottom-8 left-8 text-[11px] font-black text-slate-300 uppercase tracking-widest">{currentLocation?.name} • {currentFloor?.name}</div>
            </div>
          </div>
          <AnimatePresence>
            {selectedRoomIds.length > 0 && (
              <motion.aside 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 420, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="border-l border-slate-200 bg-white flex flex-col overflow-y-auto overflow-x-hidden shrink-0"
              >
                <div className="w-[420px] h-full">
                  <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">Loading...</div>}>
                  <RoomDetail 
                    rooms={allSelectedRooms} 
                    onBook={(rooms, duration, paymentMethod, user, menuItems, totalPrice, totalComment) => {
                      handleBook(rooms, duration, paymentMethod, user, menuItems, totalPrice, totalComment);
                      setBasket({}); // Clear basket after booking
                      setBasketComments({});
                      setBasketDeliveryTimes({});
                      setTotalOrderComment("");
                    }} 
                    selectedDate={selectedDate} 
                    selectedTime={displayTime12h} 
                    selectedTime24={selectedTime24h} 
                    isStaff={isStaff}
                    allUsers={allUsers}
                    userProfile={userProfile}
                    onUpdateProfile={handleUpdateProfile}
                    reservationTimer={reservationTimer}
                    cancellationPolicy={effectiveCancellationPolicy}
                    vendor={selectedVendor!}
                    basket={basket}
                    basketComments={basketComments}
                    basketDeliveryTimes={basketDeliveryTimes}
                    totalOrderComment={totalOrderComment}
                    menuPrice={basketTotal}
                    currentMenu={currentMenuData.menu}
                    getBasketItemDetails={getMenuItemById}
                    onRemoveRoom={(roomId) => setSelectedRoomIds(prev => prev.filter(id => id !== roomId))}
                    bookingDuration={bookingDuration}
                    onDurationChange={setBookingDuration}
                  />
                  </Suspense>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      );
    }
    if (isStaff) {
      if (activeTab === 'staff_registry') return (
        <EmployeeDashboard 
          selectedVendor={selectedVendor} 
          reservations={allReservations.filter(r => r.vendorId === selectedVendor?.id)} 
          locations={vendorLocations} 
          currentLocationId={currentLocationId} 
          onCancelReservation={handleCancelReservation} 
          onApproveReservation={async (id) => {
            try {
              await updateReservationStatusRemote(id, 'approved');
            } catch (err) {
              console.error('Approve failed', err);
            }
          }}
          onUpdateOrderStatus={(ids, status) => setAllReservations(prev => prev.map(r => ids.includes(r.id) ? { ...r, orderStatus: status } : r))}
          userProfile={userProfile} 
          allUsers={allUsers} 
          cancellationPolicy={effectiveCancellationPolicy} 
        />
      );
      if (activeTab === 'property_config' && userRole === 'owner') {
        if (!currentLocation) return <div className="flex-1 flex flex-col items-center justify-center pt-20"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4"><AlertCircle size={24} /></div><p className="font-bold text-slate-500">No Branch Selected / Available</p></div>;
        return <PropertyConfig userRole={userRole as any} location={currentLocation} activeFloorId={currentFloorId} locations={vendorLocations} vendor={selectedVendor!} onUpdateRooms={(newRooms) => setAllLocations(prev => {
          const next = prev.map(l => l.id === currentLocationId ? {...l, floors: l.floors.map(f => f.id === currentFloorId ? {...f, rooms: newRooms} : f)} : l);
          const updated = next.find(l => l.id === currentLocationId);
          if (updated && isStaff) void saveLocation(updated);
          return next;
        })} onSwitchLocation={setCurrentLocationId} onSwitchFloor={setCurrentFloorId} onUpdateVendor={handleUpdateVendor} onUpdateLocationMeta={handleUpdateLocationMeta} onAddLocation={handleAddLocation} view={configView} onViewChange={setConfigView} allReservations={allReservations} />;
      }
      if (activeTab === 'menu_config') {
        if (!currentLocation) return <div className="flex-1 flex flex-col items-center justify-center pt-20"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4"><AlertCircle size={24} /></div><p className="font-bold text-slate-500">No Branch Selected / Available</p></div>;
        return (
          <MenuConfig 
            userRole={userRole as any}
            vendor={selectedVendor!} 
            onUpdateVendor={v => handleUpdateVendor(selectedVendor!.id, v)} 
            location={currentLocation}
            onUpdateLocation={l => handleUpdateLocationMeta(currentLocation.id, l)}
            allUsers={allUsers}
            onBook={handleBook}
            allReservations={allReservations}
            onAppendToReservation={handleAppendToReservation}
          />
        );
      }
      if (activeTab === 'analytics' && userRole === 'owner') return (
        <AnalyticsDashboard 
          locations={vendorLocations}
          reservations={allReservations}
          selectedVendor={selectedVendor!}
          userRole={userRole as any}
          currentLocationId={currentLocationId}
        />
      );
      if (activeTab === 'shift_summary') return (
        <ShiftRegistryDashboard 
          allEmployees={allEmployees}
          setAllEmployees={handleSetAllEmployees}
          reservations={allReservations.filter(r => r.vendorId === selectedVendor?.id)}
          isGlobalAccess={userRole === 'owner'}
          clockedInEmployeeIds={clockedInEmployeeIds}
          setClockedInEmployeeIds={setClockedInEmployeeIds}
          viewMode="analytics"
        />
      );
      if (activeTab === 'staff_management' && userRole === 'owner') return (
        <ShiftRegistryDashboard 
          allEmployees={allEmployees}
          setAllEmployees={handleSetAllEmployees}
          reservations={allReservations.filter(r => r.vendorId === selectedVendor?.id)}
          isGlobalAccess={true}
          clockedInEmployeeIds={clockedInEmployeeIds}
          setClockedInEmployeeIds={setClockedInEmployeeIds}
          viewMode="management"
        />
      );
      if (activeTab === 'cancellation_policies' && userRole === 'owner') return (
        <CancellationPoliciesPage 
          locations={vendorLocations}
          vendor={selectedVendor!}
          onUpdateLocationMeta={handleUpdateLocationMeta}
          onUpdateVendor={handleUpdateVendor}
        />
      );
    }
    if (activeTab === 'profile') return <ProfilePage user={userProfile} reservations={allReservations} onLogout={handleLogout} onUpdateProfile={handleUpdateProfile} />;
    if (activeTab === 'my_bookings') return <MyBookingsPage reservations={allReservations} locations={allLocations} vendors={allVendors} userName={userProfile.name} onCancel={handleCancelReservation} />;
    if (activeTab === 'credits') return (
      <div className="flex-1 bg-slate-50/30 overflow-y-auto p-10 font-['Inter']">
        <div className="max-w-5xl mx-auto">
          <header className="mb-12">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">My Balance</h2>
            <p className="text-slate-500 font-medium italic">Manage your digital currency for bookings and in-store purchases.</p>
          </header>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-600 p-4 rounded-3xl text-white shadow-lg shadow-blue-100">
                      <Wallet size={32} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Balance</p>
                      <h3 className="text-5xl font-black text-slate-900 tracking-tighter">{userProfile.credits.toLocaleString()} <span className="text-2xl text-blue-600">EGP</span></h3>
                    </div>
                  </div>
                  
                  <div className={`grid gap-4 ${featureCreditsTopUpEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {featureCreditsTopUpEnabled && (
                      <button onClick={() => setIsTopUpOpen(true)} className="bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">TOP UP BALANCE</button>
                    )}
                    <button onClick={() => setIsTransactionsOpen(true)} className="bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all">VIEW TRANSACTIONS</button>
                  </div>
                </div>
              </div>

            </div>

            <div className="space-y-8">
              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute -bottom-10 -right-10 opacity-10 rotate-12">
                  <Coins size={160} />
                </div>
                <h3 className="text-lg font-black tracking-tight mb-4 uppercase">Why use EGP?</h3>
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={14} /></div>
                    <p className="text-xs font-medium text-slate-300">Instant in-store payments at any NovaSpace location.</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={14} /></div>
                    <p className="text-xs font-medium text-slate-300">Discounted rates on meeting rooms and day passes.</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={14} /></div>
                    <p className="text-xs font-medium text-slate-300">No need to carry cards or cash during your workday.</p>
                  </li>
                </ul>
              </div>
            </div>
          </div>

        {/* Top Up Modal */}
        {featureCreditsTopUpEnabled && isTopUpOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsTopUpOpen(false)} />
            <div className="relative bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2 text-center">Top Up Balance</h3>
              <p className="text-slate-500 font-bold mb-8 text-center">Minimum deposit is {minTopUpAmount} EGP</p>
              
              <div className="space-y-6 mb-10">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (EGP)</label>
                  <div className="relative group">
                    <Coins className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input 
                      type="number" 
                      min={minTopUpAmount}
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(Number(e.target.value))}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 transition-all font-black text-2xl text-slate-900"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {topUpPresets.map(amt => (
                    <button 
                      key={amt} 
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-3 rounded-xl font-black text-xs transition-all border-2 ${topUpAmount === amt ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'}`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsTopUpOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-xs">Cancel</button>
                <button onClick={handleTopUp} disabled={topUpLoading} className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-blue-100 disabled:opacity-60">{topUpLoading ? 'Processing…' : 'Confirm Deposit'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Transactions Modal */}
        {isTransactionsOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsTransactionsOpen(false)} />
            <div className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 flex flex-col max-h-[80vh] animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Transaction History</h3>
                <button onClick={() => setIsTransactionsOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex flex-col p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${tx.type === 'credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {tx.type === 'credit' ? <Plus size={20} /> : <X size={20} />}
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900">{tx.description}</p>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                      <p className={`text-lg font-black ${tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'credit' ? '+' : '-'}{tx.amount.toLocaleString()} EGP
                      </p>
                    </div>
                    {(tx.category === 'booking' || tx.roomName) && (
                      <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Space</span>
                          <span className="font-semibold text-slate-700">{tx.roomName}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Branch</span>
                          <span className="font-semibold text-slate-700">{tx.locationName}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Area</span>
                          <span className="font-semibold text-slate-700">{tx.floorName}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duration</span>
                          <span className="font-semibold text-slate-700">{tx.duration} Hour{tx.duration !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Method</span>
                          <span className="font-semibold text-slate-700">{tx.paymentMethod === 'credits' ? 'Nova Credit' : tx.paymentMethod}</span>
                        </div>
                        {tx.hasInstorePurchases && (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">In-Store Purchases</span>
                            <span className="font-semibold text-slate-700">Yes</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
    return null;
  };

  if (postLoginAction === 'privacy') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PrivacyPage onBack={() => setPostLoginAction(isLoggedIn ? (selectedVendor ? 'select_network' : null) : null)} />
      </Suspense>
    );
  }

  if (postLoginAction === 'terms') {
    return (
      <Suspense fallback={<PageLoader />}>
        <TermsPage onBack={() => setPostLoginAction(isLoggedIn ? (selectedVendor ? 'select_network' : null) : null)} />
      </Suspense>
    );
  }

  if (postLoginAction === 'support') {
    return (
      <Suspense fallback={<PageLoader />}>
        <SupportPage onBack={() => setPostLoginAction(isLoggedIn ? (selectedVendor ? 'select_network' : null) : null)} />
      </Suspense>
    );
  }

  if (postLoginAction === 'api_status') {
    return (
      <Suspense fallback={<PageLoader />}>
        <APIStatusPage onBack={() => setPostLoginAction(isLoggedIn ? (selectedVendor ? 'select_network' : null) : null)} />
      </Suspense>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-500">Loading...</p></div>;
  }

  if (!isLoggedIn) return (
    <Suspense fallback={<PageLoader />}>
    <LandingPage 
      onCodeLogin={handleCodeLogin}
      onShowPrivacy={() => setPostLoginAction('privacy')}
      onShowTerms={() => setPostLoginAction('terms')}
      onShowSupport={() => setPostLoginAction('support')}
    />
    </Suspense>
  );

  if (isLoggedIn && !postLoginAction && !isStaff) {
    const emailVerified = userProfile?.emailVerified === true;
    const phoneVerified = !!normalizePhoneDigits(user?.phoneNumber ?? undefined);
    const hasUnverifiedContact = !emailVerified || !phoneVerified;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-['Inter']">
        {profileSyncError && (
          <div className="max-w-lg w-full mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-bold text-center">
            {profileSyncError}
          </div>
        )}
        <div className="max-w-3xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">Welcome back, {(userProfile?.name || user?.displayName || 'Member').split(' ')[0]}</h1>
            <p className="text-slate-500 font-medium">What would you like to do today?</p>
          </div>

          {hasUnverifiedContact && (
            <div className="mb-8 p-6 bg-white rounded-[2rem] border-2 border-red-100 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Verification Required</h3>
                  <p className="text-slate-500 text-sm font-medium">
                    Please verify your contact information to book workspaces and secure your account.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!emailVerified && (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail size={16} className="text-slate-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 truncate">{userProfile?.email || user?.email}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500 shrink-0 ml-2">Unverified</span>
                  </div>
                )}
                {!phoneVerified && (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/40">
                    <span className="text-xs font-bold text-slate-700">Phone Number</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Unverified</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setPostLoginAction('edit_profile')}
                className="w-full py-3 rounded-xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-colors"
              >
                Verify Contact Information
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={() => setPostLoginAction('select_network')} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl hover:shadow-2xl hover:border-blue-200 transition-all group flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Globe size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Access Network</h2>
              <p className="text-slate-500 font-medium">Browse locations and book workspaces</p>
            </button>
            <button onClick={() => setPostLoginAction('edit_profile')} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl hover:shadow-2xl hover:border-blue-200 transition-all group flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <User size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Manage Profile</h2>
              <p className="text-slate-500 font-medium">Update your personal details and preferences</p>
            </button>
          </div>
          <div className="mt-12 text-center">
            <button onClick={handleLogout} className="text-slate-400 font-bold hover:text-slate-600 transition-colors">Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  if (postLoginAction === 'edit_profile' && !isStaff) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter']">
        <div className="p-6">
          <button onClick={() => setPostLoginAction(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors">
            <ChevronLeft size={20} /> Back to Menu
          </button>
        </div>
        <Suspense fallback={<PageLoader />}>
        <ProfilePage user={userProfile} reservations={allReservations} onLogout={handleLogout} onUpdateProfile={handleUpdateProfile} onClose={() => setPostLoginAction(null)} />
        </Suspense>
      </div>
    );
  }

  if (postLoginAction === 'create_space' && isStaff) {
    return (
      <Suspense fallback={<PageLoader />}>
      <CreateSpacePage 
        onBack={() => setPostLoginAction(null)} 
        onCreate={(newVendor) => {
          const newLocation: LocationData = {
            id: `${newVendor.id}-hq`,
            vendorId: newVendor.id,
            name: `${newVendor.name} HQ`,
            description: `Main headquarters for ${newVendor.name}`,
            image: newVendor.logo,
            address: '123 Main St, City, Country',
            floors: [
              {
                id: `${newVendor.id}-hq-f1`,
                name: 'Ground Floor',
                rooms: []
              }
            ]
          };

          setAllVendors((prev) => [...prev, newVendor]);
          setAllLocations((prev) => [...prev, newLocation]);
          void saveVendor(newVendor);
          void saveLocation(newLocation);
          setPostLoginAction(null);
        }} 
      />
      </Suspense>
    );
  }

  if (userRole === 'employee' && (!selectedVendor || !isLocationConfirmed)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <p className="text-slate-600 font-bold mb-4">Staff branch session could not be restored.</p>
        <button
          onClick={handleLogout}
          className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-colors"
        >
          Return to login
        </button>
      </div>
    );
  }

  if (!selectedVendor) return (
    <Suspense fallback={<PageLoader />}>
    <VendorSelection 
      vendors={allVendors.map(v => ({ ...v, locationCount: allLocations.filter(loc => loc.vendorId === v.id).length > 0 ? allLocations.filter(loc => loc.vendorId === v.id).length : v.locationCount }))} 
      locations={allLocations}
      onSelect={setSelectedVendor} 
      onBack={() => { 
        if (userRole === 'customer') {
          setPostLoginAction(null);
        } else {
          handleLogout();
        }
      }} 
      userRole={userRole || 'customer'} 
      onCreateSpace={() => setPostLoginAction('create_space')}
      onShowPrivacy={() => setPostLoginAction('privacy')}
      onShowTerms={() => setPostLoginAction('terms')}
      onShowSupport={() => setPostLoginAction('support')}
      selectedTags={selectedTags}
      setSelectedTags={setSelectedTags}
      selectedCities={selectedCities}
      setSelectedCities={setSelectedCities}
      allTags={allGlobalTags}
      allCities={allGlobalCities}
      userName={userProfile?.name}
      userProfile={userProfile}
    />
    </Suspense>
  );
  if (!isLocationConfirmed) return (
    <Suspense fallback={<PageLoader />}>
    <LocationSelection 
    vendor={selectedVendor} 
    locations={vendorLocations} 
    onSelect={id => { 
      setCurrentLocationId(id); 
      const loc = vendorLocations.find(l => l.id === id);
      if (loc && loc.floors.length > 0) {
        setCurrentFloorId(loc.floors[0].id);
      }
      setIsLocationConfirmed(true); 
    }} 
    onBack={() => { setSelectedVendor(null); setIsLocationConfirmed(false); }} 
    activeLocationId={currentLocationId} 
    userRole={userRole || 'customer'} 
    allReservations={allReservations}
    selectedTags={selectedTags}
    setSelectedTags={setSelectedTags}
    selectedCities={selectedCities}
    setSelectedCities={setSelectedCities}
    allTags={allGlobalTags}
    allCities={allGlobalCities}
    userName={userProfile?.name}
    userProfile={userProfile}
  />
  </Suspense>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden font-['Inter']">
      <aside className="w-20 lg:w-72 bg-white border-r border-slate-200 flex flex-col items-center lg:items-stretch py-8 px-6 shadow-xl z-30">
        <div className="flex items-center gap-3 px-2 mb-16"><div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg"><Building2 size={24} /></div><h1 className="text-2xl font-black text-slate-900 hidden lg:block tracking-tighter">NovaSpace</h1></div>
        <nav className="flex-1 space-y-2">
          {!isStaff ? (
            <>
              <button onClick={() => setActiveTab('blueprint')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'blueprint' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><MapIcon size={20} /><span className="font-black text-sm hidden lg:block">Blueprint</span></button>
              <div className="flex flex-col w-full">
                <button 
                  onClick={() => { 
                    setActiveServiceCategory(null);
                    setMenuSource({ type: 'branch', id: currentLocationId });
                    setIsServiceMenuOpen(true); 
                  }}
                  className="w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all text-slate-400 hover:bg-slate-50 group"
                >
                  <div className="flex items-center gap-4">
                    <Utensils size={20} className="group-hover:text-blue-600 transition-colors" />
                    <span className="font-black text-sm hidden lg:block">Service Menu</span>
                  </div>
                </button>
                <AnimatePresence>
                  {basketCount > 0 && (
                    <motion.button
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setIsReviewMenuOpen(true)}
                      className="w-full flex items-center justify-between px-4 py-3 pl-12 rounded-2xl transition-all text-slate-400 hover:bg-slate-50 group overflow-hidden"
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingCart size={16} className="group-hover:text-blue-600 transition-colors" />
                        <span className="font-black text-sm hidden lg:block">My Basket</span>
                      </div>
                      <span className="hidden lg:block text-[10px] font-black px-2 py-0.5 rounded-lg bg-blue-100 text-blue-600">
                        {basketCount}
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={() => setActiveTab('my_bookings')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'my_bookings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><Calendar size={20} /><span className="font-black text-sm hidden lg:block">My Bookings</span></button>
              <button onClick={() => setActiveTab('credits')} className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all ${activeTab === 'credits' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-4">
                  <Coins size={20} />
                  <span className="font-black text-sm hidden lg:block">Balance</span>
                </div>
                <span className={`hidden lg:block text-[10px] font-black px-2 py-0.5 rounded-lg ${activeTab === 'credits' ? 'bg-white/20' : 'bg-emerald-50 text-emerald-600'}`}>
                  {userProfile.credits.toLocaleString()} EGP
                </span>
              </button>
            </>
          ) : userRole === 'owner' ? (
            <>
              <div className="px-4 py-2 mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Global Access</p>
              </div>
              <button onClick={() => { setActiveTab('property_config'); setConfigView('layout'); }} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'property_config' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><Settings size={20} /><span className="font-black text-sm hidden lg:block">Config</span></button>
              <button onClick={() => setActiveTab('menu_config')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'menu_config' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><Utensils size={20} /><span className="font-black text-sm hidden lg:block">Menu</span></button>
              <button onClick={() => setActiveTab('analytics')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'analytics' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><BarChart3 size={20} /><span className="font-black text-sm hidden lg:block">Store Analytics</span></button>
              <button onClick={() => setActiveTab('shift_summary')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'shift_summary' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><BarChart3 size={20} /><span className="font-black text-sm hidden lg:block">Staff Analytics</span></button>
              <button onClick={() => setActiveTab('staff_management')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'staff_management' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><User size={20} /><span className="font-black text-sm hidden lg:block">Staff Management</span></button>
              <button onClick={() => setActiveTab('cancellation_policies')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'cancellation_policies' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><Ban size={20} /><span className="font-black text-sm hidden lg:block">Cancellation Policies</span></button>
              <button 
                onClick={() => setShowAccessCodeModal(true)} 
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all text-slate-400 hover:bg-blue-50 hover:text-blue-600 group"
              >
                <div className="relative">
                  <KeyRound size={20} className="group-hover:scale-110 transition-transform" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
                </div>
                <span className="font-black text-sm hidden lg:block">Access Code</span>
              </button>
            </>
          ) : (
            <>
              <div className="px-4 py-2 mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Staff Portal</p>
              </div>
              <button onClick={() => setActiveTab('staff_registry')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'staff_registry' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><ShieldCheck size={20} /><span className="font-black text-sm hidden lg:block">Registry</span></button>
              <button onClick={() => setActiveTab('blueprint')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'blueprint' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><Eye size={20} /><span className="font-black text-sm hidden lg:block">Live View</span></button>
              <button onClick={() => setActiveTab('menu_config')} className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeTab === 'menu_config' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><Utensils size={20} /><span className="font-black text-sm hidden lg:block">Menu</span></button>
              <button 
                onClick={() => setShowAccessCodeModal(true)} 
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 group"
              >
                <div className="relative">
                  <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                </div>
                <span className="font-black text-sm hidden lg:block">Access Code</span>
              </button>
            </>
          )}
        </nav>
        {userRole === 'employee' && (
          <button 
            onClick={() => setActiveTab('shift_summary')} 
            className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all mb-2 ${activeTab === 'shift_summary' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <User size={20} />
            <span className="font-black text-sm hidden lg:block">Shift Registry</span>
          </button>
        )}
        <button 
          onClick={() => { 
            if (userRole === 'employee') {
              handleLogout();
            } else {
              setSelectedVendor(null); 
              setIsLocationConfirmed(false); 
            }
          }} 
          className="mt-auto w-full flex items-center gap-4 px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-rose-600 transition-all"
        >
          <LogOut size={20} />
          <span className="font-black text-sm hidden lg:block">Exit Network</span>
        </button>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden bg-white/50 relative">
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-10 z-20">
          <div className="flex items-center gap-6">
            {isStaff && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl">
                <div className={`w-2 h-2 rounded-full animate-pulse ${clockedInEmployeeIds.length > 0 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${clockedInEmployeeIds.length > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {userRole === 'owner' ? 'Owner' : 'Staff'} Mode {clockedInEmployeeIds.length > 0 ? 'Active' : 'Inactive'}
                </span>
              </div>
            )}

            <div className="flex items-center gap-4">
              {userRole !== 'owner' && (
                <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <div className="flex flex-col px-4 py-1.5 bg-white rounded-xl shadow-sm border border-slate-100"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</label><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="text-xs font-black text-slate-900 bg-transparent outline-none" /></div>
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-white rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Time Slot</label><select value={timeInput} onChange={e => setTimeInput(e.target.value)} className="text-xs font-black text-slate-900 bg-transparent outline-none w-16 appearance-none cursor-pointer"><option value="01:00">01:00</option><option value="02:00">02:00</option><option value="03:00">03:00</option><option value="04:00">04:00</option><option value="05:00">05:00</option><option value="06:00">06:00</option><option value="07:00">07:00</option><option value="08:00">08:00</option><option value="09:00">09:00</option><option value="10:00">10:00</option><option value="11:00">11:00</option><option value="12:00">12:00</option></select></div>
                    <div className="flex flex-col gap-0.5"><button onClick={() => setTimePeriod("AM")} className={`text-[8px] font-black px-1.5 py-0.5 rounded ${timePeriod === "AM" ? "bg-blue-600 text-white" : "text-slate-400"}`}>AM</button><button onClick={() => setTimePeriod("PM")} className={`text-[8px] font-black px-1.5 py-0.5 rounded ${timePeriod === "PM" ? "bg-blue-600 text-white" : "text-slate-400"}`}>PM</button></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userRole === 'employee' && (
              <ShiftTimerWidget
                isActive={isShiftActive}
                onEndShift={() => setIsShiftActive(false)}
              />
            )}
             {!isStaff && (
               <button onClick={() => setIsLocationConfirmed(false)} className="flex items-center gap-2 hover:text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] transition-colors group text-slate-400 mr-4">
                 <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                 Back to Branches
               </button>
             )}
             <div className="flex items-center gap-4 px-6 py-3 rounded-2xl group transition-all">
                <img src={selectedVendor?.logo} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                <div className="flex flex-col items-start"><span className="text-sm font-black text-slate-900">{selectedVendor?.name}</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Network Console</span></div>
             </div>
          </div>
        </header>

        <div className={`flex-1 flex flex-col min-h-0 relative ${userRole === 'employee' && !isShiftActive ? 'pointer-events-none' : ''}`}>
          {userRole === 'employee' && !isShiftActive && (
            <div className="absolute inset-0 z-[100] bg-slate-50/60 backdrop-blur-md flex items-center justify-center pointer-events-auto">
              <div className="bg-white border border-slate-200 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center max-w-sm text-center animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Clock size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Start Your Shift</h3>
                <p className="text-sm font-bold text-slate-500 mb-8">You need to start your work day to access the staff portal and manage reservations.</p>
                <button 
                  onClick={() => setIsShiftActive(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 font-black text-sm px-6 py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check size={18} /> Begin Work Day
                </button>
              </div>
            </div>
          )}
          <Suspense fallback={<PageLoader />}>
          {renderContent()}
          </Suspense>
        </div>
      </main>

      {/* Service Menu Modal */}
      {isServiceMenuOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => { setIsServiceMenuOpen(false); setActiveServiceCategory(null); }} />
          <div className="relative bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 overflow-hidden">
            {/* Modal Header */}
            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                    Service Menu
                  </h3>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                    Browse and order items to your workspace
                  </p>
                </div>
              </div>
              <button onClick={() => { setIsServiceMenuOpen(false); setActiveServiceCategory(null); }} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              {/* Horizontal Category Bar */}
                  {(currentMenuData.categories || []).length > 0 && (
                    <div className="px-10 py-6 bg-white border-b border-slate-50 sticky top-0 z-10">
                      <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {(currentMenuData.categories || []).map(category => (
                          <button 
                            key={typeof category === 'string' ? category : category.name}
                            onClick={() => setActiveServiceCategory(typeof category === 'string' ? category : category.name)}
                            className={`px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest whitespace-nowrap transition-all border-2 ${
                              (activeServiceCategory === (typeof category === 'string' ? category : category.name) || (!activeServiceCategory && (currentMenuData.categories?.[0] === category || (currentMenuData.categories?.[0] as any)?.name === (typeof category === 'string' ? category : category.name))))
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                                : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200 hover:text-blue-600'
                            }`}
                          >
                            {typeof category === 'string' ? category : category.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-10 flex-1 flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(() => {
                    const categories = currentMenuData.categories || [];
                    if (categories.length === 0) {
                      return (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                          <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-[2rem] flex items-center justify-center mb-6">
                            <Utensils size={40} />
                          </div>
                          <h4 className="text-2xl font-black text-slate-900 tracking-tight mb-2">No Menu Available</h4>
                          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">This location hasn't set up their service menu yet.</p>
                        </div>
                      );
                    }

                    const selectedCat = activeServiceCategory || (typeof categories[0] === 'string' ? categories[0] : categories[0].name);
                    const filteredItems = currentMenuData.menu?.filter(i => i.category === selectedCat) || [];
                    
                    if (filteredItems.length === 0) {
                      return (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-2xl flex items-center justify-center mb-4">
                            <Utensils size={32} />
                          </div>
                          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No items found in this category</p>
                        </div>
                      );
                    }

                    return filteredItems.map(item => (
                      <div key={item.id} className="bg-white rounded-[2.5rem] p-6 border border-slate-100 flex flex-col group hover:shadow-xl transition-all shadow-sm">
                        <div className="relative mb-6">
                          <img src={item.image || `https://picsum.photos/400/400?seed=${item.id}`} className="w-full aspect-square object-cover rounded-3xl shadow-md" referrerPolicy="no-referrer" />
                          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black text-slate-900 uppercase tracking-widest border border-slate-100">{item.category}</div>
                        </div>
                        <h4 className="text-lg font-black text-slate-900 mb-1">{item.name}</h4>
                        <p className="text-xs text-slate-400 font-medium mb-4 line-clamp-2">{item.description}</p>
                        <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-100/50">
                          <span className="text-xl font-black text-blue-600">{item.price} <span className="text-xs">EGP</span></span>
                          <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm">
                            <button 
                              onClick={() => setBasket(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] || 0) - 1) }))}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 transition-colors"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-black text-sm text-slate-900">{basket[item.id] || 0}</span>
                            <button 
                              onClick={() => setBasket(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
        </div>

            {/* Modal Footer */}
            <div className="p-10 border-t border-slate-50 flex items-center justify-between bg-slate-50/30">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Basket Total ({basketCount} items)</p>
                <p className="text-3xl font-black text-slate-900">{basketTotal.toLocaleString()} <span className="text-sm text-blue-600">EGP</span></p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => { 
                    setIsServiceMenuOpen(false); 
                    setActiveServiceCategory(null);
                  }}
                  className="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-blue-100 hover:scale-105 transition-transform"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBookingSuccess && <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-6 rounded-3xl shadow-2xl flex items-center gap-5 z-[150] animate-in fade-in slide-in-from-bottom-6"><div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center"><Check size={24} /></div><div><p className="font-black text-xl">Reservation Confirmed!</p></div></div>}
      {bookingError && <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-10 py-6 rounded-3xl shadow-2xl z-[150] font-black animate-in fade-in slide-in-from-bottom-6">{bookingError}</div>}
      
      {/* Basket/Review Modal */}
      <AnimatePresence>
        {isReviewMenuOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsReviewMenuOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <ShoppingCart size={24} />
                  </div>
                  My Basket
                </h3>
                <button onClick={() => setIsReviewMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                {basketCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center mb-6">
                      <ShoppingCart size={40} />
                    </div>
                    <h4 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Your basket is empty</h4>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Add some items from the service menu first</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-6 mb-10">
                      {Object.entries(basket).filter(([_, qty]) => (qty as number) > 0).map(([id, itemsQty]) => {
                        const qty = itemsQty as number;
                        const item = getMenuItemById(id);
                        if (!item) return null;
                        return (
                          <div key={id} className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-4">
                                <img src={item.image} className="w-12 h-12 rounded-xl object-cover" />
                                <div>
                                  <h5 className="font-black text-slate-900">{item.name}</h5>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{qty} x {item.price} EGP</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-black text-slate-900">{item.price * qty} EGP</span>
                                <button 
                                  onClick={() => {
                                    const newBasket = { ...basket };
                                    delete newBasket[id];
                                    setBasket(newBasket);
                                    const newComments = { ...basketComments };
                                    delete newComments[id];
                                    setBasketComments(newComments);
                                    const newDeliveryTimes = { ...basketDeliveryTimes };
                                    delete newDeliveryTimes[id];
                                    setBasketDeliveryTimes(newDeliveryTimes);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-200/50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                >
                                  <X size={16} strokeWidth={3} />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes for this item</label>
                                <input 
                                  type="text"
                                  value={basketComments[id] || ""}
                                  onChange={(e) => setBasketComments(prev => ({ ...prev, [id]: e.target.value }))}
                                  placeholder="e.g. Extra sugar, no ice..."
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-400 transition-all"
                                />
                              </div>
                              <div className="space-y-2 pt-2 pb-1">
                                {(() => {
                                  let selectedIndex = basketDeliveryTimes[id] ? deliveryTimeOptions.indexOf(basketDeliveryTimes[id]) : 0;
                                  if (selectedIndex === -1) selectedIndex = 0;
                                  return (
                                    <>
                                      <div className="flex items-center justify-between ml-1 mb-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center">Delivery Time</label>
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{deliveryTimeOptions[selectedIndex]}</span>
                                      </div>
                                      <div className="relative py-2 mt-1 group">
                                        <div className="absolute top-1/2 -mt-1 left-3 right-3 h-2 bg-slate-100 rounded-full pointer-events-none overflow-hidden">
                                          <div className={`h-full transition-all duration-75 ${bookingDuration === 0 ? 'bg-slate-300' : 'bg-blue-500'}`} style={{ width: `${(selectedIndex / Math.max(1, deliveryTimeOptions.length - 1)) * 100}%`, borderRadius: '9999px' }} />
                                        </div>
                                        <div className="absolute top-1/2 left-3 right-3 flex justify-between pointer-events-none z-10" style={{ transform: 'translateY(-50%)' }}>
                                          {deliveryTimeOptions.map((_, i) => (
                                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${selectedIndex >= i ? (bookingDuration === 0 ? 'bg-slate-400' : 'bg-white/90') : 'bg-slate-300'}`} />
                                          ))}
                                        </div>
                                        {bookingDuration === 0 && (
                                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded-md pointer-events-none whitespace-nowrap z-50">
                                            Select duration of stay first to use the slider
                                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45" />
                                          </div>
                                        )}
                                        <input 
                                          type="range"
                                          disabled={bookingDuration === 0}
                                          min={0}
                                          max={Math.max(1, deliveryTimeOptions.length - 1)}
                                          step={1}
                                          value={selectedIndex}
                                          onChange={(e) => setBasketDeliveryTimes(prev => ({ ...prev, [id]: deliveryTimeOptions[parseInt(e.target.value, 10)] }))}
                                          className={`relative w-full appearance-none bg-transparent z-20 focus:outline-none 
                                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 
                                            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full 
                                            [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-slate-100 ${bookingDuration === 0 ? 'cursor-not-allowed [&::-webkit-slider-thumb]:bg-slate-200 [&::-webkit-slider-thumb]:shadow-none' : 'cursor-pointer'}`}
                                        />
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-blue-50 rounded-3xl p-8 border border-blue-100">
                      <h5 className="font-black text-blue-900 mb-4 flex items-center gap-2">
                         <Mail size={18} /> Order Comment
                      </h5>
                      <textarea 
                        value={totalOrderComment}
                        onChange={(e) => setTotalOrderComment(e.target.value)}
                        placeholder="Add any general notes for the staff regarding your entire order..."
                        rows={3}
                        className="w-full px-5 py-4 bg-white border border-blue-200 rounded-2xl text-xs font-bold text-slate-900 outline-none focus:border-blue-400 transition-all resize-none shadow-inner"
                      />
                    </div>
                  </>
                )}
              </div>
              
              {basketCount > 0 && (
                <div className="p-10 border-t border-slate-50 flex items-center justify-between bg-slate-50/30">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Basket Total ({basketCount} items)</p>
                    <p className="text-3xl font-black text-slate-900">{basketTotal.toLocaleString()} <span className="text-sm text-blue-600">EGP</span></p>
                  </div>
                  <button 
                    onClick={() => setIsReviewMenuOpen(false)}
                    className="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-blue-100 hover:scale-105 transition-transform"
                  >
                    Confirm Selection
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Access Code Modal */}
      <AnimatePresence>
        {showAccessCodeModal && currentLocation && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/60 transition-all">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-10 flex flex-col items-center text-center"
            >
              <button onClick={() => setShowAccessCodeModal(false)} className="absolute top-8 right-8 p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-300 hover:text-slate-600"><X size={24} /></button>
              
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner">
                <ShieldCheck size={40} />
              </div>
              
              <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Staff Gateway</h3>
              <p className="text-slate-500 font-bold mb-10">Share this code with team members to give them instant access to <span className="text-slate-900 font-black">{currentLocation.name}</span>.</p>
              
              <div className="w-full p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center group mb-8">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Unique Branch Code</span>
                {userRole === 'owner' ? (
                  <input
                    type="text"
                    value={currentLocation.staffAccessCode || ''}
                    onChange={(e) => handleUpdateLocationMeta(currentLocation.id, { staffAccessCode: e.target.value })}
                    className="w-full text-center text-4xl font-black text-emerald-600 tracking-[0.1em] bg-transparent outline-none border-b-2 border-transparent focus:border-emerald-200 transition-colors"
                    placeholder="ENTER CODE"
                  />
                ) : (
                  <span className="text-5xl font-black text-emerald-600 tracking-[0.1em] select-all cursor-copy group-hover:scale-105 transition-transform">
                    {currentLocation.staffAccessCode || 'NOT SET'}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3 py-3 px-6 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100">
                <Check size={16} strokeWidth={3} />
                Synced & Active
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
