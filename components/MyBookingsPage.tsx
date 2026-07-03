
import React, { useState } from 'react';
import { Reservation, LocationData, Vendor } from '../types';
import { Calendar, Clock, MapPin, XCircle, CheckCircle2, History, ShieldCheck, AlertCircle } from 'lucide-react';

interface MyBookingsPageProps {
  reservations: Reservation[];
  locations: LocationData[];
  vendors: Vendor[];
  userName: string;
  onCancel: (id: string) => void;
}

interface BookingCardProps {
  res: Reservation;
  isCurrent: boolean;
  onCancel: (id: string) => void;
  locationName: string;
  vendor: Vendor | undefined;
}

const BookingCard: React.FC<BookingCardProps> = ({ res, isCurrent, onCancel, locationName, vendor }) => (
  <div className={`bg-white p-6 rounded-3xl border ${res.status === 'declined' ? 'border-slate-100 opacity-60' : 'border-slate-100 shadow-sm'} transition-all hover:shadow-md`}>
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${res.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : res.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
          {res.status === 'approved' ? <CheckCircle2 size={20} /> : res.status === 'pending' ? <Clock size={20} /> : <XCircle size={20} />}
        </div>
        <div>
          <h4 className="font-black text-slate-900 tracking-tight">{locationName}</h4>
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <MapPin size={10} />
            Floor {res.floorId.split('-').pop()} • Room {res.roomId.split('-').pop()}
          </div>
        </div>
      </div>
      <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${res.status === 'approved' ? 'bg-emerald-500 text-white' : res.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
        {res.status}
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Calendar size={14} className="text-slate-300" />
        <span className="text-xs font-bold">{res.date}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-500">
        <Clock size={14} className="text-slate-300" />
        <span className="text-xs font-bold">{res.time} ({res.duration}h)</span>
      </div>
    </div>

    {res.selectedMenuItems && res.selectedMenuItems.length > 0 && (
      <div className="mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Add-ons</p>
        <div className="flex flex-wrap gap-2">
          {res.selectedMenuItems.map((item, idx) => {
            const menuItem = vendor?.menu?.find(m => m.id === item.itemId);
            return (
              <div key={idx} className="flex flex-col bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-blue-600">{item.quantity}x</span>
                  <span className="text-[10px] font-bold text-slate-700">{menuItem?.name || 'Item'}</span>
                </div>
                {item.deliveryTime && (
                  <span className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{item.deliveryTime}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}

    {isCurrent && res.status !== 'declined' && (
      <button 
        onClick={() => onCancel(res.id)}
        className="w-full py-3 rounded-xl bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2"
      >
        <XCircle size={14} />
        Cancel Booking
      </button>
    )}
  </div>
);

const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ reservations, locations, vendors, userName, onCancel }) => {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  
  const userReservations = reservations.filter(r => r.userName === userName);
  
  const currentBookings = userReservations.filter(r => {
    // Only show pending reservations in Active & Upcoming
    return r.status === 'pending';
  }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const previousBookings = userReservations.filter(r => {
    // Show approved and declined reservations in Booking History
    return r.status === 'approved' || r.status === 'declined';
  }).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || 'Unknown Location';

  const handleCancelClick = (id: string) => {
    setCancellingId(id);
  };

  const confirmCancel = () => {
    if (cancellingId) {
      onCancel(cancellingId);
      setCancellingId(null);
    }
  };

  const cancellingRes = cancellingId ? reservations.find(r => r.id === cancellingId) : null;
  const cancellingVendor = cancellingRes ? vendors.find(v => v.id === cancellingRes.vendorId) : null;
  const cancellingLocation = cancellingRes ? locations.find(l => l.id === cancellingRes.locationId) : null;
  const currentPolicy = cancellingLocation?.cancellationPolicy || cancellingVendor?.cancellationPolicy;

  return (
    <div className="flex-1 bg-slate-50/30 overflow-y-auto p-10 font-['Inter']">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">My Bookings</h2>
          <p className="text-slate-500 font-medium italic">Manage your workspace reservations across the network.</p>
        </header>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg">
              <Calendar size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Active & Upcoming</h3>
          </div>
          
          {currentBookings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentBookings.map(res => (
                <BookingCard key={res.id} res={res} isCurrent={true} onCancel={handleCancelClick} locationName={getLocationName(res.locationId)} vendor={vendors.find(v => v.id === res.vendorId)} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] p-12 text-center border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} />
              </div>
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No active bookings found</p>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg">
              <History size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Booking History</h3>
          </div>

          {previousBookings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {previousBookings.map(res => (
                <BookingCard key={res.id} res={res} isCurrent={false} onCancel={handleCancelClick} locationName={getLocationName(res.locationId)} vendor={vendors.find(v => v.id === res.vendorId)} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] p-12 text-center border border-dashed border-slate-200">
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No previous bookings</p>
            </div>
          )}
        </section>
      </div>

      {/* Cancellation Confirmation Modal */}
      {cancellingId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setCancellingId(null)} />
          <div className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 text-center animate-in zoom-in-95">
             <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 text-rose-600 bg-rose-50">
                <AlertCircle size={40} />
             </div>
             <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Cancel Booking?</h3>
             <p className="text-slate-500 font-bold mb-6">
               Are you sure you want to cancel your reservation at <span className="text-slate-900">{getLocationName(cancellingRes?.locationId || '')}</span>?
             </p>
             
             {currentPolicy && currentPolicy.trim() !== '' && (
               <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-left">
                 <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                   <ShieldCheck size={14} />
                   Cancellation Policy
                 </p>
                 <p className="text-[11px] font-medium text-rose-500 leading-relaxed italic">
                   "{currentPolicy}"
                 </p>
               </div>
             )}
             
             <div className="flex gap-4">
                <button onClick={() => setCancellingId(null)} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-2xl uppercase tracking-widest text-xs">Keep Booking</button>
                <button onClick={confirmCancel} className="flex-[2] py-4 bg-rose-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-rose-100">Confirm Cancellation</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookingsPage;
