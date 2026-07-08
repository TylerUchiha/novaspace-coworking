import React from 'react';
import { Reservation, LocationData, Vendor, Room, Floor } from '../types';
import { Star, MapPin, Calendar, ArrowRight } from 'lucide-react';

interface FavoritesPageProps {
  favoritedRoomIds: string[];
  locations: LocationData[];
  vendors: Vendor[];
  onNavigateToRoom: (vendorId: string, locationId: string, floorId: string, roomId: string) => void;
}

function findRoomContext(
  locations: LocationData[],
  roomId: string,
): { location: LocationData; floor: Floor; room: Room } | null {
  for (const location of locations) {
    for (const floor of location.floors) {
      const room = floor.rooms.find((r) => r.id === roomId);
      if (room) return { location, floor, room };
    }
  }
  return null;
}

const FavoritesPage: React.FC<FavoritesPageProps> = ({
  favoritedRoomIds,
  locations,
  vendors,
  onNavigateToRoom,
}) => {
  const favorites = favoritedRoomIds
    .map((roomId) => {
      const ctx = findRoomContext(locations, roomId);
      if (!ctx) return null;
      const vendor = vendors.find((v) => v.id === ctx.location.vendorId);
      return { roomId, ...ctx, vendor };
    })
    .filter(Boolean) as Array<{
    roomId: string;
    location: LocationData;
    floor: Floor;
    room: Room;
    vendor: Vendor | undefined;
  }>;

  return (
    <div className="flex-1 bg-slate-50/30 overflow-y-auto p-10 font-['Inter']">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">Favorites</h2>
          <p className="text-slate-500 font-medium italic">Your saved rooms across the NovaSpace network.</p>
        </header>

        {favorites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map(({ roomId, location, floor, room, vendor }) => (
              <div
                key={roomId}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-500">
                      <Star size={20} className="fill-amber-400 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 tracking-tight">{room.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {vendor?.name || 'Network'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin size={14} className="text-slate-300" />
                    <span className="text-xs font-bold">{location.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar size={14} className="text-slate-300" />
                    <span className="text-xs font-bold">{floor.name} • {room.type}</span>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateToRoom(location.vendorId, location.id, floor.id, roomId)}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  View on Blueprint
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-amber-50 text-amber-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Star size={32} />
            </div>
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">
              No favorite rooms yet
            </p>
            <p className="text-slate-400 font-medium text-sm mt-2">
              Tap the star on any room in the blueprint to save it here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;
