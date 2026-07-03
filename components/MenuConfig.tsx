import React, { useState, useMemo, useEffect } from 'react';
import { MenuItem, Vendor, Category, LocationData, Room, UserProfile, Reservation } from '../types';
import { Plus, Minus, Search, CheckCircle, Coffee, User, CreditCard, Coins, Banknote, MapPin, X, Edit, Trash2, Save, Image as ImageIcon } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { uploadMenuImage } from '../services/storageUpload';

interface MenuConfigProps {
  vendor: Vendor;
  onUpdateVendor: (vendor: Vendor) => void;
  location: LocationData;
  onUpdateLocation: (updates: Partial<LocationData> | ((prev: LocationData) => Partial<LocationData>)) => void;
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
  ) => void;
}

const MenuConfig: React.FC<MenuConfigProps> = ({ vendor, location, onUpdateLocation, userRole, allUsers = [], allReservations = [], onBook, onAppendToReservation }) => {
  const currentTarget = useMemo(() => {
    return { categories: location.categories || [], menu: location.menu || [] };
  }, [location]);

  const [activeCategory, setActiveCategory] = useState<Category | null>(currentTarget.categories.length > 0 ? currentTarget.categories[0] : null);
  
  const [orderBasket, setOrderBasket] = useState<Record<string, number>>({});
  const [orderComments, setOrderComments] = useState<Record<string, string>>({});
  const [orderGeneralNote, setOrderGeneralNote] = useState('');
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<'card' | 'credits' | 'cash'>('cash');
  const [orderSuccessMessage, setOrderSuccessMessage] = useState('');

  const [userMode, setUserMode] = useState<'select' | 'create' | 'guest'>('select');
  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '' });

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

  const handlePlaceOrder = () => {
    let targetUser;

    if (userMode === 'guest') {
      targetUser = {
        name: 'Guest User',
        email: `guest_${Date.now()}@novaspace.ai`,
        role: 'Member',
        pfp: '',
        phone: '',
        credits: 0,
        paymentMethods: [],
        profession: 'Guest'
      };
    } else if (userMode === 'create') {
      targetUser = {
        name: newUser.name,
        email: newUser.email,
        role: 'Member',
        pfp: `https://picsum.photos/400/400?seed=${newUser.name}`,
        phone: newUser.phone,
        credits: 0,
        paymentMethods: [],
        profession: 'New Member'
      };
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
      // Append to existing reservation
      onAppendToReservation(selectedReservationId, basketItems, totalValue, orderGeneralNote, orderPaymentMethod);
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
    return <MenuManager location={location} onUpdateLocation={onUpdateLocation} />;
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
                        <button onClick={() => { setUserMode('select'); setSelectedCustomerId(''); }} className={`text-[8px] font-black px-2 py-1 rounded transition-all ${userMode === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>EXISTING</button>
                        <button onClick={() => { setUserMode('create'); setSelectedCustomerId(''); }} className={`text-[8px] font-black px-2 py-1 rounded transition-all ${userMode === 'create' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>NEW ACCOUNT</button>
                        <button onClick={() => { setUserMode('guest'); setSelectedCustomerId('guest'); }} className={`text-[8px] font-black px-2 py-1 rounded transition-all ${userMode === 'guest' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>GUEST</button>
                     </div>
                  </div>

                  {userMode === 'guest' ? (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                       <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-black shrink-0">
                          G
                       </div>
                       <div>
                          <h4 className="text-sm font-black text-slate-800">Guest Checkout</h4>
                          <p className="text-[10px] font-bold text-slate-400">No account will be created</p>
                       </div>
                    </div>
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
           
           <button
             onClick={handlePlaceOrder}
             disabled={totalValue === 0 || (userMode === 'select' ? !selectedCustomerId : (userMode === 'create' ? (!newUser.name || !newUser.email || !newUser.phone) : false)) || !selectedRoomId}
             className="w-full bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-xl shadow-slate-200"
           >
             Place Order
           </button>
         </div>
      </div>
    </div>
  );
};

const MenuManager: React.FC<{ location: LocationData; onUpdateLocation: (updates: Partial<LocationData> | ((prev: LocationData) => Partial<LocationData>)) => void }> = ({ location, onUpdateLocation }) => {
  const categories = location.categories || [];
  const menuItems = location.menu || [];
  
  const [activeCategory, setActiveCategory] = useState<Category | null>(categories.length > 0 ? categories[0] : null);

  // States for Category form
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [catName, setCatName] = useState('');
  
  // States for Item form
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState(0);
  const [itemDesc, setItemDesc] = useState('');
  const [itemImg, setItemImg] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const itemId = editingItem?.id || `item-${Date.now()}`;
      const url = await uploadMenuImage('location', location.id, itemId, file);
      setItemImg(url);
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => setItemImg(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  
  const handleSaveCategory = () => {
    if (!catName) {
      setIsAddingCategory(false);
      return;
    }
    const newCat = { id: `cat-${Date.now()}`, name: catName };
    onUpdateLocation(prev => ({
      categories: [...(prev.categories || []), newCat]
    }));
    setActiveCategory(newCat);
    setIsAddingCategory(false);
    setCatName('');
  };
  
  const handleDeleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateLocation(prev => {
      const categoryName = prev.categories?.find(c => c.id === id)?.name;
      return {
        categories: (prev.categories || []).filter(c => c.id !== id),
        menu: (prev.menu || []).filter(m => m.category !== categoryName)
      };
    });
    if (activeCategory?.id === id) {
       setActiveCategory(categories.find(c => c.id !== id) || null);
    }
  };

  const handleSaveItem = () => {
    if (!itemName || !activeCategory) return;
    onUpdateLocation(prev => {
      const prevMenu = prev.menu || [];
      if (editingItem) {
        return { menu: prevMenu.map(m => m.id === editingItem.id ? { ...m, name: itemName, price: itemPrice, description: itemDesc, category: activeCategory.name, image: itemImg || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=400' } : m) };
      } else {
        return { menu: [...prevMenu, { id: `item-${Date.now()}`, name: itemName, price: itemPrice, description: itemDesc, category: activeCategory.name, image: itemImg || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=400' }] };
      }
    });
    setEditingItem(null);
    setIsAddingItem(false);
    setItemName('');
    setItemPrice(0);
    setItemDesc('');
    setItemImg('');
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateLocation(prev => ({
      menu: (prev.menu || []).filter(m => m.id !== id)
    }));
  };

  const currentCategoryItems = menuItems.filter(m => activeCategory && m.category === activeCategory.name);

  return (
    <div className="flex-1 bg-slate-50/30 overflow-hidden font-['Inter'] flex flex-col">
       <header className="p-10 pb-6 shrink-0 border-b border-slate-200">
         <div className="flex items-center justify-between">
           <div>
             <div className="flex items-center gap-2 mb-2">
               <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-black uppercase tracking-[0.2em] rounded-md">Global Access</span>
             </div>
             <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Menu Management</h2>
             <p className="text-slate-500 font-medium italic">Add, edit, or remove categories and menu items for this branch.</p>
           </div>
         </div>
       </header>

       {/* Toolbar for Categories */}
       <div className="px-10 py-4 bg-white border-b border-slate-200 flex items-center gap-3 overflow-x-auto custom-scrollbar shrink-0">
          {categories.map(cat => (
            <div key={cat.id} className="relative group">
              <button 
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2.5 rounded-full font-black text-sm transition-all flex items-center gap-2 ${activeCategory?.id === cat.id ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {cat.name}
              </button>
              <button 
                onClick={(e) => handleDeleteCategory(cat.id, e)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm scale-90 hover:scale-100"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          
          {isAddingCategory ? (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-full pl-4">
              <input 
                type="text" 
                value={catName} 
                onChange={e => setCatName(e.target.value)} 
                placeholder="Category name" 
                autoFocus
                onKeyDown={(e) => { if(e.key === 'Enter') handleSaveCategory(); else if(e.key === 'Escape') setIsAddingCategory(false); }}
                className="bg-transparent border-none outline-none text-sm font-bold text-slate-800 w-32" 
              />
              <button onClick={handleSaveCategory} className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-blue-700">
                <CheckCircle size={14} />
              </button>
              <button onClick={() => { setIsAddingCategory(false); setCatName(''); }} className="w-8 h-8 bg-white text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-50">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAddingCategory(true)}
              className="px-6 py-2.5 rounded-full border-2 border-dashed border-slate-300 text-slate-500 font-black text-sm hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center gap-2"
            >
              <Plus size={16} /> Add Category
            </button>
          )}
       </div>

       <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeCategory ? (
            <div className="max-w-6xl space-y-8">
               <div className="flex items-center justify-between">
                 <h3 className="text-xl font-black text-slate-800 tracking-tight">{activeCategory.name} Items</h3>
                 {!isAddingItem && !editingItem && (
                   <button 
                     onClick={() => setIsAddingItem(true)}
                     className="px-6 py-3 bg-blue-600 text-white font-black text-sm rounded-full hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                   >
                     <Plus size={16} /> Add Item
                   </button>
                 )}
               </div>

               {(isAddingItem || editingItem) && (
                 <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-300">
                   <div className="col-span-2 md:col-span-1 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name</label>
                      <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. Latte" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-400 font-bold text-sm" />
                   </div>
                   <div className="col-span-2 md:col-span-1 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price (EGP)</label>
                      <input type="number" value={itemPrice} onChange={e => setItemPrice(Number(e.target.value))} placeholder="0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-400 font-bold text-sm" />
                   </div>
                   <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Image Upload (Optional)</label>
                      <div className="relative">
                         <div className="flex items-center gap-4">
                           {itemImg && <img src={itemImg} alt="Preview" className="w-12 h-12 rounded-xl object-cover" />}
                           <label className="flex-1 cursor-pointer">
                             <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl hover:border-blue-400 transition-colors">
                               <ImageIcon className="text-slate-400" size={16} />
                               <span className="text-sm font-bold text-slate-600">{itemImg ? 'Change Image' : 'Click to select image file'}</span>
                             </div>
                             <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                           </label>
                         </div>
                      </div>
                   </div>
                   <div className="col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                      <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Item description..." rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-400 font-bold text-sm resize-none" />
                   </div>
                   <div className="col-span-2 flex gap-3 justify-end pt-2">
                      <button onClick={() => { setEditingItem(null); setIsAddingItem(false); setItemName(''); setItemPrice(0); setItemDesc(''); setItemImg(''); }} className="px-6 py-3 bg-slate-100 text-slate-500 font-black text-sm rounded-2xl hover:bg-slate-200 transition-colors">Cancel</button>
                      <button onClick={handleSaveItem} className="px-8 py-3 bg-slate-900 text-white font-black text-sm rounded-2xl hover:bg-slate-800 transition-colors flex items-center gap-2">
                         {editingItem ? <Save size={16} /> : <Plus size={16} />}
                         {editingItem ? 'Save Item' : 'Add Item'}
                      </button>
                   </div>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {currentCategoryItems.map(item => (
                    <div key={item.id} className="bg-white rounded-3xl p-5 border border-slate-200 flex flex-col group relative">
                       <button 
                         onClick={(e) => handleDeleteItem(item.id, e)}
                         className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/90 backdrop-blur text-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-500 hover:text-white"
                       >
                         <X size={14} />
                       </button>
                       <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4 relative bg-slate-100">
                          {item.image ? (
                            <img src={item.image} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <ImageIcon size={32} />
                            </div>
                          )}
                       </div>
                       <h4 className="font-black text-slate-900">{item.name}</h4>
                       <p className="text-xs text-slate-400 font-medium mb-3 line-clamp-2 min-h-[2rem]">{item.description}</p>
                       <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
                          <span className="font-black text-blue-600">{item.price} <span className="text-[10px]">EGP</span></span>
                          <button onClick={() => { setEditingItem(item); setIsAddingItem(true); setItemName(item.name); setItemPrice(item.price); setItemDesc(item.description); setItemImg(item.image || ''); }} className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors">
                             <Edit size={16} />
                          </button>
                       </div>
                    </div>
                  ))}
                  {currentCategoryItems.length === 0 && !isAddingItem && !editingItem && (
                    <div className="col-span-full py-10 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-3xl border-dashed">
                       <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                         <Coffee size={24} />
                       </div>
                       <p className="text-slate-500 font-bold mb-4">No items in this category yet.</p>
                       <button onClick={() => setIsAddingItem(true)} className="px-6 py-2 bg-slate-900 text-white font-black text-sm rounded-full hover:bg-slate-800 transition-colors">
                         Add First Item
                       </button>
                    </div>
                  )}
               </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <p className="font-bold">Select or create a category to manage items.</p>
            </div>
          )}
       </div>
    </div>
  );
};

export default MenuConfig;
