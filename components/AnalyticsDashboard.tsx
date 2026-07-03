import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag, 
  Coffee, 
  Bookmark, 
  Info, 
  Layers, 
  Activity,
  ArrowRight,
  TrendingDown,
  Clock,
  MapPin,
  ChevronRight,
  Download,
  X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Reservation, LocationData, Vendor, Room } from '../types';

interface AnalyticsDashboardProps {
  locations: LocationData[];
  reservations: Reservation[];
  selectedVendor: Vendor;
  userRole?: 'customer' | 'employee' | 'owner' | null;
  currentLocationId?: string;
}

export default function AnalyticsDashboard({ 
  locations, 
  reservations, 
  selectedVendor,
  userRole,
  currentLocationId
}: AnalyticsDashboardProps) {
  // Get today in YYYY-MM-DD
  const todayStr = useMemo(() => {
    // Standardized ISO date of current time
    return new Date().toISOString().split('T')[0];
  }, []);

  // Default date window: last 7 days
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const [showPdfExportModal, setShowPdfExportModal] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState(defaultStartDate);
  const [pdfEndDate, setPdfEndDate] = useState(todayStr);

  // Sync selected location if user is an employee logged into a specific branch
  React.useEffect(() => {
    if (userRole === 'employee' && currentLocationId) {
      setSelectedLocationId(currentLocationId);
    }
  }, [userRole, currentLocationId]);

  // Quick preset handlers
  const handleSetPreset = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth') => {
    const today = new Date();
    if (preset === 'today') {
      const dateStr = today.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (preset === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'thisMonth') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(startOfMonth.toISOString().split('T')[0]);
      setEndDate(endOfMonth.toISOString().split('T')[0]);
    }
  };

  // 1. Filtered Reservations list based on date filters and active Location
  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      // Must belong to this vendor
      if (res.vendorId !== selectedVendor.id) return false;
      
      // Filter strictly by location if employee, otherwise use selection filter
      const activeLocId = userRole === 'employee' ? currentLocationId : selectedLocationId;
      if (activeLocId && activeLocId !== 'all' && res.locationId !== activeLocId) return false;
      
      // Filter by start and end date
      const rDate = res.date; // YYYY-MM-DD
      return rDate >= startDate && rDate <= endDate;
    });
  }, [reservations, selectedVendor, startDate, endDate, selectedLocationId, userRole, currentLocationId]);

  // All rooms lookup map
  const roomsMap = useMemo(() => {
    const map: Record<string, { room: Room; locationName: string }> = {};
    locations.forEach(loc => {
      loc.floors.forEach(floor => {
        floor.rooms.forEach(room => {
          map[room.id] = { room, locationName: loc.name };
        });
      });
    });
    return map;
  }, [locations]);

  // Menu items pricing lookup map
  const menuItemLookup = useMemo(() => {
    const map: Record<string, { name: string; price: number; image?: string }> = {};
    
    // Add vendor level menu items
    if (selectedVendor.menu) {
      selectedVendor.menu.forEach(item => {
        map[item.id] = { name: item.name, price: item.price, image: item.image };
      });
    }

    // Add branch/location level menu items
    locations.forEach(loc => {
      if (loc.menu) {
        loc.menu.forEach(item => {
          map[item.id] = { name: item.name, price: item.price, image: item.image };
        });
      }
      
      // Add room level menu items
      loc.floors.forEach(floor => {
        floor.rooms.forEach(room => {
          if (room.menu) {
            room.menu.forEach(item => {
              map[item.id] = { name: item.name, price: item.price, image: item.image };
            });
          }
        });
      });
    });

    return map;
  }, [selectedVendor, locations]);

  // 2. Compute Reservation Statistics
  const reservationStats = useMemo(() => {
    let totalCount = filteredReservations.length;
    let approvedCount = 0;
    let pendingCount = 0;
    let declinedCount = 0;
    
    let userPrepaidCount = 0; // Bookings made by user (using credits or card)
    let manualCashCount = 0;  // Bookings made by staff/walk-in manually (typically 'cash')

    filteredReservations.forEach(res => {
      if (res.status === 'approved') {
        approvedCount++;
        if (res.paymentMethod === 'cash') {
          manualCashCount++;
        } else {
          userPrepaidCount++;
        }
      } else if (res.status === 'pending') {
        pendingCount++;
      } else if (res.status === 'declined') {
        declinedCount++;
      }
    });

    return {
      totalCount,
      approvedCount,
      pendingCount,
      declinedCount,
      userPrepaidCount,
      manualCashCount
    };
  }, [filteredReservations]);

  // 3. Compute Room Usage Stats
  const roomUsageStats = useMemo(() => {
    const frequencyMap: Record<string, { count: number; hours: number; revenue: number }> = {};
    
    filteredReservations.forEach(res => {
      if (res.status !== 'approved') return; // Only count completed/confirmed reservations
      
      const details = roomsMap[res.roomId];
      const pricePerHour = details ? details.room.pricePerHour : 0;
      const resRevenue = pricePerHour * res.duration;

      if (!frequencyMap[res.roomId]) {
        frequencyMap[res.roomId] = { count: 0, hours: 0, revenue: 0 };
      }
      frequencyMap[res.roomId].count += 1;
      frequencyMap[res.roomId].hours += res.duration;
      frequencyMap[res.roomId].revenue += resRevenue;
    });

    // Populate all rooms for the chosen location (so we show rooms with 0 bookings as well)
    const statsList: Array<{ roomId: string; roomName: string; locationName: string; count: number; hours: number; revenue: number }> = [];
    
    locations.forEach(loc => {
      const activeLocId = userRole === 'employee' ? currentLocationId : selectedLocationId;
      if (activeLocId && activeLocId !== 'all' && loc.id !== activeLocId) return;
      
      loc.floors.forEach(floor => {
        floor.rooms.forEach(room => {
          const state = frequencyMap[room.id] || { count: 0, hours: 0, revenue: 0 };
          statsList.push({
            roomId: room.id,
            roomName: room.name,
            locationName: loc.name,
            count: state.count,
            hours: state.hours,
            revenue: state.revenue
          });
        });
      });
    });

    // Sort by booking count descending
    return statsList.sort((a, b) => b.count - a.count);
  }, [filteredReservations, locations, roomsMap, selectedLocationId, userRole, currentLocationId]);

  // 4. Compute Menu Item Stats
  const menuUsageStats = useMemo(() => {
    const stats: Record<string, { count: number; quantity: number; revenue: number }> = {};

    filteredReservations.forEach(res => {
      // Only count ordered menu items if reservation is approved
      if (res.status !== 'approved') return;

      if (res.selectedMenuItems && res.selectedMenuItems.length > 0) {
        res.selectedMenuItems.forEach(orderItem => {
          const itemMeta = menuItemLookup[orderItem.itemId];
          const itemPrice = itemMeta ? itemMeta.price : 0;
          const itemRevenue = itemPrice * orderItem.quantity;
          
          if (!stats[orderItem.itemId]) {
            stats[orderItem.itemId] = { count: 0, quantity: 0, revenue: 0 };
          }
          stats[orderItem.itemId].count += 1;
          stats[orderItem.itemId].quantity += orderItem.quantity;
          stats[orderItem.itemId].revenue += itemRevenue;
        });
      }
    });

    // Build lists with pretty metadata
    const itemsList: Array<{ itemId: string; name: string; quantity: number; orderCount: number; revenue: number; price: number; image?: string }> = [];
    let grandMenuRevenue = 0;

    Object.entries(stats).forEach(([itemId, data]) => {
      const itemMeta = menuItemLookup[itemId];
      const name = itemMeta ? itemMeta.name : `Item #${itemId}`;
      const price = itemMeta ? itemMeta.price : 0;
      const image = itemMeta ? itemMeta.image : undefined;

      grandMenuRevenue += data.revenue;

      itemsList.push({
        itemId,
        name,
        price,
        image,
        quantity: data.quantity,
        orderCount: data.count,
        revenue: data.revenue
      });
    });

    // Sort by ordered-quantity descending
    return {
      items: itemsList.sort((a, b) => b.quantity - a.quantity),
      grandMenuRevenue
    };
  }, [filteredReservations, menuItemLookup]);

  // 5. Total Financial Revenue
  const financialTotals = useMemo(() => {
    // Total Room Reservation Revenue: sum of (pricePerHour * duration) for all approved reservations
    let totalRoomRevenue = 0;
    filteredReservations.forEach(res => {
      if (res.status !== 'approved') return;
      const details = roomsMap[res.roomId];
      const rate = details ? details.room.pricePerHour : 0;
      totalRoomRevenue += (rate * res.duration);
    });

    const totalMenuRevenue = menuUsageStats.grandMenuRevenue;
    const grandTotalRevenue = totalRoomRevenue + totalMenuRevenue;

    return {
      totalRoomRevenue,
      totalMenuRevenue,
      grandTotalRevenue
    };
  }, [filteredReservations, roomsMap, menuUsageStats]);

  const handleDownloadPdf = () => {
    // 1. Filter target reservations strictly in the chosen date range
    const targetReservations = reservations.filter(res => {
      if (res.vendorId !== selectedVendor.id) return false;
      const activeLocId = userRole === 'employee' ? currentLocationId : selectedLocationId;
      if (activeLocId && activeLocId !== 'all' && res.locationId !== activeLocId) return false;
      const rDate = res.date;
      return rDate >= pdfStartDate && rDate <= pdfEndDate;
    });

    const activeBranchName = userRole === 'employee' 
      ? (locations.find(l => l.id === currentLocationId)?.name || 'Branch')
      : (selectedLocationId === 'all' ? 'All Branch Locations' : (locations.find(l => l.id === selectedLocationId)?.name || 'Branch'));

    let totalCount = targetReservations.length;
    let approvedCount = 0;
    targetReservations.forEach(r => {
      if (r.status === 'approved') approvedCount++;
    });

    // Room stats
    const targetRoomStats: Array<{ name: string; locationName: string; count: number; hours: number; revenue: number }> = [];
    locations.forEach(loc => {
      const activeLocId = userRole === 'employee' ? currentLocationId : selectedLocationId;
      if (activeLocId && activeLocId !== 'all' && loc.id !== activeLocId) return;
      
      loc.floors.forEach(floor => {
        floor.rooms.forEach(room => {
          let count = 0;
          let hours = 0;
          let revenue = 0;
          targetReservations.forEach(res => {
            if (res.roomId === room.id && res.status === 'approved') {
              count++;
              hours += res.duration;
              revenue += (room.pricePerHour * res.duration);
            }
          });
          targetRoomStats.push({
            name: room.name,
            locationName: loc.name,
            count,
            hours,
            revenue
          });
        });
      });
    });
    // Sort descending by count
    targetRoomStats.sort((a, b) => b.count - a.count);

    // Menu stats
    const targetMenuStats: Record<string, { quantity: number; revenue: number; orderCount: number }> = {};
    targetReservations.forEach(res => {
      if (res.status !== 'approved' || !res.selectedMenuItems) return;
      res.selectedMenuItems.forEach(orderItem => {
        const itemMeta = menuItemLookup[orderItem.itemId];
        const itemPrice = itemMeta ? itemMeta.price : 0;
        if (!targetMenuStats[orderItem.itemId]) {
          targetMenuStats[orderItem.itemId] = { quantity: 0, revenue: 0, orderCount: 0 };
        }
        targetMenuStats[orderItem.itemId].quantity += orderItem.quantity;
        targetMenuStats[orderItem.itemId].revenue += (itemPrice * orderItem.quantity);
        targetMenuStats[orderItem.itemId].orderCount += 1;
      });
    });

    const targetMenuList = Object.entries(targetMenuStats).map(([itemId, stats]) => {
      const itemMeta = menuItemLookup[itemId];
      const name = itemMeta ? itemMeta.name : `Item #${itemId}`;
      return {
        name,
        quantity: stats.quantity,
        orderCount: stats.orderCount,
        revenue: stats.revenue
      };
    }).sort((a, b) => b.quantity - a.quantity);

    const totalRoomRevenue = targetRoomStats.reduce((sum, r) => sum + r.revenue, 0);
    const totalMenuRevenue = targetMenuList.reduce((sum, m) => sum + m.revenue, 0);
    const totalRevenue = totalRoomRevenue + totalMenuRevenue;

    const doc = new jsPDF();
    
    // Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("NOVASPACE WORKSPACE ANALYTICS BRIEF REPORT", 14, 20);
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 22, 196, 22);

    let y = 30;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`* REPORT DATE RANGE: ${pdfStartDate} to ${pdfEndDate}`, 14, y); y += 6;
    doc.text(`* TARGETED BRANCH  : ${activeBranchName}`, 14, y); y += 6;
    doc.text(`* REPORT GENERATION : ${new Date().toLocaleString()}`, 14, y); y += 10;

    doc.setFont("Helvetica", "bold");
    doc.text("--- EXECUTIVE FINANCIAL SUMMARY ---", 14, y); y += 8;
    doc.setFont("Helvetica", "normal");
    doc.text(`* Total Reservations Processed : ${totalCount} reservations`, 14, y); y += 6;
    doc.text(`* Approved Bookings (Confirmed) : ${approvedCount} bookings`, 14, y); y += 6;
    doc.text(`* Aggregate Revenue Accomplished: ${totalRevenue.toLocaleString()} EGP`, 14, y); y += 6;
    doc.text(`  - Room Reservations Sub-Total: ${totalRoomRevenue.toLocaleString()} EGP`, 14, y); y += 6;
    doc.text(`  - Catering Services Sub-Total: ${totalMenuRevenue.toLocaleString()} EGP`, 14, y); y += 10;

    doc.setFont("Helvetica", "bold");
    doc.text("--- WORKSPACE RESERVATION INDEX (1-LINER ENTRIES) ---", 14, y); y += 8;
    doc.setFont("Helvetica", "normal");

    if (targetRoomStats.length > 0) {
      targetRoomStats.forEach(stat => {
        if (y > 275) { doc.addPage(); y = 20; }
        const lineStr = `* Room "${stat.name}" : ${stat.count} bookings | ${stat.hours} hrs total | ${stat.revenue.toLocaleString()} EGP`;
        doc.text(lineStr, 14, y);
        y += 6;
      });
    } else {
      doc.text("No active room reservations recorded in this period.", 14, y);
      y += 6;
    }

    y += 6;
    if (y > 270) { doc.addPage(); y = 20; }

    doc.setFont("Helvetica", "bold");
    doc.text("--- CATERING & CAFE SERVICES INDEX (1-LINER ENTRIES) ---", 14, y); y += 8;
    doc.setFont("Helvetica", "normal");

    if (targetMenuList.length > 0) {
      targetMenuList.forEach(stat => {
        if (y > 275) { doc.addPage(); y = 20; }
        const lineStr = `* Catering Item "${stat.name}" : ${stat.quantity} ordered | ${stat.orderCount} distinct orders | ${stat.revenue.toLocaleString()} EGP`;
        doc.text(lineStr, 14, y);
        y += 6;
      });
    } else {
      doc.text("No catering items ordered in this period.", 14, y);
      y += 6;
    }

    y += 10;
    if (y > 280) { doc.addPage(); y = 20; }
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(8);
    doc.text("End of automated intelligence report.", 14, y);

    doc.save(`novaspace_analytics_${pdfStartDate}_to_${pdfEndDate}.pdf`);
    setShowPdfExportModal(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-10 font-[Inter] animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Block */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-[0.2em] mb-1.5">
              <BarChart3 size={14} />
              <span>Real-time Workspace Intelligence</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Business Analytics</h2>
            <p className="text-slate-500 font-medium italic text-xs mt-0.5">Explore booking volume, workspace occupancy, and catering revenues.</p>
          </div>

          {/* Quick Stats Banner / Selected Vendor Identity with Export PDF Option */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 self-start md:self-auto">
            <button 
              id="export-pdf-doc-trigger"
              onClick={() => { setPdfStartDate(startDate); setPdfEndDate(endDate); setShowPdfExportModal(true); }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-2xl shadow-md transition-all hover:scale-[1.03] active:scale-95 flex-row shrink-0 cursor-pointer"
            >
              <Download size={14} className="text-white" />
              <span>Export PDF</span>
            </button>

            <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Brand</p>
                <p className="text-xs font-black text-slate-800">{selectedVendor.name}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Date Span Filter Block & Filter Toolbar */}
        <section className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-md space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Filter inputs */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-400" />
                <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Date Period:</span>
              </div>
              
              <div className="flex items-center gap-2">
                <input 
                  id="analytics-start-date"
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <ArrowRight size={14} className="text-slate-400 shrink-0" />
                <input 
                  id="analytics-end-date"
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Location Select filter */}
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-slate-400" />
                {userRole === 'employee' ? (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {locations.find(l => l.id === currentLocationId)?.name || 'Branch Lock'}
                  </span>
                ) : (
                  <select
                    id="analytics-branch-selector"
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Branch Locations</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Presets:</span>
              <button 
                id="preset-btn-today"
                onClick={() => handleSetPreset('today')} 
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${startDate === todayStr && endDate === todayStr ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'}`}
              >
                Today Only
              </button>
              <button 
                id="preset-btn-yesterday"
                onClick={() => handleSetPreset('yesterday')} 
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Yesterday
              </button>
              <button 
                id="preset-btn-last7"
                onClick={() => handleSetPreset('last7')} 
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                Last 7 Days
              </button>
              <button 
                id="preset-btn-month"
                onClick={() => handleSetPreset('thisMonth')} 
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
              >
                This Month
              </button>
            </div>

          </div>
        </section>

        {/* FINANCIAL SUMMARY & KPIs CARDS GRID */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card: Total Revenue */}
          <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-lg relative overflow-hidden flex flex-col justify-between group hover:scale-[1.02] transition-all duration-300">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">Total Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign size={16} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-black tracking-tight text-white mb-2">{financialTotals.grandTotalRevenue.toLocaleString()} <span className="text-xs font-black text-emerald-400 select-none">EGP</span></p>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-300 pl-0.5 mt-2 pt-2 border-t border-slate-800">
                <span>Rooms: <b className="text-white">{financialTotals.totalRoomRevenue.toLocaleString()} EGP</b></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                <span>Cafe: <b className="text-white">{financialTotals.totalMenuRevenue.toLocaleString()} EGP</b></span>
              </div>
            </div>
          </div>

          {/* Card: Total Completed/Confirmed Reservations */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-md relative overflow-hidden flex flex-col justify-between group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black tracking-widest text-blue-500 uppercase">Approved Bookings</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Bookmark size={16} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-black tracking-tight text-slate-900 mb-1">{reservationStats.approvedCount}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Successfully Confirmed</p>
              
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 pl-0.5 mt-2 pt-2 border-t border-slate-150">
                <span>User: <b className="text-blue-600">{reservationStats.userPrepaidCount}</b></span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>Manual: <b className="text-emerald-600">{reservationStats.manualCashCount}</b></span>
              </div>
            </div>
          </div>

          {/* Card: Total Requests */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-md relative overflow-hidden flex flex-col justify-between group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Total Reservations</span>
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
                <Activity size={16} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-black tracking-tight text-slate-900 mb-1">{reservationStats.totalCount}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total in range period</p>

              <div className="text-[10px] font-bold text-slate-500 pl-0.5 mt-2 pt-2 border-t border-slate-150 flex items-center gap-2">
                <span>Declined: <b className="text-rose-600">{reservationStats.declinedCount}</b></span>
              </div>
            </div>
          </div>

        </section>

        {/* DETAILED STATS COLUMNS: ROOMS vs MENU ITEMS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Room Allocation and Usage (col-span-6) */}
          <section className="lg:col-span-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col min-h-[480px]">
            <header className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Room Reservation Volume</h3>
                  <p className="text-[10px] font-bold text-slate-400 italic">Confirmed bookings count & booking hours allocation</p>
                </div>
              </div>
            </header>

            {/* List of rooms and reservation volumes */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 max-h-[400px]">
              {roomUsageStats.length > 0 ? (
                (() => {
                  const maxBookingsCount = Math.max(...roomUsageStats.map(r => r.count), 1);
                  return roomUsageStats.map((roomStat, idx) => {
                    const widthPercent = Math.max(5, Math.min(100, (roomStat.count / maxBookingsCount) * 100));
                    return (
                      <div key={roomStat.roomId} className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100/80 hover:border-blue-100 hover:bg-white transition-all duration-250">
                        <div className="flex items-start justify-between gap-4 mb-2.5">
                          <div>
                            <p className="text-xs font-black text-slate-950 leading-tight">{roomStat.roomName}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                              <MapPin size={9} className="text-slate-300" />
                              {roomStat.locationName}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-xs font-black text-slate-900 bg-white border border-slate-250/60 px-2.5 py-1 rounded-xl shadow-sm">
                              {roomStat.count} Bookings
                            </span>
                            <p className="text-[9px] font-bold text-slate-500 mt-1.5 uppercase tracking-wide">
                              {roomStat.hours} hrs total • <b className="text-emerald-600 font-black">{roomStat.revenue.toLocaleString()} EGP</b>
                            </p>
                          </div>
                        </div>

                        {/* Visual inline horizontal bar metric */}
                        <div className="w-full bg-slate-150 h-2.5 rounded-full overflow-hidden mt-1 select-none">
                          <div 
                            className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-100 border-dashed rounded-[2rem]">
                  <Layers size={36} className="text-slate-300 mb-2 opacity-60 animate-bounce-subtle" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center leading-relaxed">
                    No Reservations<br/>Found in selected period
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Menu Items Service Analytics (col-span-6) */}
          <section className="lg:col-span-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col min-h-[480px]">
            <header className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Coffee size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Menu Service Stats</h3>
                  <p className="text-[10px] font-bold text-slate-400 italic">Dishes/drinks quantity sold and aggregate item revenues</p>
                </div>
              </div>
              <div className="text-right select-none">
                <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-xl">
                  Total Sold: {menuUsageStats.items.reduce((sum, item) => sum + item.quantity, 0)} items
                </span>
              </div>
            </header>

            {/* List of ordered food items & price/revenue values */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[400px]">
              {menuUsageStats.items.length > 0 ? (
                menuUsageStats.items.map((menuItemStat) => (
                  <div 
                    key={menuItemStat.itemId} 
                    className="p-3.5 bg-slate-50/50 rounded-3xl border border-slate-150/70 hover:border-emerald-150 hover:bg-white transition-all duration-200 flex items-center gap-3.5"
                  >
                    {/* Item Thumbnail */}
                    <img 
                      src={menuItemStat.image || `https://picsum.photos/seed/${encodeURIComponent(menuItemStat.name)}/100/100`}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0"
                      alt={menuItemStat.name}
                      referrerPolicy="no-referrer"
                    />

                    {/* Metadata & Stats detail */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate">
                          <p className="text-xs font-black text-slate-900 truncate leading-tight">{menuItemStat.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wide">
                            {menuItemStat.price} EGP per unit
                          </p>
                        </div>

                        {/* Revenue metadata */}
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-emerald-600">{menuItemStat.revenue.toLocaleString()} EGP</p>
                          <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                            {menuItemStat.orderCount} orders
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quantity Badge */}
                    <div className="bg-emerald-50 border border-emerald-100/60 p-2.5 rounded-2xl flex flex-col items-center justify-center shrink-0 min-w-[50px] select-none">
                      <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">Qty</span>
                      <span className="text-sm font-black text-emerald-700 leading-none">x{menuItemStat.quantity}</span>
                    </div>

                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-100 border-dashed rounded-[2rem]">
                  <Coffee size={36} className="text-slate-300 mb-2 opacity-60" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center leading-relaxed">
                    No Food or Drinks Ordered<br/>Found in selected period
                  </span>
                </div>
              )}
            </div>
            
            {/* Grand revenue summary footer inside the column */}
            {menuUsageStats.items.length > 0 && (
              <footer className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-slate-800 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400"> CATERING SUB-TOTAL: </span>
                <span className="text-sm font-black text-emerald-600">{menuUsageStats.grandMenuRevenue.toLocaleString()} EGP</span>
              </footer>
            )}

          </section>

        </div>

      </div>

      {/* PDF Date Selection Modal */}
      {showPdfExportModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/60 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl w-full max-w-md relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowPdfExportModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-55 rounded-xl transition-all cursor-pointer border-0 bg-transparent"
            >
              <X size={18} />
            </button>

            <header className="mb-6">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <Download size={22} />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Export PDF Brief</h3>
              <p className="text-slate-500 font-medium text-xs mt-1 leading-relaxed">
                Choose the specific starting and ending dates to query database records and compile the simple 1-liner PDF.
              </p>
            </header>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Start Date
                </label>
                <div className="relative">
                  <input
                    id="pdf-export-start-date"
                    type="date"
                    value={pdfStartDate}
                    onChange={(e) => setPdfStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all hover:bg-slate-100/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  End Date
                </label>
                <div className="relative">
                  <input
                    id="pdf-export-end-date"
                    type="date"
                    value={pdfEndDate}
                    onChange={(e) => setPdfEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all hover:bg-slate-100/50"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPdfExportModal(false)}
                className="flex-1 px-5 py-3 font-black text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200/80"
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadPdf}
                className="flex-1 px-5 py-3 font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-md inline-flex items-center justify-center gap-1.5"
              >
                <Download size={14} />
                <span>Save PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
