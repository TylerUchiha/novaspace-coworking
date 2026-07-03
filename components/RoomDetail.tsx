
import React, { useState, useMemo, useEffect } from 'react';
import { Room, RoomStatus, UserProfile, Vendor, MenuItem } from '../types';
import { Users, Wifi, Tv, Coffee, Wind, X, CreditCard, Clock, Sparkles, Zap, Search, UserPlus, Mail, User, Phone, ShieldCheck, Coins, Plus, Minus, Utensils, Check, ChevronLeft, ChevronRight, Maximize2, AlertCircle, Banknote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserAvatar } from './UserAvatar';

interface RoomDetailProps {
  rooms: Room[];
  onBook: (rooms: Room[], duration: number, paymentMethod: string, targetUser?: UserProfile, selectedMenuItems?: { itemId: string; quantity: number; comment?: string }[], totalPriceOverride?: number, totalOrderComment?: string) => void;
  selectedDate: string;
  selectedTime: string;
  selectedTime24: string;
  isStaff?: boolean;
  allUsers?: UserProfile[];
  userProfile?: UserProfile;
  reservationTimer?: number | null;
  cancellationPolicy?: string;
  vendor?: Vendor;
  basket?: Record<string, number>;
  basketComments?: Record<string, string>;
  basketDeliveryTimes?: Record<string, string>;
  totalOrderComment?: string;
  menuPrice?: number;
  currentMenu?: MenuItem[];
  getBasketItemDetails?: (id: string) => MenuItem | undefined;
  onRemoveRoom?: (roomId: string) => void;
  onUpdateProfile?: (newProfile: UserProfile) => void;
  bookingDuration: number;
  onDurationChange: (newDuration: number) => void;
}

const RoomDetail: React.FC<RoomDetailProps> = ({ rooms, onBook, selectedDate, selectedTime, selectedTime24, isStaff = false, allUsers = [], userProfile, reservationTimer = null, cancellationPolicy, vendor, basket = {}, basketComments = {}, basketDeliveryTimes = {}, totalOrderComment = "", menuPrice = 0, currentMenu, getBasketItemDetails, onRemoveRoom, onUpdateProfile, bookingDuration, onDurationChange }) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'credits' | 'cash'>('card');
  
  const savedCards = userProfile?.paymentMethods || [];
  const defaultCard = savedCards.find(c => c.isDefault) || savedCards[0];
  const [selectedCardId, setSelectedCardId] = useState<string>(defaultCard ? defaultCard.id : 'new');
  
  const [newCardData, setNewCardData] = useState({ number: '', expiry: '', cvc: '', name: '', save: false });
  
  // Staff Selection States
  const [staffMode, setStaffMode] = useState<'select' | 'create' | 'guest'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffUser, setSelectedStaffUser] = useState<UserProfile | null>(null);
  
  // Create New User Form
  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '' });

  // Gallery State
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const hasUnassignedItems = Object.keys(basket).some(id => (basket[id] as number) > 0 && !basketDeliveryTimes[id]);
  const allImages = useMemo(() => {
    const images: string[] = [];
    rooms.forEach(room => {
      if (room.images && room.images.length > 0) {
        images.push(...room.images);
      } else {
        // Fallback images if none provided
        images.push(`https://picsum.photos/seed/${room.id}-1/800/600`);
        images.push(`https://picsum.photos/seed/${room.id}-2/800/600`);
      }
    });
    return images;
  }, [rooms]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [rooms]);

  useEffect(() => {
    if (allImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % allImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [allImages]);

  const nextImage = () => setCurrentImageIndex(prev => (prev + 1) % allImages.length);
  const prevImage = () => setCurrentImageIndex(prev => (prev - 1 + allImages.length) % allImages.length);

  const endTimestamp = useMemo(() => {
    const [h, m] = selectedTime24.split(':').map(Number);
    const totalMinutes = h * 60 + m + (bookingDuration * 60);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = Math.round(totalMinutes % 60);
    const period = endH >= 12 ? 'PM' : 'AM';
    const displayH = endH % 12 || 12;
    return `${displayH}:${endM.toString().padStart(2, '0')} ${period}`;
  }, [selectedTime24, bookingDuration]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return allUsers.slice(0, 5);
    const query = searchQuery.toLowerCase().trim();
    return allUsers.filter(u => 
      u.name.toLowerCase().includes(query) || 
      u.email.toLowerCase().includes(query) || 
      (u.phone && u.phone.includes(query))
    ).slice(0, 5);
  }, [allUsers, searchQuery]);

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center py-20">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-8 ring-8 ring-slate-100">
          <Zap size={40} className="text-slate-300" />
        </div>
        <p className="text-2xl font-black text-slate-900 tracking-tight">Inspect Live Space</p>
        <p className="text-base mt-3 text-slate-500 font-medium leading-relaxed">
          {isStaff ? 'Select rooms on the blueprint to initiate an administrative booking or check occupancy logs.' : `Select an available room on the map to book for ${selectedDate} @ ${selectedTime}.`}
        </p>
      </div>
    );
  }

  const isBatch = rooms.length > 1;
  const roomPrice = rooms.reduce((sum, r) => sum + r.pricePerHour, 0) * bookingDuration;
  
  const totalPrice = roomPrice + menuPrice;
  const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);

  const handleConfirm = () => { 
    const menuItems = Object.entries(basket)
      .filter(([id, qty]) => (qty as number) > 0)
      .map(([itemId, quantity]) => ({ 
        itemId, 
        quantity: quantity as number,
        comment: basketComments[itemId],
        deliveryTime: basketDeliveryTimes[itemId]
      }));

    let finalPaymentMethod = paymentMethod;
    if (paymentMethod === 'card') {
      if (selectedCardId === 'new') {
        const type = newCardData.number.startsWith('4') ? 'Visa' : 'Mastercard';
        const last4 = newCardData.number.slice(-4).padStart(4, '0');
        finalPaymentMethod = newCardData.name ? `•••• ${last4} (${newCardData.name})` : `${type} •••• ${last4}`;
        
        if (newCardData.save && userProfile && onUpdateProfile) {
          const newMethod = {
            id: Date.now().toString(),
            type,
            last4,
            expiry: newCardData.expiry,
            isDefault: savedCards.length === 0,
            name: newCardData.name
          };
          onUpdateProfile({
            ...userProfile,
            paymentMethods: [...savedCards, newMethod]
          });
        }
      } else {
        const card = savedCards.find(c => c.id === selectedCardId);
        if (card) {
          finalPaymentMethod = card.name ? `•••• ${card.last4} (${card.name})` : `${card.type} •••• ${card.last4}`;
        }
      }
    }

    if (isStaff) {
      if (staffMode === 'create' && newUser.name && newUser.email && newUser.phone) {
        onBook(rooms, bookingDuration, finalPaymentMethod, { ...newUser, role: 'Member', pfp: `https://picsum.photos/400/400?seed=${newUser.name}`, credits: 0, paymentMethods: [], profession: 'New Member' }, menuItems, totalPrice, totalOrderComment);
      } else if (staffMode === 'select' && selectedStaffUser) {
        onBook(rooms, bookingDuration, finalPaymentMethod, selectedStaffUser, menuItems, totalPrice, totalOrderComment);
      } else if (staffMode === 'guest') {
        onBook(rooms, bookingDuration, finalPaymentMethod, { name: 'Guest User', email: `guest_${Date.now()}@novaspace.ai`, phone: '', role: 'Member', pfp: '', credits: 0, paymentMethods: [], profession: 'Guest' }, menuItems, totalPrice, totalOrderComment);
      }
    } else {
      onBook(rooms, bookingDuration, finalPaymentMethod, undefined, menuItems, totalPrice, totalOrderComment);
    }
    setIsConfirmOpen(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-8 space-y-6">
      <div className="shrink-0 flex items-center justify-between mb-4">
        <div>
           <span className="inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] bg-blue-100 text-blue-600 mb-2">{isBatch ? 'BATCH SELECTION' : 'ROOM DETAILS'}</span>
           <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{isBatch ? `${rooms.length} Spaces` : rooms[0].name}</h2>
           {menuPrice > 0 && (
             <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
               In-store purchases: {menuPrice.toLocaleString()} EGP
             </p>
           )}
        </div>
        <div className="text-right"><p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">TOTAL COST</p><span className="text-2xl font-black text-blue-600 tracking-tighter">{totalPrice.toLocaleString()} EGP</span></div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar">
         {isBatch && (
           <div className="flex flex-wrap gap-2">
             {rooms.map(r => (
               <div key={r.id} className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 flex items-center gap-2">
                 {r.name}
                 {onRemoveRoom && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); onRemoveRoom(r.id); }}
                     className="hover:text-rose-500 transition-colors"
                   >
                     <X size={12} />
                   </button>
                 )}
               </div>
             ))}
           </div>
         )}
         {/* Gallery Section */}
         <div 
           onClick={() => setIsLightboxOpen(true)}
           className="relative group h-48 w-full rounded-3xl overflow-hidden bg-slate-100 shadow-inner cursor-pointer"
         >
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImageIndex}
                src={allImages[currentImageIndex]}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </AnimatePresence>
            
            {allImages.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center text-slate-900 shadow-lg transition-all hover:bg-white active:scale-90 z-10"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center text-slate-900 shadow-lg transition-all hover:bg-white active:scale-90 z-10"
                >
                  <ChevronRight size={16} />
                </button>
                
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {allImages.map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1 rounded-full transition-all duration-300 ${i === currentImageIndex ? 'w-4 bg-white' : 'w-1 bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
            
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="p-3 bg-white/90 backdrop-blur-sm rounded-2xl text-slate-900 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 shadow-xl">
                <Maximize2 size={20} />
              </div>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col gap-1 border border-slate-100">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Capacity</span>
               <div className="flex items-center gap-2 font-black text-slate-900 text-sm"><Users size={14} /> {totalCapacity} Pax</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col gap-1 border border-slate-100">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Finishes</span>
               <div className="flex items-center gap-2 font-black text-slate-900 text-sm"><Clock size={14} /> {endTimestamp}</div>
            </div>
         </div>

         <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Schedule Duration</h3>
            <div className="grid grid-cols-4 gap-2">{[1, 2, 3, 4].map(h => (<button key={h} onClick={() => onDurationChange(h)} className={`py-3 rounded-xl font-black text-xs transition-all border-2 ${bookingDuration === h ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'}`}>{h}h</button>))}</div>
         </div>

         {!isStaff && userProfile && (
           <div className="space-y-4">
             <div className="flex items-center justify-between">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</h3>
               <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg">
                 <Sparkles size={10} />
                 <span className="text-[10px] font-black uppercase tracking-widest">{userProfile.credits.toLocaleString()} EGP</span>
               </div>
             </div>
             <div className="grid grid-cols-3 gap-3">
               <button 
                 onClick={() => setPaymentMethod('card')}
                 className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'card' ? 'border-blue-600 bg-blue-50/50 text-blue-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
               >
                 <CreditCard size={20} />
                 <span className="text-[10px] font-black uppercase tracking-widest text-center">Card</span>
               </button>
               <button 
                 onClick={() => setPaymentMethod('credits')}
                 disabled={userProfile.credits < totalPrice}
                 className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${paymentMethod === 'credits' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
               >
                 <Coins size={20} />
                 <span className="text-[10px] font-black uppercase tracking-widest text-center">Nova Balance</span>
               </button>
               <button 
                 onClick={() => setPaymentMethod('cash')}
                 className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'cash' ? 'border-amber-500 bg-amber-50 text-amber-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
               >
                 <Banknote size={20} />
                 <span className="text-[10px] font-black uppercase tracking-widest text-center">Cash</span>
               </button>
             </div>

             {paymentMethod === 'card' && (
               <div className="mt-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Card</label>
                 <select 
                   value={selectedCardId}
                   onChange={(e) => setSelectedCardId(e.target.value)}
                   className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-900 text-sm mb-4"
                 >
                   {savedCards.map(card => (
                     <option key={card.id} value={card.id}>
                       {card.name ? `•••• ${card.last4} (${card.name})` : `${card.type} •••• ${card.last4}`}
                     </option>
                   ))}
                   <option value="new">+ Use a new card</option>
                 </select>

                 {selectedCardId === 'new' && (
                   <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                     <input 
                       type="text" 
                       placeholder="Card Name (Optional)"
                       value={newCardData.name}
                       onChange={e => setNewCardData(prev => ({ ...prev, name: e.target.value }))}
                       className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-slate-900 text-sm"
                     />
                     <input 
                       type="text" 
                       placeholder="Card Number (0000 0000 0000 0000)"
                       value={newCardData.number}
                       onChange={e => setNewCardData(prev => ({ ...prev, number: e.target.value.replace(/\D/g, '').slice(0, 16) }))}
                       className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-slate-900 text-sm"
                     />
                     <div className="grid grid-cols-2 gap-3">
                       <input 
                         type="text" 
                         placeholder="MM/YY"
                         value={newCardData.expiry}
                         onChange={e => {
                           let val = e.target.value.replace(/\D/g, '');
                           if (val.length >= 2) val = val.slice(0, 2) + '/' + val.slice(2, 4);
                           setNewCardData(prev => ({ ...prev, expiry: val }));
                         }}
                         className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-slate-900 text-sm"
                       />
                       <input 
                         type="text" 
                         placeholder="CVC"
                         value={newCardData.cvc}
                         onChange={e => setNewCardData(prev => ({ ...prev, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                         className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-slate-900 text-sm"
                       />
                     </div>
                     <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                       <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${newCardData.save ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
                         {newCardData.save && <Check size={12} className="text-white" />}
                       </div>
                       <input 
                         type="checkbox" 
                         className="hidden"
                         checked={newCardData.save}
                         onChange={(e) => setNewCardData(prev => ({ ...prev, save: e.target.checked }))}
                       />
                       <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Save this card for future use</span>
                     </label>
                   </div>
                 )}
               </div>
             )}

             {userProfile.credits < totalPrice && paymentMethod === 'credits' && (
               <p className="text-[10px] font-bold text-rose-500 text-center">Insufficient credits for this booking.</p>
             )}
           </div>
         )}

         {cancellationPolicy && cancellationPolicy.trim() !== '' && (
           <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
             <div className="flex items-center gap-2 mb-2">
               <ShieldCheck size={14} className="text-blue-600" />
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cancellation Policy</span>
             </div>
             <p className="text-[11px] font-medium text-slate-500 leading-relaxed italic">
               "{cancellationPolicy}"
             </p>
           </div>
         )}

         {isStaff && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assign Member</h3>
                  <div className="flex gap-2">
                     <button onClick={() => setStaffMode('select')} className={`text-[8px] font-black px-2 py-1 rounded transition-all ${staffMode === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>EXISTING</button>
                     <button onClick={() => setStaffMode('create')} className={`text-[8px] font-black px-2 py-1 rounded transition-all ${staffMode === 'create' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>NEW ACCOUNT</button>
                     <button onClick={() => setStaffMode('guest')} className={`text-[8px] font-black px-2 py-1 rounded transition-all ${staffMode === 'guest' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>GUEST</button>
                  </div>
               </div>

               {staffMode === 'guest' ? (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                     <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-black shrink-0">
                        G
                     </div>
                     <div>
                        <h4 className="text-sm font-black text-slate-800">Guest Checkout</h4>
                        <p className="text-[10px] font-bold text-slate-400">No account will be created</p>
                     </div>
                  </div>
               ) : staffMode === 'select' ? (
                  <div className="space-y-4">
                     <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                           type="text" 
                           placeholder="Search by name or phone..." 
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                           className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-400 transition-all"
                        />
                     </div>
                     <div className="space-y-2">
                        {filteredUsers.map(user => (
                           <button key={user.email} onClick={() => setSelectedStaffUser(user)} className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-all ${selectedStaffUser?.email === user.email ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-50' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                              <UserAvatar pfp={user.pfp} name={user.name} profession={user.profession} size="sm" className="shrink-0" />
                              <div className="text-left">
                                 <p className="text-[11px] font-black text-slate-900">{user.name}</p>
                                 <p className="text-[9px] font-bold text-slate-400">{user.email} {user.phone ? `• ${user.phone}` : ''}</p>
                              </div>
                              {selectedStaffUser?.email === user.email && <div className="ml-auto bg-indigo-600 text-white p-1 rounded-full"><Zap size={10} fill="currentColor" /></div>}
                           </button>
                        ))}
                     </div>
                  </div>
               ) : (
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <div className="relative">
                           <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                           <input 
                              type="text" 
                              value={newUser.name}
                              onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                              placeholder="Customer Name"
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white transition-all"
                           />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                        <div className="relative">
                           <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                           <input 
                              type="email" 
                              value={newUser.email}
                              onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                              placeholder="customer@email.com"
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white transition-all"
                           />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                        <div className="relative">
                           <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                           <input 
                              type="tel" 
                              value={newUser.phone}
                              onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                              placeholder="+1 (555) 000-0000"
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white transition-all"
                           />
                        </div>
                     </div>
                  </div>
               )}
            </div>
         )}
      </div>

      <div className="pt-6 shrink-0 border-t border-slate-100">
         {reservationTimer !== null && (
           <div className="mb-4 animate-in fade-in slide-in-from-bottom-2">
             <div className="flex items-center justify-between mb-2">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                 <Clock size={12} className="animate-pulse" />
                 Reservation expires in
               </span>
               <span className={`text-xs font-black ${reservationTimer < 15 ? 'text-rose-600' : 'text-blue-600'}`}>{reservationTimer}s</span>
             </div>
             <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
               <div 
                 className="h-full transition-all duration-1000 ease-linear" 
                 style={{ 
                   width: `${(reservationTimer / 60) * 100}%`,
                   backgroundColor: `rgb(${Math.floor(244 * (1 - reservationTimer/60) + 37 * (reservationTimer/60))}, ${Math.floor(63 * (1 - reservationTimer/60) + 99 * (reservationTimer/60))}, ${Math.floor(94 * (1 - reservationTimer/60) + 235 * (reservationTimer/60))})`
                 }}
               />
             </div>
           </div>
         )}
         <button 
           onClick={() => setIsConfirmOpen(true)} 
           disabled={bookingDuration === 0 || (isStaff && (staffMode === 'select' ? !selectedStaffUser : (staffMode === 'create' ? (!newUser.name || !newUser.email || !newUser.phone) : false)))}
           className={`w-full py-5 rounded-2xl font-black text-lg transition-all text-white shadow-2xl active:scale-[0.98] flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400 disabled:cursor-not-allowed ${isStaff ? 'bg-indigo-600' : 'bg-blue-600'}`}
         >
           {isStaff ? 'Finalize Admin Booking' : 'Finalize Reservation'}
           <Sparkles size={20} />
         </button>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsConfirmOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 text-center animate-in zoom-in-95">
             <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 text-white ${isStaff ? 'bg-indigo-600' : 'bg-blue-600'}`}>
                {isStaff ? <UserPlus size={40} /> : <CreditCard size={40} />}
             </div>
             <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Confirm Action</h3>
             {reservationTimer !== null && (
               <div className={`mb-6 flex items-center justify-center gap-2 font-black text-sm uppercase tracking-widest ${reservationTimer < 15 ? 'text-rose-500' : 'text-blue-500'}`}>
                 <Clock size={16} className="animate-pulse" />
                 Expires in {reservationTimer}s
               </div>
             )}
             <div className="mb-6 p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
               <div className="text-left">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Payment Method</p>
                 <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{paymentMethod === 'card' ? 'Card' : paymentMethod === 'cash' ? 'Cash' : 'Nova Balance'}</p>
               </div>
               <div className="text-right">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                 <p className="text-sm font-black text-blue-600 tracking-tight">{totalPrice.toLocaleString()} EGP</p>
               </div>
             </div>
             <p className="text-slate-500 font-bold mb-4">
                {isStaff 
                  ? `Assigning ${rooms.length} space(s) to ${staffMode === 'select' ? selectedStaffUser?.name : (staffMode === 'guest' ? 'Guest' : newUser.name)}.`
                  : `Finalizing your ${bookingDuration} hour reservation at ${selectedTime}.`}
             </p>

             {Object.keys(basket).length === 0 && !isStaff && (
               <div className="mb-6 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold p-4 rounded-2xl flex items-center gap-3 text-left">
                 <Coffee size={24} className="shrink-0" />
                 <p>Your basket is empty! Don't forget you can order coffee, snacks and more from the Service Menu</p>
               </div>
             )}

             {(Object.keys(basket).length > 0 || totalOrderComment) && (
               <div className="mb-6 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 text-left">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                   <Utensils size={14} /> Order Summary & Notes
                 </h4>
                 <div className="space-y-3">
                   {Object.entries(basket).filter(([_, qty]) => (qty as number) > 0).map(([id, itemsQty]) => {
                     const qty = itemsQty as number;
                     const item = getBasketItemDetails ? getBasketItemDetails(id) : currentMenu?.find(i => i.id === id);
                     return (
                       <div key={id} className="text-[11px]">
                         <div className="flex justify-between font-black text-slate-700">
                            <span>{qty}x {item?.name || 'Item'}</span>
                            <span>{(item?.price || 0) * qty} EGP</span>
                         </div>
                         {basketComments[id] && (
                           <p className="text-blue-600 font-medium italic mt-0.5 ml-2">"{basketComments[id]}"</p>
                         )}
                         {basketDeliveryTimes[id] && (
                           <p className="text-slate-500 font-bold mt-0.5 ml-2 text-[10px]">Delivery: {basketDeliveryTimes[id]}</p>
                         )}
                       </div>
                     );
                   })}
                   {totalOrderComment && (
                     <div className="mt-3 pt-3 border-t border-slate-200">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Order Comment</p>
                       <p className="text-[11px] font-medium text-slate-500 italic">"{totalOrderComment}"</p>
                     </div>
                   )}
                 </div>
               </div>
             )}
             
             {cancellationPolicy && cancellationPolicy.trim() !== '' && (
               <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-left">
                 <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                   <ShieldCheck size={14} />
                   Cancellation Policy
                 </p>
                 <p className="text-[11px] font-medium text-rose-500 leading-relaxed italic">
                   "{cancellationPolicy}"
                 </p>
               </div>
             )}
             
             <div className="flex gap-4 flex-col">
                {hasUnassignedItems && (
                  <div className="mb-2 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                    <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
                    <p className="text-[11px] font-bold text-rose-700 leading-snug text-left">
                      Make sure to select when you want your items served
                    </p>
                  </div>
                )}
                <div className="flex gap-4">
                  <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-xs">Back</button>
                  <button disabled={hasUnassignedItems} onClick={handleConfirm} className={`flex-[2] py-4 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed ${isStaff ? 'bg-indigo-600' : 'bg-blue-600'}`}>Confirm Booking</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 md:p-12"
          >
            <motion.div 
              initial={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(15, 23, 42, 0)" }}
              animate={{ backdropFilter: "blur(24px)", backgroundColor: "rgba(15, 23, 42, 0.2)" }}
              exit={{ backdropFilter: "blur(0px)", backgroundColor: "rgba(15, 23, 42, 0)" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0" 
              onClick={() => setIsLightboxOpen(false)} 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-4xl flex flex-col items-center justify-center gap-6"
            >
              <button 
                onClick={() => setIsLightboxOpen(false)}
                className="absolute -top-16 right-0 p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all z-20 flex items-center gap-2 group"
              >
                <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Close</span>
                <X size={20} />
              </button>

              <div className="relative w-full aspect-video flex items-center justify-center group/lightbox bg-black/20 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentImageIndex}
                    src={allImages[currentImageIndex]}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>

                {allImages.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); prevImage(); }}
                      className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all active:scale-90 z-10 border border-white/10"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); nextImage(); }}
                      className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all active:scale-90 z-10 border border-white/10"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}
                
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10 px-4 py-2 bg-black/20 backdrop-blur-md rounded-full border border-white/10">
                  {allImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i); }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${i === currentImageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="text-center">
                <h4 className="text-white font-black text-lg tracking-tight mb-1">{rooms[0].name}</h4>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">
                  Image {currentImageIndex + 1} of {allImages.length}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RoomDetail;
