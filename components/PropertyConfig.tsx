
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Room, RoomStatus, Floor, LocationData, Vendor, Reservation } from '../types';
import { ROOM_COLORS } from '../constants';
import { uploadVendorLogo, uploadRoomImage } from '../services/storageUpload';
import { useImageCropUpload } from './ImageCropPortal';
import { Plus, Trash2, Move, Edit3, Settings2, ChevronDown, Sparkles, X, Calendar, MapPin, Layers3, Maximize2, Undo2, Redo2, ArrowRight, Layers, Layout, Globe, Clock, Building2, Info, Map as MapIcon, PlusCircle, Ban, FileText, AlertCircle, Image as ImageIcon, Upload, Trash, ShieldCheck } from 'lucide-react';

interface PropertyConfigProps {
  location: LocationData;
  activeFloorId: string;
  locations: LocationData[];
  vendor: Vendor;
  onUpdateRooms: (newRooms: Room[]) => void;
  onSwitchLocation: (id: string) => void;
  onSwitchFloor: (id: string) => void;
  onUpdateVendor: (vendorId: string, updates: Partial<Vendor>) => void;
  onUpdateLocationMeta: (locId: string, updates: Partial<LocationData>) => void;
  onStaffCodeFocus?: (locId: string) => void;
  onStaffCodeBlur?: (locId: string) => void;
  onAddLocation: () => void;
  view?: 'layout' | 'brand' | 'branch' | 'tags';
  onViewChange?: (view: 'layout' | 'brand' | 'branch' | 'tags') => void;
  allReservations: Reservation[];
  userRole: 'customer' | 'employee' | 'owner';
}

const PropertyConfig: React.FC<PropertyConfigProps> = ({ 
  location, 
  activeFloorId,
  locations, 
  vendor,
  onUpdateRooms, 
  onSwitchLocation, 
  onSwitchFloor,
  onUpdateVendor,
  onUpdateLocationMeta,
  onStaffCodeFocus,
  onStaffCodeBlur,
  onAddLocation,
  allReservations,
  view: externalView = 'layout',
  onViewChange,
  userRole
}) => {
  const isOwner = userRole === 'owner';
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isFloorPickerOpen, setIsFloorPickerOpen] = useState(false);
  
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyText, setPolicyText] = useState('');
  const [staffCodeDraft, setStaffCodeDraft] = useState('');
  
  const [undoStack, setUndoStack] = useState<Room[][]>([]);
  const [redoStack, setRedoStack] = useState<Room[][]>([]);
  const lastFinalizedRooms = useRef<Room[]>([]);

  useEffect(() => {
    if (location) {
      setPolicyText(location.cancellationPolicy || '');
    }
  }, [location]);

  useEffect(() => {
    setStaffCodeDraft(location.staffAccessCode || '');
  }, [location.id]);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartMouse = useRef({ x: 0, y: 0 });
  const roomStartGeometry = useRef<Record<string, { x: number, y: number, w: number, h: number }>>({});

  const activeFloor = location?.floors.find(f => f.id === activeFloorId) || location?.floors[0];
  const rooms = activeFloor?.rooms || [];
  const selectedRooms = rooms.filter(r => selectedRoomIds.includes(r.id));
  const isMultiSelect = selectedRooms.length > 1;

  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    lastFinalizedRooms.current = rooms;
  }, [activeFloorId, location?.id]);

  const pushToHistory = (newRooms: Room[]) => {
    if (JSON.stringify(newRooms) === JSON.stringify(lastFinalizedRooms.current)) return;
    setUndoStack(prev => [...prev.slice(-49), lastFinalizedRooms.current]);
    setRedoStack([]);
    lastFinalizedRooms.current = newRooms;
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevRooms = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, lastFinalizedRooms.current]);
    setUndoStack(prev => prev.slice(0, -1));
    lastFinalizedRooms.current = prevRooms;
    onUpdateRooms(prevRooms);
    setSelectedRoomIds([]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextRooms = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, lastFinalizedRooms.current]);
    setRedoStack(prev => prev.slice(0, -1));
    lastFinalizedRooms.current = nextRooms;
    onUpdateRooms(nextRooms);
    setSelectedRoomIds([]);
  };

  const handleUpdateField = (field: keyof Room, value: any) => {
    if (selectedRoomIds.length === 0) return;
    const newRooms = rooms.map(room => 
      selectedRoomIds.includes(room.id) ? { ...room, [field]: value } : room
    );
    onUpdateRooms(newRooms);
    pushToHistory(newRooms);
  };

  const roomUploadContextRef = useRef<{ roomId: string; currentImages: string[]; index: number } | null>(null);

  const roomImageCrop = useImageCropUpload({
    aspect: 16 / 9,
    onCrop: async (file) => {
      const ctx = roomUploadContextRef.current;
      if (!ctx) return;
      try {
        const url = await uploadRoomImage(
          location.id,
          ctx.roomId,
          file,
          `${ctx.roomId}-${Date.now()}-${ctx.index}`,
        );
        ctx.currentImages = [...ctx.currentImages, url];
        ctx.index += 1;
        handleUpdateField('images', ctx.currentImages);
      } catch (err) {
        console.error('Room image upload failed', err);
      }
    },
  });

  const vendorLogoCrop = useImageCropUpload({
    aspect: 1,
    onCrop: async (file) => {
      try {
        const url = await uploadVendorLogo(vendor.id, file);
        onUpdateVendor(vendor.id, { logo: url });
      } catch (err) {
        console.error('Logo upload failed', err);
      }
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    let files: FileList | null = null;
    if ('files' in e.target && e.target.files) {
      files = e.target.files;
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      files = e.dataTransfer.files;
    }

    if (!files || selectedRoomIds.length === 0) return;

    const roomId = selectedRoomIds[0];
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const currentImages = selectedRooms[0]?.images || [];
    roomUploadContextRef.current = { roomId, currentImages: [...currentImages], index: 0 };
    roomImageCrop.queueFiles(imageFiles);
  };

  const handleDeleteImage = (index: number) => {
    if (selectedRoomIds.length === 0) return;
    const currentImages = selectedRooms[0]?.images || [];
    const newImages = currentImages.filter((_, i) => i !== index);
    handleUpdateField('images', newImages);
  };

  const handleAddRoom = (type: 'reservable' | 'service') => {
    const roomName = type === 'reservable' ? 'New Space' : 'Service Area';
    const catId = `cat-new-${Date.now()}`;
    const categoryName = `${roomName} Amenities`;
    
    // Generate 3 random-looking prices
    const price1 = Math.floor(Math.random() * 21) + 30; // 30 - 50 EGP
    const price2 = Math.floor(Math.random() * 31) + 50; // 50 - 80 EGP
    const price3 = Math.floor(Math.random() * 41) + 80; // 80 - 120 EGP

    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: roomName,
      type: type === 'reservable' ? 'Meeting' : 'Service',
      capacity: type === 'reservable' ? 4 : 0,
      status: RoomStatus.AVAILABLE,
      amenities: type === 'reservable' ? ['Power Outlets'] : [],
      x: 40, 
      y: 40,
      width: 15,
      height: 15,
      pricePerHour: type === 'reservable' ? 25 : 0,
      categories: [{ id: catId, name: categoryName, description: `Special catering items for ${roomName}` }],
      menu: [
        { id: `m-new1-${Date.now()}`, name: 'Espresso Single Shot', price: price1, description: 'Premium rich aromatic roast.', category: categoryName, image: 'https://picsum.photos/200/200?seed=new-espresso' },
        { id: `m-new2-${Date.now()}`, name: 'Fresh Croissant', price: price2, description: 'Flaky baked French butter croissant.', category: categoryName, image: 'https://picsum.photos/200/200?seed=new-croissant' },
        { id: `m-new3-${Date.now()}`, name: 'Premium Fruit Cup', price: price3, description: 'Selection of fresh sweet seasonal fruits.', category: categoryName, image: 'https://picsum.photos/200/200?seed=new-fruit' }
      ]
    };
    const newRooms = [...rooms, newRoom];
    onUpdateRooms(newRooms);
    pushToHistory(newRooms);
    setSelectedRoomIds([newRoom.id]);
    setIsAddMenuOpen(false);
  };

  const handleDeleteRoom = () => {
    if (selectedRoomIds.length === 0) return;
    const newRooms = rooms.filter(r => !selectedRoomIds.includes(r.id));
    onUpdateRooms(newRooms);
    pushToHistory(newRooms);
    setSelectedRoomIds([]);
  };

  const handleAddFloor = () => {
    const newFloor: Floor = {
      id: `floor-${Date.now()}`,
      name: `Floor ${location.floors.length + 1}`,
      rooms: []
    };
    onUpdateLocationMeta(location.id, { floors: [...location.floors, newFloor] });
    onSwitchFloor(newFloor.id);
    setIsFloorPickerOpen(false);
  };

  const handleRemoveFloor = (floorId: string) => {
    if (location.floors.length <= 1) return;
    const newFloors = location.floors.filter(f => f.id !== floorId);
    onUpdateLocationMeta(location.id, { floors: newFloors });
    if (activeFloorId === floorId) {
      onSwitchFloor(newFloors[0].id);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, room: Room) => {
    e.stopPropagation();
    const isShift = e.shiftKey || e.metaKey;
    if (isShift) {
      setSelectedRoomIds(prev => prev.includes(room.id) ? prev.filter(id => id !== room.id) : [...prev, room.id]);
    } else {
      if (!selectedRoomIds.includes(room.id)) {
        setSelectedRoomIds([room.id]);
      }
    }
    if (isOwner) {
      setIsDragging(true);
      setIsResizing(false);
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragStartMouse.current = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
      const starts: Record<string, { x: number, y: number, w: number, h: number }> = {};
      rooms.forEach(r => { if (selectedRoomIds.includes(r.id) || r.id === room.id) starts[r.id] = { x: r.x, y: r.y, w: r.width, h: r.height }; });
      roomStartGeometry.current = starts;
    }
  };

  const handleResizeStart = (e: React.MouseEvent, room: Room) => {
    if (!isOwner) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedRoomIds([room.id]);
    setIsResizing(true);
    setIsDragging(false);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragStartMouse.current = { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
      roomStartGeometry.current = { [room.id]: { x: room.x, y: room.y, w: room.width, h: room.height } };
    }
  };

  const nudgeRooms = useCallback((dx: number, dy: number) => {
    if (selectedRoomIds.length === 0) return;
    const newRooms = rooms.map(room => {
      if (selectedRoomIds.includes(room.id)) return { ...room, x: Math.max(0, Math.min(100 - room.width, room.x + dx)), y: Math.max(0, Math.min(100 - room.height, room.y + dy)) };
      return room;
    });
    onUpdateRooms(newRooms);
    pushToHistory(newRooms);
  }, [selectedRoomIds, rooms, onUpdateRooms]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); return; }
      if (selectedRoomIds.length === 0) return;
      const step = e.shiftKey ? 5 : 1;
      switch (e.key) {
        case 'ArrowLeft': nudgeRooms(-step, 0); e.preventDefault(); break;
        case 'ArrowRight': nudgeRooms(step, 0); e.preventDefault(); break;
        case 'ArrowUp': nudgeRooms(0, -step); e.preventDefault(); break;
        case 'ArrowDown': nudgeRooms(0, step); e.preventDefault(); break;
        case 'Delete': case 'Backspace': if (!e.shiftKey) return; handleDeleteRoom(); break;
      }
    };
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if ((!isDragging && !isResizing) || !containerRef.current || selectedRoomIds.length === 0) return;
      const rect = containerRef.current.getBoundingClientRect();
      const currentMouseX = ((e.clientX - rect.left) / rect.width) * 100;
      const currentMouseY = ((e.clientY - rect.top) / rect.height) * 100;
      const dx = currentMouseX - dragStartMouse.current.x;
      const dy = currentMouseY - dragStartMouse.current.y;
      const newRooms = rooms.map(room => {
        if (selectedRoomIds.includes(room.id)) {
          const start = roomStartGeometry.current[room.id];
          if (!start) return room;
          if (isDragging) return { ...room, x: Number(Math.max(0, Math.min(100 - start.w, start.x + dx)).toFixed(2)), y: Number(Math.max(0, Math.min(100 - start.h, start.y + dy)).toFixed(2)) };
          else if (isResizing) return { ...room, width: Number(Math.max(2, Math.min(100 - start.x, start.w + dx)).toFixed(2)), height: Number(Math.max(2, Math.min(100 - start.y, start.h + dy)).toFixed(2)) };
        }
        return room;
      });
      onUpdateRooms(newRooms);
    };
    const handleGlobalMouseUp = () => { if (isDragging || isResizing) pushToHistory(rooms); setIsDragging(false); setIsResizing(false); };
    window.addEventListener('keydown', handleKeyDown);
    if (isDragging || isResizing) { window.addEventListener('mousemove', handleGlobalMouseMove); window.addEventListener('mouseup', handleGlobalMouseUp); }
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('mousemove', handleGlobalMouseMove); window.removeEventListener('mouseup', handleGlobalMouseUp); };
  }, [isDragging, isResizing, selectedRoomIds, rooms, nudgeRooms, onUpdateRooms, undoStack, redoStack]);

  const [tagSubTab, setTagSubTab] = useState<'brand' | 'branch'>('brand');

  const getBlockStyle = (room: Room) => {
    const isSelected = selectedRoomIds.includes(room.id);
    const isCurrentlyActive = isSelected && (isDragging || isResizing);
    let colorStyle = 'bg-white border-slate-300 text-slate-900';
    if (room.type === 'Service') colorStyle = 'bg-slate-100/80 border-slate-300 text-slate-500 opacity-100';
    const selectionRing = isSelected ? 'ring-[6px] ring-emerald-100 border-emerald-500 z-30 scale-[1.01]' : 'z-10';
    const draggingClass = isCurrentlyActive ? 'transition-none shadow-2xl scale-[1.03] opacity-80 cursor-grabbing' : 'transition-all duration-200 cursor-grab';
    return `absolute border-[3px] rounded-2xl flex flex-col items-center justify-center text-center shadow-lg overflow-hidden select-none ${colorStyle} ${selectionRing} ${draggingClass}`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div className="h-16 bg-white border-b border-slate-200 flex items-center px-10 gap-2 shrink-0">
         <button 
           onClick={() => onViewChange?.('layout')} 
           className={`h-full flex items-center gap-2 px-4 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all ${externalView === 'layout' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
         >
           <Layout size={14} />
           Space Architecture
         </button>
         {isOwner && (
           <>
             <button 
               onClick={() => onViewChange?.('brand')} 
               className={`h-full flex items-center gap-2 px-4 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all ${externalView === 'brand' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
             >
               <Settings2 size={14} />
               Brand Settings
             </button>
             <button 
               onClick={() => onViewChange?.('branch')} 
               className={`h-full flex items-center gap-2 px-4 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all ${externalView === 'branch' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
             >
               <Building2 size={14} />
               Branch Settings
             </button>
             <button 
               onClick={() => onViewChange?.('tags')} 
               className={`h-full flex items-center gap-2 px-4 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all ${externalView === 'tags' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
             >
               <Layers size={14} />
               Tag Management
             </button>
           </>
         )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {externalView === 'layout' ? (
          <>
            <div className="flex-1 p-0 overflow-auto bg-slate-50/30 flex flex-col">
              <div className="px-10 py-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Blueprint Editor</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsPickerOpen(true)} className="group flex items-center gap-3 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-emerald-500 transition-all">
                      <div className="p-1 bg-emerald-50 rounded-lg text-emerald-600"><MapPin size={12} strokeWidth={3} /></div>
                      <div className="flex flex-col text-left leading-none"><span className="text-[11px] font-black text-slate-900 flex items-center gap-1">{location?.name || 'Loading...'}<ChevronDown size={10} className="text-slate-300" /></span></div>
                    </button>
                    <div className="relative">
                      <button onClick={() => setIsFloorPickerOpen(!isFloorPickerOpen)} className="group flex items-center gap-3 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-500 transition-all">
                        <div className="p-1 bg-blue-50 rounded-lg text-blue-600"><Layers3 size={12} strokeWidth={3} /></div>
                        <div className="flex flex-col text-left leading-none"><span className="text-[11px] font-black text-slate-900 flex items-center gap-1">{activeFloor?.name || 'Select Floor'}<ChevronDown size={10} className="text-slate-300" /></span></div>
                      </button>
                      {isFloorPickerOpen && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50">
                          {location?.floors.map(f => (
                            <div key={f.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                              <button onClick={() => { onSwitchFloor(f.id); setIsFloorPickerOpen(false); }} className="flex-1 text-left text-xs font-bold text-slate-700">{f.name}</button>
                              {location.floors.length > 1 && isOwner && (
                                <button onClick={() => handleRemoveFloor(f.id)} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 size={12} /></button>
                              )}
                            </div>
                          ))}
                          <div className="h-px bg-slate-100 my-1" />
                          {isOwner && (
                            <button onClick={handleAddFloor} className="w-full px-3 py-2 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2"><Plus size={12} /> Add Floor</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {isOwner && (
                    <div className="flex items-center gap-1 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
                      <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"><Undo2 size={16} /></button>
                      <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-all"><Redo2 size={16} /></button>
                    </div>
                  )}
                  {isOwner && (
                    <div className="relative">
                        <button onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-[0.98]"><Plus size={14} strokeWidth={3} />ADD BLOCK</button>
                        {isAddMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden flex flex-col p-1.5 animate-in fade-in slide-in-from-top-2">
                                <button onClick={() => handleAddRoom('reservable')} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-emerald-50 text-emerald-700 font-black text-xs transition-all text-left"><Calendar size={14} />Reservable Space</button>
                                <button onClick={() => handleAddRoom('service')} className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 text-slate-600 font-black text-xs transition-all text-left"><Sparkles size={14} />Service Area</button>
                            </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
              <div ref={containerRef} className="flex-1 relative bg-white border-t border-slate-200 shadow-inner blueprint-grid overflow-hidden" onClick={(e) => { if (e.target === e.currentTarget) setSelectedRoomIds([]); }}>
                {rooms.map((room) => {
                  const isSelected = selectedRoomIds.includes(room.id);
                  const isSmall = room.width < 10 || room.height < 10;
                  return (
                    <div key={room.id} onMouseDown={(e) => handleMouseDown(e, room)} className={`${getBlockStyle(room)} group`} style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.width}%`, height: `${room.height}%` }}>
                      <span className={`font-black uppercase tracking-tighter leading-[0.95] block w-full px-0.5 break-words pointer-events-none ${isSmall ? 'text-[8px]' : 'text-sm'}`}>{room.name}</span>
                      {isSelected && <div onMouseDown={(e) => handleResizeStart(e, room)} className="absolute bottom-1 right-1 p-1 bg-emerald-500 text-white rounded-lg cursor-nwse-resize hover:scale-110 transition-all shadow-md"><Maximize2 size={12} strokeWidth={3} className="rotate-90" /></div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedRoomIds.length > 0 && (
              <aside className="w-[420px] bg-white border-l border-slate-200 p-10 flex flex-col overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between mb-8">
                  <div className="bg-emerald-50 text-emerald-600 p-4 rounded-3xl"><Edit3 size={24} /></div>
                  {isOwner && <button onClick={handleDeleteRoom} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20} /></button>}
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-8">{isOwner ? 'Block Properties' : 'Block Information'}</h3>
                <div className="space-y-6">
                    <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Room Name</label><input type="text" readOnly={!isOwner} value={isMultiSelect ? "" : (selectedRooms[0]?.name || "")} placeholder={isMultiSelect ? "Mixed Names" : ""} onChange={(e) => handleUpdateField('name', e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-900 outline-none" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label><input type="text" readOnly={!isOwner} value={isMultiSelect ? "" : (selectedRooms[0]?.type || "")} placeholder={isMultiSelect ? "Mixed Types" : "e.g. Meeting"} onChange={(e) => handleUpdateField('type', e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-900 outline-none" /></div>
                      <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Price/Hr ($)</label><input type="number" readOnly={!isOwner} value={isMultiSelect ? "" : (selectedRooms[0]?.pricePerHour || 0)} onChange={(e) => handleUpdateField('pricePerHour', Number(e.target.value))} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-900 outline-none" /></div>
                    </div>

                    {/* Image Gallery Management */}
                    {!isMultiSelect && (
                      <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Room Gallery</label>
                        
                        {isOwner && (
                          <div 
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleImageUpload}
                            className="relative group cursor-pointer"
                          >
                            <input 
                              type="file" 
                              multiple 
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 group-hover:border-emerald-400 group-hover:bg-emerald-50/30 transition-all">
                              <div className="p-3 bg-slate-100 text-slate-400 rounded-xl group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all">
                                <Upload size={20} />
                              </div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-600">Drop images or click to upload</p>
                            </div>
                          </div>
                        )}

                        {selectedRooms[0]?.images && selectedRooms[0].images.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {selectedRooms[0].images.map((img, idx) => (
                              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group/img border border-slate-100">
                                <img src={img} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                                {isOwner && (
                                  <button 
                                    onClick={() => handleDeleteImage(idx)}
                                    className="absolute top-1 right-1 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-all hover:bg-rose-600"
                                  >
                                    <Trash size={12} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {isOwner && <button onClick={() => setSelectedRoomIds([])} className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all mt-4">Save Changes</button>}
                </div>
              </aside>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-auto bg-slate-50/30 p-10 lg:p-16">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
               {/* Forms Area */}
               <div className="lg:col-span-2 space-y-12">
                  {externalView === 'brand' && (
                    <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div className="flex items-center gap-4 mb-8">
                          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><Building2 size={24} /></div>
                          <div>
                             <h3 className="text-2xl font-black text-slate-900 tracking-tight">Organization Identity</h3>
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Updates public selection screens</p>
                          </div>
                       </div>
                       <div className="space-y-6">
                          <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Workplace Title</label>
                             <input 
                               type="text" 
                               readOnly={!isOwner}
                               value={vendor.name} 
                               onChange={(e) => onUpdateVendor(vendor.id, { name: e.target.value })}
                               className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-emerald-400 focus:bg-white transition-all shadow-sm"
                             />
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subtext / Description</label>
                             <textarea 
                               readOnly={!isOwner}
                               value={vendor.description} 
                               onChange={(e) => onUpdateVendor(vendor.id, { description: e.target.value })}
                               rows={3}
                               className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-emerald-400 focus:bg-white transition-all shadow-sm resize-none"
                             />
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand Logo</label>
                             <div className="flex items-center gap-4">
                               <img src={vendor.logo} className="w-16 h-16 rounded-2xl object-cover border border-slate-100" alt="" />
                               {isOwner && (
                                 <label className="flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all text-xs font-black text-slate-600 uppercase tracking-widest">
                                   <Upload size={14} />
                                   Upload
                                   <input
                                     type="file"
                                     accept="image/*"
                                     className="hidden"
                                     onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       e.target.value = '';
                                       if (file) vendorLogoCrop.queueFile(file);
                                     }}
                                   />
                                 </label>
                               )}
                             </div>
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opening Times / Access</label>
                             <div className="relative">
                                <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                  type="text" 
                                  readOnly={!isOwner}
                                  value={vendor.access} 
                                  onChange={(e) => onUpdateVendor(vendor.id, { access: e.target.value })}
                                  placeholder="e.g. 24/7 Access"
                                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-emerald-400 focus:bg-white transition-all shadow-sm"
                                />
                             </div>
                          </div>
                       </div>
                    </section>
                  )}

                  {externalView === 'branch' && (
                    <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div className="flex items-center gap-4 mb-8">
                          <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><MapPin size={24} /></div>
                          <div>
                             <h3 className="text-2xl font-black text-slate-900 tracking-tight">Branch Metadata</h3>
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Specific details for {location.name}</p>
                          </div>
                       </div>
                       <div className="space-y-6">
                          <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch Name</label>
                             <input 
                               type="text" 
                               readOnly={!isOwner}
                               value={location.name} 
                               onChange={(e) => onUpdateLocationMeta(location.id, { name: e.target.value })}
                               className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white transition-all shadow-sm"
                             />
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Physical Address</label>
                             <input 
                               type="text" 
                               readOnly={!isOwner}
                               value={location.address} 
                               onChange={(e) => onUpdateLocationMeta(location.id, { address: e.target.value })}
                               className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white transition-all shadow-sm"
                             />
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Google Maps URL</label>
                             <div className="relative">
                                <MapIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                  type="text" 
                                  readOnly={!isOwner}
                                  value={location.mapUrl || ''} 
                                  onChange={(e) => onUpdateLocationMeta(location.id, { mapUrl: e.target.value })}
                                  placeholder="https://maps.google.com/..."
                                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white transition-all shadow-sm"
                                />
                             </div>
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City Tag (Quick Filter)</label>
                             <div className="relative">
                                <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                  type="text" 
                                  readOnly={!isOwner}
                                  value={location.city || ''} 
                                  onChange={(e) => onUpdateLocationMeta(location.id, { city: e.target.value })}
                                  placeholder="e.g. Cairo"
                                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white transition-all shadow-sm"
                                />
                             </div>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Only 1 city tag allowed per branch for quick filtering.</p>
                          </div>
                          <div className="flex flex-col gap-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch Access Code (Staff Portal)</label>
                             <div className="relative">
                                <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input 
                                  type="text" 
                                  readOnly={!isOwner}
                                  value={staffCodeDraft} 
                                  onFocus={() => onStaffCodeFocus?.(location.id)}
                                  onChange={(e) => setStaffCodeDraft(e.target.value)}
                                  onBlur={(e) => {
                                    const normalized = e.target.value.trim().toUpperCase();
                                    setStaffCodeDraft(normalized);
                                    onStaffCodeBlur?.(location.id);
                                    onUpdateLocationMeta(location.id, { staffAccessCode: normalized });
                                  }}
                                  placeholder="e.g. NS-SF-88"
                                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white transition-all shadow-sm"
                                />
                             </div>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Unique code for direct entry into this branch dashboard.</p>
                           </div>
                        </div>
                     </section>
                  )}

                  {externalView === 'tags' && (
                    <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div className="flex items-center justify-between mb-10">
                          <div className="flex items-center gap-4">
                             <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Layers size={24} /></div>
                             <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Tag Management</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manage filters for brand and branches</p>
                             </div>
                          </div>

                          <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                             <button 
                               onClick={() => setTagSubTab('brand')}
                               className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${tagSubTab === 'brand' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                             >
                               Brand Tags
                             </button>
                             <button 
                               onClick={() => setTagSubTab('branch')}
                               className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${tagSubTab === 'branch' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                             >
                               Branch Tags
                             </button>
                          </div>
                       </div>
                       
                       <div className="space-y-10">
                          {tagSubTab === 'brand' ? (
                            /* Brand Tags */
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                               <div className="flex items-center justify-between">
                                  <div className="flex flex-col">
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Global Brand Tags</label>
                                     <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">These tags apply across all your locations</p>
                                  </div>
                               </div>
                               <div className="flex flex-wrap gap-2 p-8 bg-slate-50 border border-slate-100 rounded-[2rem] min-h-[150px] items-start">
                                  {(vendor.tags || []).map(tag => (
                                     <div key={tag} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm animate-in zoom-in-95">
                                        <span className="text-xs font-black text-slate-700">{tag}</span>
                                        {isOwner && (
                                          <button 
                                            onClick={() => onUpdateVendor(vendor.id, { tags: vendor.tags?.filter(t => t !== tag) })}
                                            className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                                          >
                                            <X size={14} />
                                          </button>
                                        )}
                                     </div>
                                  ))}
                                  {isOwner && (
                                    <div className="relative group">
                                       <input 
                                         type="text"
                                         placeholder="Add global tag..."
                                         onKeyDown={(e) => {
                                           if (e.key === 'Enter') {
                                             const val = e.currentTarget.value.trim();
                                             if (val && !vendor.tags?.includes(val)) {
                                               onUpdateVendor(vendor.id, { tags: [...(vendor.tags || []), val] });
                                               e.currentTarget.value = '';
                                             }
                                           }
                                         }}
                                         className="px-5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 w-48 shadow-sm transition-all"
                                       />
                                    </div>
                                  )}
                               </div>
                            </div>
                          ) : (
                            /* Branch Tags */
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                               <div className="flex items-center justify-between">
                                  <div className="flex flex-col">
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Branch Specific Tags</label>
                                     <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">Unique tags for individual locations</p>
                                  </div>
                                  
                                  {/* Branch Selector for Tags */}
                                  <div className="relative group">
                                     <select 
                                       value={location.id}
                                       onChange={(e) => onSwitchLocation(e.target.value)}
                                       className="appearance-none pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none focus:border-indigo-400 cursor-pointer transition-all"
                                     >
                                       {locations.map(loc => (
                                         <option key={loc.id} value={loc.id}>{loc.name}</option>
                                       ))}
                                     </select>
                                     <MapPin size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                     <ChevronDown size={12} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                  </div>
                               </div>
                               <div className="flex flex-wrap gap-2 p-8 bg-slate-50 border border-slate-100 rounded-[2rem] min-h-[150px] items-start">
                                  {(location.tags || []).map(tag => (
                                     <div key={tag} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm animate-in zoom-in-95">
                                        <span className="text-xs font-black text-slate-700">{tag}</span>
                                        {isOwner && (
                                          <button 
                                            onClick={() => onUpdateLocationMeta(location.id, { tags: location.tags?.filter(t => t !== tag) })}
                                            className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                                          >
                                            <X size={14} />
                                          </button>
                                        )}
                                     </div>
                                  ))}
                                  {isOwner && (
                                    <div className="relative group">
                                       <input 
                                         type="text"
                                         placeholder={`Add tag for ${location.name}...`}
                                         onKeyDown={(e) => {
                                           if (e.key === 'Enter') {
                                             const val = e.currentTarget.value.trim();
                                             if (val && !location.tags?.includes(val)) {
                                               onUpdateLocationMeta(location.id, { tags: [...(location.tags || []), val] });
                                               e.currentTarget.value = '';
                                             }
                                           }
                                         }}
                                         className="px-5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-400 w-64 shadow-sm transition-all"
                                       />
                                    </div>
                                  )}
                               </div>
                            </div>
                          )}
                       </div>
                    </section>
                  )}
               </div>

               {/* Preview Area */}
               <div className="space-y-8">
                  <AnimatePresence mode="wait">
                    {(externalView === 'brand' || (externalView === 'tags' && tagSubTab === 'brand')) && (
                      <motion.div 
                        key="brand-preview"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="sticky top-10"
                      >
                         <div className="flex items-center gap-2 mb-4 px-2">
                            <Info size={14} className="text-slate-400" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer View Preview</span>
                         </div>
                         
                         <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
                            <div className="h-48 relative overflow-hidden bg-slate-200">
                               <img src={vendor.logo} className="w-full h-full object-cover" alt="" />
                               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            </div>
                            <div className="p-8">
                               <h4 className="text-2xl font-black text-slate-900 tracking-tight mb-2">{vendor.name}</h4>
                               <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6 line-clamp-2">{vendor.description}</p>
                               
                               {/* Tags Preview */}
                               <div className="flex flex-wrap gap-1.5 mb-6">
                                  {(vendor.tags || []).slice(0, 3).map(tag => (
                                     <span key={tag} className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                        {tag}
                                     </span>
                                  ))}
                                  {(vendor.tags || []).length > 3 && (
                                    <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-md text-[8px] font-black text-blue-600 uppercase tracking-widest">
                                      +{(vendor.tags || []).length - 3} More
                                    </span>
                                  )}
                               </div>

                               <div className="flex items-center gap-6 mb-6">
                                  <div>
                                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Access</p>
                                     <p className="text-xs font-black text-slate-900">{vendor.access}</p>
                                  </div>
                                  <div className="w-px h-6 bg-slate-100" />
                                  <div>
                                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                     <p className="text-xs font-black text-emerald-600">Active</p>
                                  </div>
                               </div>
                            </div>
                         </div>

                         <div className="mt-8 p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                            <div className="flex gap-4">
                               <div className="p-2 bg-emerald-600 text-white rounded-xl h-fit"><Globe size={18} /></div>
                               <div>
                                  <p className="text-xs font-black text-emerald-700 tracking-tight">Sync Status: Live</p>
                                  <p className="text-[10px] font-medium text-emerald-600 mt-1">Your changes are automatically synced to the global network catalog.</p>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    )}

                    {(externalView === 'branch' || (externalView === 'tags' && tagSubTab === 'branch')) && (
                      <motion.div 
                        key="branch-preview"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="sticky top-10"
                      >
                         <div className="flex items-center gap-2 mb-4 px-2">
                            <Info size={14} className="text-slate-400" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer View Preview</span>
                         </div>
                         
                         <div className="bg-white rounded-[3.5rem] p-8 border-2 border-slate-100 shadow-xl overflow-hidden flex flex-col gap-6">
                            <div className="w-full h-40 shrink-0 rounded-[2.5rem] overflow-hidden shadow-inner bg-slate-100 relative">
                               <img 
                                src={location.image || `https://picsum.photos/seed/${location.id}/600/600`} 
                                className="w-full h-full object-cover" 
                                alt={location.name}
                               />
                               <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
                               <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30 text-white text-[8px] font-black uppercase tracking-widest">
                                 <Sparkles size={10} />
                                 Verified
                               </div>
                            </div>

                            <div className="flex-1 flex flex-col relative z-10">
                              <div className="mb-4">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                                  {location.name}
                                </h3>
                                
                                {(location.address || location.mapUrl) && (
                                  <div className="mt-2 flex items-start gap-2">
                                     <MapPin size={14} className="text-rose-500 mt-0.5 shrink-0" />
                                     <span className="text-[10px] font-bold text-slate-500 line-clamp-2">
                                        {location.address}
                                     </span>
                                  </div>
                                )}

                                {location.tags && location.tags.length > 0 && (
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {location.tags.slice(0, 3).map(tag => (
                                      <span key={tag} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                        {tag}
                                      </span>
                                    ))}
                                    {location.tags.length > 3 && (
                                      <span className="px-2 py-1 bg-blue-50 border border-blue-100 rounded-lg text-[8px] font-black text-blue-600 uppercase tracking-widest">
                                        +{location.tags.length - 3} More
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="mt-auto flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] text-blue-600">
                                View Blueprint
                                <ArrowRight size={14} />
                              </div>
                            </div>
                         </div>

                         <div className="mt-8 p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                            <div className="flex gap-4">
                               <div className="p-2 bg-emerald-600 text-white rounded-xl h-fit"><Globe size={18} /></div>
                               <div>
                                  <p className="text-xs font-black text-emerald-700 tracking-tight">Sync Status: Live</p>
                                  <p className="text-[10px] font-medium text-emerald-600 mt-1">Your changes are automatically synced to the global network catalog.</p>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>
            </div>
          </div>
        )}
      </div>

      {isPickerOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300">
             <header className="px-12 py-10 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
               <div className="flex items-center gap-4">
                 <div>
                   <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2 flex items-center gap-4">
                     Branch Selection
                     {isOwner && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); onAddLocation(); }} 
                         className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                         title="Add New Branch"
                       >
                         <PlusCircle size={24} />
                       </button>
                     )}
                   </h3>
                   <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Architectural Context</p>
                 </div>
               </div>
               <div className="flex items-center gap-4">
                 <button onClick={() => setIsPickerOpen(false)} className="p-4 bg-slate-100 hover:bg-rose-50 rounded-2xl transition-all">
                    <X size={24} />
                 </button>
               </div>
             </header>
             <div className="flex-1 overflow-y-auto p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {locations.filter((loc, index, self) => 
                 index === self.findIndex((t) => t.id === loc.id)
               ).map((loc) => (
                 <div 
                   key={loc.id} 
                   onClick={() => { 
                     onSwitchLocation(loc.id); 
                     onViewChange?.('branch'); 
                     setIsPickerOpen(false); 
                   }} 
                   className={`group relative bg-white p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer flex flex-col ${location?.id === loc.id ? 'border-emerald-500 shadow-xl bg-emerald-50/10' : 'border-slate-100 hover:border-emerald-200'}`}
                 >
                   <div className="flex flex-col gap-1 mb-6 pr-14">
                     <h4 className="text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors truncate">{loc.name}</h4>
                   </div>
                   <div className="flex items-center gap-2 text-slate-400 font-bold text-xs mt-auto mb-6">
                     <Layers size={14} /> {loc.floors.length} Floors Configured
                   </div>
                   <div className="py-4 rounded-2xl bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                     Configure Branch <ArrowRight size={14} />
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {roomImageCrop.cropPortal}
      {vendorLogoCrop.cropPortal}

    </div>
  );
};

export default PropertyConfig;
