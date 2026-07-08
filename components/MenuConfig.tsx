import React, { useState, useMemo, useEffect } from 'react';
import { MenuItem, Vendor, Category, LocationData, Room, UserProfile, Reservation } from '../types';
import { Plus, Minus, Search, CheckCircle, Coffee, User, CreditCard, Coins, Banknote, MapPin, X } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import MenuEditor from './MenuEditor';
import { mergeMenuCatalog } from '../utils/menuCatalog';
import { createWalkInMemberRemote } from '../services/cloudFunctions';

interface MenuConfigProps {
  vendor: Vendor;
  onUpdateVendor: (vendor: Vendor) => void;
  location: LocationData;
  onUpdateLocation: (updates: Partial<LocationData> | ((prev: LocationData) => Partial<LocationData>)) => void;
  onUpdateRoomMenu?: (roomId: string, patch: Partial<{ categories: Category[]; menu: MenuItem[] }>) => void;
  userRole: 'customer' | 'employee' | 'owner';
  allUsers?: UserProfile[];
  allReservations?: Reservation[];
  onBook?: (
    roomsToBook: Room[],
    duration: number,
    paymentMethod: string,
    targetUser?: UserProfile,
    selectedMenuItems?: { itemId: string; quantity: number; comment?: string; deliveryTime?: string }[],
    totalPriceOverride?: number,
    totalOrderComment?: string
  ) => void;
  onAppendToReservation?: (
    reservationId: string,
    menuItems: { itemId: string; quantity: number; comment?: string; deliveryTime?: string }[],
    totalPrice: number,
    orderComment?: string,
    paymentMethod?: string
  ) => void | Promise<void>;
}

const MenuConfig: React.FC<MenuConfigProps> = ({ vendor, location, onUpdateLocation, onUpdateVendor, onUpdateRoomMenu, userRole, allUsers = [], allReservations = [], onBook, onAppendToReservation }) => {
  const [ownerMenuScope, setOwnerMenuScope] = useState<'branch' | 'network' | 'room'>('branch');
  const [selectedRoomMenuId, setSelectedRoomMenuId] = useState('');

  const allRooms = useMemo(
    () => location.floors.flatMap((floor) => floor.rooms),
    [location.floors],
  );

  useEffect(() => {
    if (!selectedRoomMenuId && allRooms.length > 0) {
      setSelectedRoomMenuId(allRooms[0].id);
    }
  }, [allRooms, selectedRoomMenuId]);

  const selectedRoom = allRooms.find((room) => room.id === selectedRoomMenuId) || null;

  const currentTarget = useMemo(
    () => mergeMenuCatalog({ vendor, location }),
    [vendor, location],
  );

  const [activeCategory, setActiveCategory] = useState<Category | null>(currentTarget.categories.length > 0 ? currentTarget.categories[0] : null);
  
  const [orderBasket, setOrderBasket] = useState<Record<string, number>>({});
  const [orderComments, setOrderComments] = useState<Record<string, string>>({});
  const [orderGeneralNote, setOrderGeneralNote] = useState('');
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<'card' | 'credits' | 'cash'>('cash');
  const [orderSuccessMessage, setOrderSuccessMessage] = useState('');

  const [userMode, setUserMode] = useState<'select' | 'create' | 'guest'>('select');
  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '' });
  const [memberCreating, setMemberCreating] = useState(false);
  const [memberCreateError, setMemberCreateError] = useState<string | null>(null);

  const [searchUser, setSearchUser] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedReservationId, setSelectedReservationId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Handle setting active category if null initially
  useEffect(() => {
    if (!activeCategory && currentTarget.categories.length > 0) {
      setActiveCategory(currentTarget.categories[0]);
    }
  }, [currentTarget.categories, activeCategory]);

  const roomsList = useMemo(() => {
    return location.floors ? location.floors.flatMap(f => f.rooms) : [];
  }, [location]);

  const activeReservations = useMemo(() => {
    // Current reservations (pending or approved, not declined, for this location)
    // Could filter by today/current time in a real app
    return allReservations.filter(r => r.locationId === location.id && r.status !== 'declined');
  }, [allReservations, location.id]);

  const switchUserMode = (mode: 'select' | 'create' | 'guest') => {
    setUserMode(mode);
    setSearchUser('');
    if (mode === 'guest') {
      setSelectedCustomerId('guest');
    } else {
      setSelectedCustomerId('');
    }
    if (mode === 'create') setNewUser({ name: '', email: '', phone: '' });
  };

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => u.name.toLowerCase().includes(searchUser.toLowerCase()) || u.email.toLowerCase().includes(searchUser.toLowerCase()));
  }, [allUsers, searchUser]);

  // When a user is selected, auto-select their active reservation if they have one
  useEffect(() => {
    if (selectedCustomerId) {
      const userRes = activeReservations.find(r => r.userEmail === selectedCustomerId);
      if (userRes) {
        setSelectedReservationId(userRes.id);
        setSelectedRoomId(userRes.roomId);
      } else {
        setSelectedReservationId('');
        setSelectedRoomId(roomsList[0]?.id || '');
      }
    } else {
      setSelectedReservationId('');
      setSelectedRoomId('');
    }
  }, [selectedCustomerId, activeReservations, roomsList]);

  const menuByCategories = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    currentTarget.categories.forEach(cat => grouped[cat.name] = []);
    
    currentTarget.menu.forEach(item => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    
    return grouped;
  }, [currentTarget.menu, currentTarget.categories]);

  const totalValue = Object.entries(orderBasket)
    .reduce((sum, [id, qty]) => sum + (currentTarget.menu.find(i => i.id === id)?.price || 0) * (qty as number), 0);

  const handlePlaceOrder = async () => {
    let targetUser: UserProfile | undefined;

    if (userMode === 'guest') {
      targetUser = {
        name: 'Guest User',
        email: `guest_${Date.now()}@novaspace.work`,
        role: 'customer',
        pfp: '',
        phone: '',
        credits: 0,
        paymentMethods: [],
        profession: 'Guest'
      };
    } else if (userMode === 'create') {
      if (!newUser.name || !newUser.email || !newUser.phone) return;
      setMemberCreating(true);
      setMemberCreateError(null);
      try {
        const result = await createWalkInMemberRemote(newUser);
        targetUser = { ...(result.profile as unknown as UserProfile), uid: result.uid, role: 'customer' };
      } catch (error) {
        setMemberCreateError(error instanceof Error ? error.message : 'Could not create member account.');
        setMemberCreating(false);
        return;
      }
      setMemberCreating(false);
    } else {
      targetUser = allUsers.find(u => u.email === selectedCustomerId);
      if (!targetUser) return;
    }

    const basketItems = Object.entries(orderBasket)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([itemId, qty]) => ({
        itemId,
        quantity: qty as number,
        comment: orderComments[itemId] || '',
        deliveryTime: 'At start of reservation'
      }));

    if (basketItems.length === 0) return;

    if (selectedReservationId && onAppendToReservation) {
      await onAppendToReservation(selectedReservationId, basketItems, totalValue, orderGeneralNote, orderPaymentMethod);
      setOrderSuccessMessage('Order placed and added to reservation!');
    } else if (onBook && selectedRoomId) {
      // Create new dummy reservation for walk-in/room
      const roomsToBook = roomsList.filter(room => room.id === selectedRoomId);
      if (roomsToBook.length > 0 || selectedRoomId === 'none') {
        onBook(
          roomsToBook,
          1, // 1 hour block for order visualization
          orderPaymentMethod,
          targetUser,
          basketItems,
          0, // override total price to not charge room cost again
          orderGeneralNote
        );
        setOrderSuccessMessage(selectedRoomId === 'none' ? 'Takeaway order placed!' : 'New order created for selected space!');
      }
    }

    setTimeout(() => {
      setOrderBasket({});
      setOrderComments({});
      setOrderGeneralNote('');
      setOrderSuccessMessage('');
      setSelectedCustomerId('');
      setSearchUser('');
    }, 2000);
  };

  if (userRole === 'owner') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-10 pt-8 flex gap-2">
          <button
            onClick={() => setOwnerMenuScope('branch')}
            className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              ownerMenuScope === 'branch' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 border border-slate-200'
            }`}
          >
            Branch Menu
          </button>
          <button
            onClick={() => setOwnerMenuScope('network')}
            className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
              ownerMenuScope === 'network' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 border border-slate-200'
            }`}
          >
            Network Menu
          </button>
          {allRooms.length > 0 && (
            <button
              onClick={() => setOwnerMenuScope('room')}
              className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                ownerMenuScope === 'room' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              Room Menu
            </button>
          )}
        </div>
        {ownerMenuScope === 'branch' ? (
          <MenuEditor
            scope="location"
            scopeId={location.id}
            title="Branch Menu"
            subtitle={`Add, edit, or remove categories and menu items for ${location.name}. Synced to the customer portal.`}
            categories={location.categories || []}
            menu={location.menu || []}
            onUpdate={(patch) => onUpdateLocation(patch)}
          />
        ) : ownerMenuScope === 'network' ? (
          <MenuEditor
            scope="vendor"
            scopeId={vendor.id}
            title="Network Menu"
            subtitle="Global menu items shared across all branches unless overridden locally."
            categories={vendor.categories || []}
            menu={vendor.menu || []}
            onUpdate={(patch) => onUpdateVendor({ ...vendor, ...patch })}
          />
        ) : selectedRoom && onUpdateRoomMenu ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-10 pt-4">
              <select
                value={selectedRoomMenuId}
                onChange={(e) => setSelectedRoomMenuId(e.target.value)}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-sm text-slate-700 outline-none"
              >
                {allRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            <MenuEditor
              scope="room"
              scopeId={selectedRoom.id}
              locationId={location.id}
              title="Room Menu"
              subtitle={`Room-specific items for ${selectedRoom.name}. Shown together with branch and network menus.`}
              categories={selectedRoom.categories || []}
              menu={selectedRoom.menu || []}
              onUpdate={(patch) => onUpdateRoomMenu(selectedRoom.id, patch)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50/30 overflow-hidden font-['Inter'] flex">
      {/* Main Content - Menu selection */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="p-10 pb-6 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-[0.2em] rounded-md">Staff Portal</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Manual Order</h2>
          <p className="text-slate-500 font-medium italic">Place orders for walk-ins or active reservations.</p>
        </header>

        {currentTarget.categories.length > 0 ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Category Tabs */}
            <div className="px-10 flex items-center gap-3 overflow-x-auto pb-4 custom-scrollbar shrink-0">
              {currentTarget.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-6 py-3 rounded-full font-black text-sm whitespace-nowrap transition-all ${activeCategory?.id === cat.id ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCategory && menuByCategories[activeCategory.name]?.map(item => {
                  const qty = orderBasket[item.id] || 0;
                  return (
                    <div key={item.id} className={`bg-white rounded-[2.5rem] p-6 border transition-all ${qty > 0 ? 'border-emerald-400 shadow-xl shadow-emerald-50' : 'border-slate-100 shadow-sm hover:border-slate-200'}`}>
                      <div className="aspect-[4/3] rounded-3xl overflow-hidden mb-4 relative">
                        <img src={item.image} className="w-full h-full object-cover" />
                        {qty > 0 && (
                          <div className="absolute top-3 right-3 bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black shadow-lg">
                            {qty}
                          </div>
                        )}
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mb-1">{item.name}</h4>
                      <p className="text-xs text-slate-400 font-medium mb-4 line-clamp-2">{item.description}</p>
                      
                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50">
                        <span className="text-xl font-black text-blue-600">{item.price} <span className="text-xs text-blue-400">EGP</span></span>
                        
                        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-2xl">
                          <button
                            type="button"
                            onClick={() => setOrderBasket(prev => ({ ...prev, [item.id]: Math.max(0, qty - 1) }))}
                            className="text-slate-400 hover:text-slate-800 disabled:opacity-20 p-1"
                            disabled={qty === 0}
                          >
                            <Minus size={16} />
                          </button>
                          <span className="text-sm font-black text-slate-800 w-4 text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => setOrderBasket(prev => ({ ...prev, [item.id]: qty + 1 }))}
                            className="text-slate-400 hover:text-slate-800 p-1"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {qty > 0 && (
                        <div className="mt-3">
                          <input 
                            type="text" 
                            placeholder="Add note (e.g. Less sugar)" 
                            value={orderComments[item.id] || ''}
                            onChange={(e) => setOrderComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-emerald-300 font-medium"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!activeCategory || !menuByCategories[activeCategory.name] || menuByCategories[activeCategory.name].length === 0) && (
                   <div className="col-span-full py-20 flex flex-col items-center justify-center text-center text-slate-400">
                     <p className="font-bold">No items in this category.</p>
                   </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
             <Coffee size={48} className="text-slate-200 mb-4" />
             <h3 className="text-2xl font-black text-slate-900 mb-2">Menu is empty</h3>
             <p className="text-slate-500 max-w-sm">There are no menu categories defined for this branch yet. Please use the owner portal to configure the menu.</p>
          </div>
        )}
      </div>

      {/* Right Sidebar - Checkout / Assignment */}
      <div className="w-[420px] bg-white border-l border-slate-200 flex flex-col shadow-2xl relative z-10 shrink-0 h-full overflow-hidden">
         <div className="p-6 bg-slate-50 border-b border-slate-200">
           <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
             <MapPin size={18} className="text-blue-600" />
             Order Details
           </h3>
         </div>
         
         <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {orderSuccessMessage ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-100 p-6">
                  <CheckCircle size={44} />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900">Success!</h4>
                  <p className="text-slate-500 text-sm mt-1">{orderSuccessMessage}</p>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Customer Assignment */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px]">1</span>
                       Assign to Customer
                     </label>
                     <div className="flex gap-2">
                        <button onClick={() => switchUserMode('select')} className={`text-[8px] font-black px-2 py-1 rounded transition-all ${userMode === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>EXISTING</button>
                        <button onClick={() => switchUserMode('create')} className={`text-[8px] font-black px-2 py-1 rounded transition-all ${userMode === 'create' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>NEW ACCOUNT</button>
                        <button onClick={() => switchUserMode('guest')} className={`text-[8px] font-black px-2 py-1 rounded transition-all ${userMode === 'guest' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>GUEST</button>
                     </div>
                  </div>

                  <div key={userMode}>
                  {userMode === 'guest' ? (
                    <div className="min-h-[80px]" aria-label="Guest order — no account required" />
                  ) : userMode === 'create' ? (
                    <div className="space-y-3">
                       <input 
                         type="text" 
                         placeholder="Full Name" 
                         value={newUser.name}
                         onChange={e => setNewUser(prev => ({...prev, name: e.target.value}))}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 transition-all text-sm font-bold"
                       />
                       <input 
                         type="email" 
                         placeholder="Email Address" 
                         value={newUser.email}
                         onChange={e => setNewUser(prev => ({...prev, email: e.target.value}))}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 transition-all text-sm font-bold"
                       />
                       <input 
                         type="tel" 
                         placeholder="Phone Number" 
                         value={newUser.phone}
                         onChange={e => setNewUser(prev => ({...prev, phone: e.target.value}))}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-400 transition-all text-sm font-bold"
                       />
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="Search users..." 
                          value={searchUser}
                          onChange={e => setSearchUser(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-400 focus:bg-white transition-all text-sm font-bold"
                        />
                      </div>
                      
                      {searchUser && !selectedCustomerId && (
                        <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-lg p-1.5 space-y-1">
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map(user => (
                              <button
                                key={user.email}
                                onClick={() => { setSelectedCustomerId(user.email); setSearchUser(''); }}
                                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                              >
                                <UserAvatar pfp={user.pfp} name={user.name} profession={user.profession} size="sm" className="shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-black text-slate-800 truncate">{user.name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 truncate">{user.email}</p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-center py-4 text-slate-500 font-bold">No users found</p>
                          )}
                        </div>
                      )}

                      {selectedCustomerId && (() => {
                        const selectedUser = allUsers.find(u => u.email === selectedCustomerId);
                        if (selectedUser) {
                          return (
                            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-2xl animate-in zoom-in-95">
                              <UserAvatar pfp={selectedUser.pfp} name={selectedUser.name} profession={selectedUser.profession} size="md" className="shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-slate-800 truncate">{selectedUser.name}</p>
                                <p className="text-[10px] font-bold text-blue-600 truncate">{selectedUser.email}</p>
                              </div>
                              <button onClick={() => setSelectedCustomerId('')} className="p-2 text-slate-400 hover:text-slate-800"><X size={16} /></button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </>
                  )}
                  </div>
                </div>

                {/* 2. Room / Reservation Link */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px]">2</span>
                    Space Assignment
                  </label>
                  
                  <select 
                    value={selectedRoomId}
                    onChange={e => {
                      setSelectedRoomId(e.target.value);
                      if (!e.target.value || e.target.value === 'none') {
                         setSelectedReservationId('');
                      } else {
                         const userRes = activeReservations.find(r => r.userEmail === selectedCustomerId && r.roomId === e.target.value);
                         setSelectedReservationId(userRes?.id || '');
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-400 transition-all text-sm font-black text-slate-700"
                  >
                    <option value="">Select Space...</option>
                    <option value="none">No Space (Takeaway / Direct Order)</option>
                    {roomsList.map(room => (
                      <option key={room.id} value={room.id}>{room.name} ({room.type})</option>
                    ))}
                  </select>
                </div>

                {/* Basket Summary */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                     Basket Summary
                   </h4>
                   <div className="space-y-3">
                     {Object.entries(orderBasket).filter(([_, qty]) => (qty as number) > 0).map(([id, qty]) => {
                       const item = currentTarget.menu.find(i => i.id === id);
                       if (!item) return null;
                       return (
                         <div key={id} className="flex justify-between items-start text-sm">
                           <div className="flex gap-2">
                             <span className="font-black text-slate-800">{qty}x</span>
                             <div>
                               <span className="font-bold text-slate-700">{item.name}</span>
                               {orderComments[id] && <p className="text-[10px] italic text-slate-400">{orderComments[id]}</p>}
                             </div>
                           </div>
                           <span className="font-black text-slate-900">{item.price * (qty as number)}</span>
                         </div>
                       );
                     })}
                     
                     {Object.values(orderBasket).every(v => (v as number) === 0) && (
                       <p className="text-xs text-slate-400 italic font-medium">Basket is empty. Select items to continue.</p>
                     )}
                   </div>
                </div>

                <div className="space-y-2 pt-4">
                  <textarea 
                    placeholder="General order notes..." 
                    rows={2}
                    value={orderGeneralNote}
                    onChange={(e) => setOrderGeneralNote(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:border-blue-300 font-bold"
                  />
                </div>

                {/* 3. Payment Options */}
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px]">3</span>
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      type="button"
                      onClick={() => setOrderPaymentMethod('card')}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${orderPaymentMethod === 'card' ? 'border-blue-600 bg-blue-50/50 text-blue-600 font-black' : 'border-slate-100 text-slate-400'}`}
                    >
                      <CreditCard size={16} />
                      <span className="text-[9px] uppercase tracking-widest">Card</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setOrderPaymentMethod('cash')}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${orderPaymentMethod === 'cash' ? 'border-amber-600 bg-amber-50 text-amber-600 font-black' : 'border-slate-100 text-slate-400'}`}
                    >
                      <Banknote size={16} />
                      <span className="text-[9px] uppercase tracking-widest">Cash</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setOrderPaymentMethod('credits')}
                      disabled={userMode !== 'select' || !selectedCustomerId || !allUsers.find(u => u.email === selectedCustomerId) || (allUsers.find(u => u.email === selectedCustomerId)?.credits || 0) < totalValue}
                      className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${orderPaymentMethod === 'credits' ? 'border-emerald-600 bg-emerald-50 text-emerald-600 font-black' : 'border-slate-100 text-slate-400'}`}
                    >
                      <Coins size={16} />
                      <span className="text-[9px] uppercase tracking-widest">Nova Points</span>
                    </button>
                  </div>
                  {orderPaymentMethod === 'credits' && userMode === 'select' && selectedCustomerId && allUsers.find(u => u.email === selectedCustomerId) && (allUsers.find(u => u.email === selectedCustomerId)?.credits || 0) < totalValue && (
                    <p className="text-[10px] font-bold text-rose-500 text-center">Insufficient credits.</p>
                  )}
                </div>
              </>
            )}
         </div>

         {/* Footer Checkout */}
         <div className="p-6 bg-white border-t border-slate-200">
           <div className="flex items-center justify-between mb-4">
             <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Value</span>
             <span className="text-2xl font-black text-blue-600 tracking-tighter">{totalValue} <span className="text-sm">EGP</span></span>
           </div>
           
           {memberCreateError && (
             <p className="mb-3 text-xs font-bold text-rose-600">{memberCreateError}</p>
           )}
           <button
             onClick={handlePlaceOrder}
             disabled={memberCreating || totalValue === 0 || (userMode === 'select' ? !selectedCustomerId : (userMode === 'create' ? (!newUser.name || !newUser.email || !newUser.phone) : false)) || !selectedRoomId}
             className="w-full bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-200"
           >
             {memberCreating ? 'Creating Member...' : 'Place Order'}
           </button>
         </div>
      </div>
    </div>
  );
};

export default MenuConfig;

