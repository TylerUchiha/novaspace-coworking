
import React, { useState, useMemo, useEffect } from 'react';
import { Reservation, Room, UserProfile, LocationData, Vendor } from '../types';
import { UserAvatar } from './UserAvatar';
import { resolveMenuItemPrice } from '../utils/menuCatalog';
import { 
  Users, 
  Calendar, 
  MapPin, 
  Search, 
  MoreHorizontal, 
  CheckCircle, 
  XCircle, 
  LayoutGrid,
  Clock,
  Mail,
  Phone,
  History,
  ShieldCheck,
  X,
  ChevronRight,
  ChevronLeft,
  Hourglass,
  Layers,
  BellRing,
  Palette,
  AlertCircle,
  Coffee,
  CreditCard,
  Coins
} from 'lucide-react';

interface EmployeeDashboardProps {
  reservations: Reservation[];
  locations: LocationData[];
  currentLocationId: string;
  onCancelReservation: (id: string) => void;
  onApproveReservation: (id: string) => void;
  onUpdateOrderStatus?: (ids: string[], status: 'confirmed' | 'cancelled') => void;
  userProfile: UserProfile;
  allUsers: UserProfile[];
  cancellationPolicy?: string;
  selectedVendor: Vendor | null;
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ 
  reservations, 
  locations, 
  currentLocationId, 
  onCancelReservation, 
  onApproveReservation, 
  onUpdateOrderStatus,
  userProfile,
  allUsers,
  cancellationPolicy,
  selectedVendor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState(currentLocationId);
  const [selectedCustomer, setSelectedCustomer] = useState<UserProfile | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const [approvalFeedback, setApprovalFeedback] = useState<{ userName: string } | null>(null);
  const [expandedRoomsGroupId, setExpandedRoomsGroupId] = useState<string | null>(null);
  const [cancellingGroup, setCancellingGroup] = useState<Reservation[] | null>(null);
  const cancellingLocation = cancellingGroup ? locations.find(l => l.id === cancellingGroup[0].locationId) : null;
  const activeCancellationPolicy = cancellingLocation?.cancellationPolicy || cancellationPolicy;
  const currentLoc = locations.find(l => l.id === currentLocationId);
  const currentLocPolicy = currentLoc?.cancellationPolicy;
  const [viewingAddonsFor, setViewingAddonsFor] = useState<Reservation | null>(null);

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 5;

  useEffect(() => {
    if (currentLocationId) {
      setFilterLocation(currentLocationId);
    }
  }, [currentLocationId]);

  const groupedReservations = useMemo(() => {
    const groups: Map<string, Reservation[]> = new Map();
    
    const filtered = reservations.filter(res => {
      const user = allUsers.find(u => u.name === res.userName);
      const phone = user?.phone || '';
      
      const search = searchTerm.toLowerCase();
      const matchesSearch = res.userName.toLowerCase().includes(search) || 
                            phone.includes(search);
      
      const matchesLocation = filterLocation === 'all' || res.locationId === filterLocation;
      return matchesSearch && matchesLocation;
    });

    filtered.forEach(res => {
      const key = `${res.userName}-${res.locationId}-${res.date}-${res.time}-${res.duration}-${res.createdAt}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(res);
    });

    return Array.from(groups.values()).sort((a, b) => b[0].createdAt - a[0].createdAt);
  }, [reservations, searchTerm, filterLocation]);

  const tableReservations = useMemo(() => {
    return groupedReservations.filter(group => group[0].duration > 0);
  }, [groupedReservations]);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm, filterLocation]);

  const totalPages = Math.ceil(tableReservations.length / itemsPerPage);
  const currentItems = tableReservations.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const formatTo12h = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getEndTime = (startTime: string, duration: number) => {
    const [h, m] = startTime.split(':').map(Number);
    const endH = (h + duration) % 24;
    const period = endH >= 12 ? 'PM' : 'AM';
    const displayH = endH % 12 || 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const getCustomerPfp = (name: string) => {
    const user = allUsers.find(u => u.name === name);
    if (user) return user.pfp;
    return `https://picsum.photos/seed/${encodeURIComponent(name)}/100/100`;
  };

  const handleApproveAction = (resGroup: Reservation[]) => {
    resGroup.forEach(r => onApproveReservation(r.id));
    setApprovalFeedback({ userName: resGroup[0].userName });
    setTimeout(() => setApprovalFeedback(null), 4000);
  };

  const getRoomName = (locationId: string, roomId: string) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc) return 'Unknown Room';
    const room = loc.floors.flatMap(f => f.rooms).find(r => r.id === roomId);
    return room?.name || 'Unknown Room';
  };

  const getMenuItemName = (reservation: Reservation, itemId: string) => {
    const loc = locations.find(l => l.id === reservation.locationId);
    const room = loc?.floors.flatMap(f => f.rooms).find(r => r.id === reservation.roomId);
    
    const roomItem = room?.menu?.find(m => m.id === itemId);
    if (roomItem) return roomItem.name;

    const locItem = loc?.menu?.find(m => m.id === itemId);
    if (locItem) return locItem.name;

    const vendorItem = selectedVendor?.menu?.find(m => m.id === itemId);
    if (vendorItem) return vendorItem.name;

    return 'Unknown Item';
  };

  const getLocationName = (locationId: string) => {
    return locations.find(l => l.id === locationId)?.name || 'Unknown Location';
  };

  const customerHistory = useMemo(() => {
    if (!selectedCustomer) return [];
    return reservations.filter(r => r.userName === selectedCustomer.name)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCustomer, reservations]);

  const ordersList = useMemo(() => {
    return groupedReservations.filter(group => {
      return group.some(res => 
        (res.selectedMenuItems && res.selectedMenuItems.length > 0) || 
        (res.totalOrderComment && res.totalOrderComment.trim() !== '')
      );
    });
  }, [groupedReservations]);

  const pendingOrders = useMemo(() => {
    return ordersList.filter(group => {
      const status = group[0]?.orderStatus || 'pending';
      return status === 'pending';
    });
  }, [ordersList]);

  const confirmedOrders = useMemo(() => {
    return ordersList.filter(group => {
      const status = group[0]?.orderStatus;
      return status === 'confirmed';
    });
  }, [ordersList]);

  const renderOrderCard = (resGroup: Reservation[]) => {
    const firstRes = resGroup[0];
    const groupKey = `${firstRes.userName}-${firstRes.locationId}-${firstRes.date}-${firstRes.time}-${firstRes.duration}-${firstRes.createdAt}`;
    
    // Get list of space/room names this group spans
    const spaceNames = resGroup.map(r => getRoomName(r.locationId, r.roomId)).join(', ');
    
    // Gather all items from rooms in this group
    const allOrderedItems: Array<{ itemId: string; quantity: number; comment?: string; deliveryTime?: string }> = [];
    resGroup.forEach(res => {
      if (res.selectedMenuItems) {
        res.selectedMenuItems.forEach(item => {
          allOrderedItems.push(item);
        });
      }
    });

    // Get general comments
    const generalComment = resGroup.find(r => r.totalOrderComment && r.totalOrderComment.trim() !== '')?.totalOrderComment;

    const groupIds = resGroup.map(r => r.id);
    const firstResStatus = firstRes.orderStatus || 'pending';

    return (
      <div 
        key={groupKey} 
        className="bg-slate-50/70 p-4 rounded-3xl border border-slate-100 flex flex-col gap-3 relative shadow-sm hover:border-blue-300 hover:bg-white hover:shadow-md transition-all duration-300 animate-in fade-in"
      >
        {/* Header: Customer Photo, Name, space they are in */}
        <div className="flex items-start gap-2.5">
          <img 
            src={getCustomerPfp(firstRes.userName)} 
            className="w-9 h-9 rounded-xl object-cover border border-slate-100 shadow-sm shrink-0" 
            alt={firstRes.userName} 
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900 leading-tight truncate">{firstRes.userName}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate mt-0.5 flex items-center gap-1">
              <LayoutGrid size={10} className="text-slate-400 shrink-0" />
              <span className="truncate">{spaceNames}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[8px] font-black bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded uppercase tracking-wider block">
              {formatTo12h(firstRes.time)}
            </span>
          </div>
        </div>

        {/* Ordered items listing */}
        {allOrderedItems.length > 0 && (
          <div className="space-y-1.5">
            {allOrderedItems.map((item, idx) => {
              const itemName = getMenuItemName(firstRes, item.itemId);
              return (
                <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-sm flex flex-col gap-1 hover:border-blue-100 transition-all">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="flex items-center gap-1.5 font-black text-slate-800">
                      <span className="text-blue-600 bg-blue-50/50 px-1 py-0.5 rounded font-black text-[9px]">x{item.quantity}</span> 
                      {itemName}
                    </span>
                  </div>
                  {item.deliveryTime && (
                    <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-100/60 px-1.5 py-0.5 rounded-full flex items-center gap-1 self-start uppercase tracking-wider">
                      <Clock size={8} /> {item.deliveryTime}
                    </span>
                  )}
                  {item.comment && item.comment.trim() !== '' && (
                    <p className="text-[9px] text-blue-600 font-semibold italic pl-1.5 border-l border-blue-200">
                      "{item.comment}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* General Order Comment */}
        {generalComment && (
          <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100 text-[9px] text-amber-800 font-medium leading-normal">
            <p className="font-black uppercase tracking-widest text-[8px] text-amber-500 mb-0.5 flex items-center gap-1">
              <AlertCircle size={9} /> General Note
            </p>
            "{generalComment}"
          </div>
        )}

        {/* Order Status Badge & Controls */}
        <div className="flex items-center justify-between border-t border-slate-100/80 pt-2.5 mt-0.5">
          <div>
            {firstResStatus === 'confirmed' ? (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Confirmed
              </span>
            ) : firstResStatus === 'cancelled' ? (
              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Cancelled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Pending
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {firstResStatus !== 'confirmed' && (
              <button
                onClick={() => onUpdateOrderStatus?.(groupIds, 'confirmed')}
                className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-xl border border-emerald-100 transition-all hover:scale-105 active:scale-95"
              >
                <CheckCircle size={10} /> Confirm
              </button>
            )}
            {firstResStatus !== 'cancelled' && (
              <button
                onClick={() => onUpdateOrderStatus?.(groupIds, 'cancelled')}
                className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded-xl border border-rose-100 transition-all hover:scale-105 active:scale-95"
              >
                <XCircle size={10} /> Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col p-10 overflow-auto bg-slate-50/30">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start h-full pb-10">
        
        {/* Left Side: Space Bookings List */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {currentLocPolicy && currentLocPolicy.trim() !== '' && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-[2rem] p-6 flex items-start gap-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-100/80 flex items-center justify-center text-blue-600 shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1">
                  {currentLoc?.name || 'Branch'} Cancellation Policy
                </h4>
                <p className="text-xs font-semibold text-slate-600 leading-relaxed italic">
                  "{currentLocPolicy}"
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">
                  * Note: This is plain text. Read this to guests over the phone or in person. Non-editable by staff.
                </p>
              </div>
            </div>
          )}
          
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col relative">
            {groupedReservations.length > itemsPerPage && (
              <div className="absolute top-6 right-8 z-10 flex items-center gap-4 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-sm transition-all hover:bg-white">
                <button 
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  className="p-2 rounded-xl hover:bg-slate-50 disabled:opacity-20 transition-all text-slate-600 active:scale-95"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 select-none">
                  PAGE {currentPage + 1} OF {totalPages}
                </div>
                <button 
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                  className="p-2 rounded-xl hover:bg-slate-50 disabled:opacity-20 transition-all text-slate-600 active:scale-95"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Space & Type</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentItems.length > 0 ? (
                    currentItems.map((resGroup) => {
                      const firstRes = resGroup[0];
                      const isBatch = resGroup.length > 1;
                      const groupKey = `${firstRes.userName}-${firstRes.locationId}-${firstRes.date}-${firstRes.time}-${firstRes.duration}-${firstRes.createdAt}`;
                      const isExpanded = expandedRoomsGroupId === groupKey;
                      
                      const isApproved = resGroup.every(r => r.status === 'approved');
                      const isDeclined = resGroup.every(r => r.status === 'declined');
                      const isPending = resGroup.every(r => r.status === 'pending');
                      
                      let status = 'pending';
                      if (isApproved) status = 'approved';
                      else if (isDeclined) status = 'declined';
                      else if (!isPending) status = 'mixed';

                      return (
                        <tr key={firstRes.id} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => { 
                          const user = allUsers.find(u => u.name === firstRes.userName) || {
                            uid: `guest-${firstRes.userName}`,
                            name: firstRes.userName,
                            pfp: getCustomerPfp(firstRes.userName),
                            email: `${firstRes.userName.toLowerCase().replace(' ', '.')}@novaspace.work`,
                            phone: '+1 (555) 234-8902',
                            role: 'customer' as const,
                            credits: 0,
                            paymentMethods: [],
                          };
                          setSelectedCustomer(user); 
                          setShowHistory(false); 
                        }}>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <img src={getCustomerPfp(firstRes.userName)} className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-100 shadow-sm transition-transform group-hover:scale-105" alt={firstRes.userName} />
                              <div>
                                <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{firstRes.userName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${status === 'approved' ? 'bg-emerald-100 text-emerald-700' : status === 'pending' ? 'bg-amber-100 text-amber-700' : status === 'mixed' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>{status}</span>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client</p>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <LayoutGrid size={16} className="text-slate-300" />
                                <span className="text-sm font-bold text-slate-700">{getRoomName(firstRes.locationId, firstRes.roomId)}</span>
                              </div>
                              <div className="flex flex-col gap-0.5 ml-6 mt-1">
                                {(() => {
                                  const reservationPrice = resGroup.reduce((sum, res) => {
                                    const loc = locations.find(l => l.id === res.locationId);
                                    const room = loc?.floors.flatMap(f => f.rooms).find(r => r.id === res.roomId);
                                    const [startHour, startMin] = res.time.split(':').map(Number);
                                    const durationMs = res.duration * 60 * 60 * 1000;
                                    const hours = durationMs / (1000 * 60 * 60);
                                    return sum + (room?.pricePerHour || 0) * hours;
                                  }, 0);
                                  
                                  const inStorePrice = resGroup.reduce((sum, res) => {
                                    const itemsSum = res.selectedMenuItems?.reduce((itemSum, item) => {
                                      const menuItemPrice = resolveMenuItemPrice(item.itemId, {
                                        vendor: selectedVendor,
                                        locations,
                                      });
                                      return itemSum + menuItemPrice * item.quantity;
                                    }, 0) || 0;
                                    return sum + itemsSum;
                                  }, 0);

                                  return (
                                    <>
                                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                        Total: {(reservationPrice + inStorePrice).toLocaleString()} EGP
                                      </span>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Reservation: {reservationPrice.toLocaleString()} EGP
                                      </span>
                                      {inStorePrice > 0 && (
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                          Menu purchases: {inStorePrice.toLocaleString()} EGP
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              {isBatch && (
                                <div className="flex items-center gap-1.5 ml-6 relative">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedRoomsGroupId(isExpanded ? null : groupKey);
                                    }}
                                    className={`text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-tighter flex items-center gap-1.5 transition-all active:scale-95 shadow-sm ${
                                      isExpanded 
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-blue-100' 
                                        : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100 hover:border-blue-200'
                                    }`}
                                  >
                                    <Layers size={10} />
                                    + {resGroup.length - 1} OTHER ROOMS
                                  </button>
                                  
                                  {isExpanded && (
                                    <div className="absolute top-full left-0 mt-4 w-64 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl p-5 z-[60] animate-in fade-in zoom-in-95 duration-200 ring-4 ring-slate-900/5" onClick={e => e.stopPropagation()}>
                                      <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Request Contents</p>
                                         <button onClick={() => setExpandedRoomsGroupId(null)} className="text-slate-300 hover:text-slate-600 p-1 transition-colors"><X size={14} /></button>
                                      </div>
                                      <div className="space-y-3">
                                        {resGroup.map((r, i) => (
                                          <div key={r.id} className="flex items-start gap-3 group/room animate-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                                             <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.4)]"></div>
                                             <div className="flex flex-col">
                                               <span className="text-[12px] font-black text-slate-800 leading-tight">{getRoomName(r.locationId, r.roomId)}</span>
                                             </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6"><div className="flex items-center gap-2"><MapPin size={16} className="text-slate-300" /><span className="text-sm font-bold text-slate-700">{getLocationName(firstRes.locationId)}</span></div></td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 text-slate-900 font-black text-sm"><Calendar size={14} className="text-blue-500" />{firstRes.date}</div>
                              <div className="flex items-center gap-2 text-slate-400 font-bold text-[11px] mt-1"><Clock size={14} />{formatTo12h(firstRes.time)} to {getEndTime(firstRes.time, firstRes.duration)}</div>
                            </div>
                          </td>
                          <td className="px-8 py-6 cursor-default">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest border ${firstRes.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : firstRes.paymentMethod === 'credits' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                               {firstRes.paymentMethod === 'credits' ? <Coins size={14} /> : <CreditCard size={14} />}
                               {firstRes.paymentMethod === 'cash' ? 'Cash' : firstRes.paymentMethod === 'credits' ? 'Nova Credit' : 'Prepaid'}
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right cursor-default">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              {!isApproved && (
                                <button 
                                  onClick={() => handleApproveAction(resGroup)} 
                                  className="p-2.5 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all opacity-0 group-hover:opacity-100" 
                                >
                                  <CheckCircle size={20} />
                                </button>
                              )}
                              <button 
                                onClick={() => setCancellingGroup(resGroup)} 
                                className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100" 
                              >
                                <XCircle size={20} />
                              </button>
                              <button className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-all"><MoreHorizontal size={20} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={6} className="px-8 py-20 text-center"><div className="flex flex-col items-center justify-center text-slate-300"><Search size={48} className="mb-4 opacity-20" /><p className="text-xl font-black text-slate-400">No reservations found</p></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Service Orders Stream Bar */}
        <div className="xl:col-span-5 bg-white rounded-[2.5rem] border border-slate-200 p-6 flex flex-col relative max-h-[85vh] shadow-xl overflow-hidden">
          <div className="mb-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Coffee size={18} className="text-blue-500" />
              Active Orders
            </h3>
            <span className="text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-wider">
              {ordersList.length} {ordersList.length === 1 ? 'Order' : 'Orders'}
            </span>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden h-full">
            {/* Pending Column */}
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Pending</p>
                </div>
                <span className="text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                  {pendingOrders.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4 scrollbar-thin custom-scrollbar">
                {pendingOrders.length > 0 ? (
                  pendingOrders.map((resGroup) => renderOrderCard(resGroup))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 border border-slate-100 border-dashed rounded-3xl h-full min-h-[150px]">
                    <Coffee size={24} className="text-slate-300 mb-2 opacity-50 animate-bounce-subtle" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center leading-relaxed">
                      No Pending
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmed Column */}
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Confirmed</p>
                </div>
                <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                  {confirmedOrders.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4 scrollbar-thin custom-scrollbar">
                {confirmedOrders.length > 0 ? (
                  confirmedOrders.map((resGroup) => renderOrderCard(resGroup))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 border border-slate-100 border-dashed rounded-3xl h-full min-h-[150px]">
                    <Coffee size={24} className="text-slate-300 mb-2 opacity-50" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center leading-relaxed">
                      No Confirmed
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {approvalFeedback && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-6 rounded-3xl shadow-2xl flex items-center gap-6 animate-in fade-in slide-in-from-bottom-6 z-[200] ring-4 ring-slate-900/10">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-in zoom-in-50 duration-500">
            <BellRing size={28} strokeWidth={2.5} className="animate-bounce" />
          </div>
          <div>
            <p className="font-black text-xl tracking-tight">Reservation Approved!</p>
            <p className="text-sm font-medium text-slate-400">Notification sent to <span className="text-white font-bold">{approvalFeedback.userName}</span>.</p>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="relative h-32 bg-gradient-to-br from-blue-600 to-indigo-700 shrink-0"><button onClick={() => setSelectedCustomer(null)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"><X size={20} /></button><div className="absolute -bottom-12 left-10"><UserAvatar pfp={selectedCustomer.pfp} name={selectedCustomer.name} profession={selectedCustomer.profession} size="xl" className="shadow-xl" /></div></div>
            <div className="pt-16 px-10 pb-12 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-8"><div><h3 className="text-3xl font-black text-slate-900 tracking-tight">{selectedCustomer.name}</h3><p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1">{selectedCustomer.role || 'Global Member'}</p></div><div className="bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-100"><ShieldCheck size={14} className="text-emerald-600" /><span className="text-[10px] font-black text-emerald-700 uppercase">Verified</span></div></div>
                {!showHistory ? (
                  <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                      <div className="flex items-center gap-4 group"><div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><Mail size={18} /></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</p><p className="text-sm font-bold text-slate-700">{selectedCustomer.email}</p></div></div>
                      <div className="flex items-center gap-4 group"><div className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><Phone size={18} /></div><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Number</p><p className="text-sm font-bold text-slate-700">{selectedCustomer.phone}</p></div></div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in slide-in-from-right-4 duration-300"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Reservation History</p>{customerHistory.length > 0 ? (customerHistory.map(res => (<div key={res.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-white hover:shadow-md transition-all"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${res.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}><Calendar size={18} /></div><div><p className="text-sm font-black text-slate-900">{getRoomName(res.locationId, res.roomId)}</p><p className="text-[10px] font-bold text-slate-400">{res.date} • {formatTo12h(res.time)} ({res.duration}hr)</p></div></div><ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" /></div>))) : (<p className="text-sm font-bold text-slate-400 py-10 text-center">No history available</p>)}</div>
                )}
                <div className="mt-12"><button onClick={() => setShowHistory(!showHistory)} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3">{showHistory ? 'Back to Details' : 'View Reservation History'}<ChevronRight size={18} className={`transition-transform duration-300 ${showHistory ? 'rotate-180' : ''}`} /></button></div>
            </div>
          </div>
        </div>
      )}

      {cancellingGroup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 text-center animate-in zoom-in-95 duration-300">
             <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 text-rose-600 bg-rose-50">
                <AlertCircle size={40} />
             </div>
             <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Do you want to confirm?</h3>
             <p className="text-slate-500 font-bold mb-6">
               Are you sure you want to decline and cancel the reservation for <span className="text-slate-900">{cancellingGroup[0].userName}</span>?
             </p>
             
             <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-left">
               <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                 <ShieldCheck size={14} />
                 Cancellation Policy (Subtext)
               </p>
               <p className="text-[11px] font-medium text-rose-500 leading-relaxed italic">
                 "{activeCancellationPolicy || 'No custom policy set for this branch (inheriting brand-wide fallback)'}"
               </p>
             </div>
             
             <div className="flex gap-4">
                <button onClick={() => setCancellingGroup(null)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-xs">Back</button>
                <button 
                  onClick={() => {
                    cancellingGroup.forEach(r => onCancelReservation(r.id));
                    setCancellingGroup(null);
                  }} 
                  className="flex-[2] py-4 bg-rose-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-rose-100"
                >
                  Confirm Cancellation
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Add-ons Modal */}
      {viewingAddonsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setViewingAddonsFor(null)} />
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
               <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                   <Coffee size={20} />
                 </div>
                 Requested Add-ons
               </h3>
               <button onClick={() => setViewingAddonsFor(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all">
                 <X size={20} />
               </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 bg-slate-50">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Customer</p>
                   <div className="flex items-center gap-3">
                     <img src={getCustomerPfp(viewingAddonsFor.userName)} className="w-10 h-10 rounded-xl object-cover border border-slate-100 shadow-sm" alt={viewingAddonsFor.userName} />
                     <div>
                       <p className="text-sm font-black text-slate-900 leading-tight">{viewingAddonsFor.userName}</p>
                       <div className="mt-1">
                         <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${viewingAddonsFor.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : viewingAddonsFor.status === 'pending' ? 'bg-amber-100 text-amber-700' : (viewingAddonsFor.status as string) === 'mixed' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>{viewingAddonsFor.status}</span>
                       </div>
                     </div>
                   </div>
                 </div>
                 <div className="flex flex-col justify-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Space & Schedule</p>
                   <p className="text-sm font-bold text-slate-900 mb-0.5 flex items-center gap-1.5"><LayoutGrid size={14} className="text-slate-400" />{getRoomName(viewingAddonsFor.locationId, viewingAddonsFor.roomId)}</p>
                   <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><Calendar size={12} className="text-blue-500" />{viewingAddonsFor.date} • {formatTo12h(viewingAddonsFor.time)}</p>
                 </div>
              </div>

              {viewingAddonsFor.selectedMenuItems && viewingAddonsFor.selectedMenuItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Ordered Items</p>
                  <div className="space-y-3">
                    {viewingAddonsFor.selectedMenuItems.map((item, idx) => {
                      const itemName = getMenuItemName(viewingAddonsFor, item.itemId);
                      return (
                        <div key={idx} className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-blue-200">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-[10px] flex items-center justify-center text-sm font-black shrink-0 shadow-inner">
                                x{item.quantity}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800 leading-tight mb-1">
                                  {itemName}
                                </span>
                                {item.deliveryTime && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                                    <Clock size={12} className="text-blue-400" />
                                    {item.deliveryTime}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {item.comment && (
                            <div className="mt-1 text-xs font-bold text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2">
                              <AlertCircle size={14} className="text-slate-400 shrink-0 mt-0.5" />
                              <span className="leading-relaxed">"{item.comment}"</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {viewingAddonsFor.totalOrderComment && (
                <div className="mt-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">General Order Comment</p>
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
                    <div className="flex items-start gap-3 text-amber-700">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <p className="text-sm font-bold text-amber-900 leading-relaxed">
                        {viewingAddonsFor.totalOrderComment}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-white">
               <button 
                 onClick={() => setViewingAddonsFor(null)}
                 className="w-full py-4 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-all text-sm tracking-widest uppercase"
               >
                 Close
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
