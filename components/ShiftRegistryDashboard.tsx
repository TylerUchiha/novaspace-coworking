import React, { useState, useMemo, useEffect } from 'react';
import { Reservation, Employee, EmployeeShift } from '../types';
import { Clock, CheckSquare, Download, Play, CheckCircle2, LogOut, ShieldAlert, Coffee, StopCircle, KeyRound, User as UserIcon, Plus, Trash2, Edit2, Save, X, ShieldCheck, Calendar as CalendarIcon, Clock as ClockIcon, Coffee as CoffeeIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';

interface ShiftRegistryDashboardProps {
  allEmployees: Employee[];
  setAllEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  reservations: Reservation[];
  isGlobalAccess: boolean;
  clockedInEmployeeIds: string[];
  setClockedInEmployeeIds: React.Dispatch<React.SetStateAction<string[]>>;
  viewMode?: "analytics" | "management";
}

const formatTime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const calculateTotalWorked = (shifts: EmployeeShift[]) => {
  let total = 0;
  const today = new Date().toDateString();
  shifts.forEach(s => {
    const shiftDate = new Date(s.startTime).toDateString();
    if (shiftDate === today) {
      const end = s.endTime || Date.now();
      const breaksSum = s.breaks.reduce((acc, b) => acc + ((b.end || Date.now()) - b.start), 0);
      total += (end - s.startTime - breaksSum);
    }
  });
  return formatTime(total);
};

const calculateTotalBreaks = (shifts: EmployeeShift[]) => {
  let total = 0;
  const today = new Date().toDateString();
  shifts.forEach(s => {
    const shiftDate = new Date(s.startTime).toDateString();
    if (shiftDate === today) {
      total += s.breaks.reduce((acc, b) => acc + ((b.end || Date.now()) - b.start), 0);
    }
  });
  return formatTime(total);
};

function StaffShiftCard({ 
  employee, 
  allEmployees, 
  setAllEmployees,
  setClockedInEmployeeIds 
}: { 
  key?: any;
  employee: Employee;
  allEmployees: Employee[];
  setAllEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  setClockedInEmployeeIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [currentTimer, setCurrentTimer] = useState(0);
  const [currentBreakTimer, setCurrentBreakTimer] = useState(0);

  const activeShift = useMemo(() => employee.shifts.find(s => s.endTime === null), [employee.shifts]);
  
  const isOnBreak = useMemo(() => {
    if (!activeShift) return false;
    const lastBreak = activeShift.breaks[activeShift.breaks.length - 1];
    return Boolean(lastBreak && lastBreak.end === null);
  }, [activeShift]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeShift) {
      interval = setInterval(() => {
        const now = Date.now();
        let breaksDuration = 0;
        activeShift.breaks.forEach(b => {
          if (b.end) breaksDuration += (b.end - b.start);
          else breaksDuration += (now - b.start);
        });

        setCurrentBreakTimer(breaksDuration);
        setCurrentTimer(now - activeShift.startTime - breaksDuration);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeShift]);

  const handleToggleBreak = () => {
    if (!activeShift) return;
    setAllEmployees(prev => prev.map(emp => {
      if (emp.id !== employee.id) return emp;
      return {
        ...emp,
        shifts: emp.shifts.map(s => {
          if (s.id !== activeShift.id) return s;
          const breaks = [...s.breaks];
          if (isOnBreak) {
            breaks[breaks.length - 1].end = Date.now();
          } else {
            breaks.push({ start: Date.now(), end: null });
          }
          return { ...s, breaks };
        })
      };
    }));
  };

  const handleClockOut = () => {
    if (!activeShift) return;
    setAllEmployees(prev => prev.map(emp => {
      if (emp.id !== employee.id) return emp;
      return {
        ...emp,
        shifts: emp.shifts.map(s => {
          if (s.id !== activeShift.id) return s;
          const breaks = [...s.breaks];
          if (isOnBreak) {
            breaks[breaks.length - 1].end = Date.now();
          }
          return { ...s, breaks, endTime: Date.now() };
        })
      };
    }));
    setClockedInEmployeeIds(prev => prev.filter(id => id !== employee.id));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="md:col-span-1 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
          <img src={employee.pfp} alt={employee.name} className="w-24 h-24 rounded-3xl object-cover mb-4 border-4 border-white shadow-lg relative z-10" />
          <h3 className="text-xl font-black text-slate-900 tracking-tight z-10">{employee.name}</h3>
          <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-6 z-10 flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Shift
          </div>
          <div className="w-full space-y-3 z-10">
            <button 
              onClick={handleToggleBreak}
              className={`w-full font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${isOnBreak ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <Coffee size={18} />
              {isOnBreak ? "End Break" : "Take Break"}
            </button>
            <button 
              onClick={handleClockOut}
              className="w-full bg-rose-50 text-rose-600 font-black py-3 rounded-xl hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              Clock Out
            </button>
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-6">
          <div className={`h-full p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden transition-all bg-white flex flex-col justify-center group hover:border-blue-200`}>
            <div className="relative">
              <div className={`w-16 h-16 flex items-center justify-center rounded-2xl mb-8 bg-blue-100 text-blue-600`}>
                <Clock size={32} />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">
                Time Worked
              </p>
              <div className={`text-6xl font-black font-mono tracking-tight text-blue-600`}>
                {formatTime(currentTimer)}
              </div>
            </div>
          </div>

          <div className={`h-full p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden transition-all bg-amber-50 flex flex-col justify-center group hover:border-amber-200`}>
            <div className="relative">
              <div className={`w-16 h-16 flex items-center justify-center rounded-2xl mb-8 bg-amber-100 text-amber-600`}>
                <Coffee size={32} />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">
                Break Time
              </p>
              <div className={`text-6xl font-black font-mono tracking-tight text-amber-600`}>
                {formatTime(currentBreakTimer)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffManagementOwnerView({
  allEmployees,
  setAllEmployees,
}: {
  allEmployees: Employee[];
  setAllEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{name: string, phone: string, pinCode: string, pfp: string}>({ name: '', phone: '', pinCode: '', pfp: '' });

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditForm({ name: emp.name, phone: emp.phone || '', pinCode: emp.pinCode, pfp: emp.pfp });
  };

  const handleSave = (id: string) => {
    const isPinUsed = allEmployees.some(e => e.id !== id && e.pinCode === editForm.pinCode);
    if (isPinUsed) {
      alert("This PIN code is already in use by another staff member. Please enter a unique PIN code.");
      return;
    }
    setAllEmployees(prev => prev.map(e => e.id === id ? { ...e, ...editForm } : e));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setAllEmployees(prev => prev.filter(e => e.id !== id));
  };

  const handleAddEmployee = () => {
    let pinCode = Math.floor(1000 + Math.random() * 9000).toString();
    while (allEmployees.some(e => e.pinCode === pinCode)) {
      pinCode = Math.floor(1000 + Math.random() * 9000).toString();
    }

    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: 'New Staff Member',
      phone: '',
      pfp: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=100',
      pinCode: pinCode,
      shifts: []
    };
    setAllEmployees([...allEmployees, newEmp]);
  };

  return (
    <div className="flex-1 flex flex-col p-10 overflow-auto bg-slate-50/30">
      <div className="max-w-6xl w-full mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Staff Management</h2>
            <p className="text-sm font-bold text-slate-400">Manage your staff directory and pin codes.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleAddEmployee}
              className="bg-white text-blue-600 font-black px-6 py-3 rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
            >
              <Plus size={18} />
              Add Staff Member
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {allEmployees.map(emp => (
            <div key={emp.id} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-6 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start gap-4">
                
                {editingId === emp.id ? (
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</label>
                      <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full font-bold text-slate-900 border-b border-slate-200 outline-none focus:border-blue-500 py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</label>
                      <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full font-bold text-slate-900 border-b border-slate-200 outline-none focus:border-blue-500 py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PIN Code</label>
                      <input type="text" value={editForm.pinCode} onChange={e => setEditForm({...editForm, pinCode: e.target.value})} maxLength={4} className="w-full font-mono font-bold text-slate-900 border-b border-slate-200 outline-none focus:border-blue-500 py-1 tracking-widest" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avatar Picture</label>
                      <input type="file" accept="image/*" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEditForm({...editForm, pfp: reader.result as string});
                          };
                          reader.readAsDataURL(file);
                        }
                      }} className="w-full text-xs font-bold text-slate-500 border-b border-slate-200 outline-none focus:border-blue-500 py-1" />
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setEditingId(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                      <button onClick={() => handleSave(emp.id)} className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Save size={18} /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <img src={emp.pfp} alt={emp.name} className="w-16 h-16 rounded-2xl object-cover shadow-sm bg-slate-100" />
                    <div className="flex-1">
                      <h4 className="text-lg font-black text-slate-900 tracking-tight">{emp.name}</h4>
                      <p className="text-[11px] font-bold text-slate-400 mt-1">{emp.phone || 'No phone'}</p>
                    </div>
                    <div className="bg-slate-100 px-4 py-2 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pin Code</span>
                      <span className="text-lg font-mono font-black text-slate-700 tracking-widest">{emp.pinCode}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleEdit(emp)} className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(emp.id)} className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StaffAnalyticsScheduleView({
  allEmployees,
  exportPDF
}: {
  allEmployees: Employee[];
  exportPDF?: (period: { type: string, startDate: Date, endDate: Date }) => void;
}) {
  const [scheduleView, setScheduleView] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('daily');
  const [selectedPeriod, setSelectedPeriod] = useState<{ startDate: Date, endDate: Date, label: string } | null>(null);
  
  const items = useMemo(() => {
    const list = [];
    if (scheduleView === 'daily') {
      for (let i = 0; i < 1; i++) {
        const start = new Date();
        start.setDate(start.getDate() - i);
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        list.push({ startDate: start, endDate: end, label: start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) });
      }
    } else if (scheduleView === 'weekly') {
      for (let i = 0; i < 7; i++) {
        const start = new Date();
        start.setDate(start.getDate() - i);
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        list.push({ startDate: start, endDate: end, label: start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) });
      }
    } else if (scheduleView === 'monthly') {
      for (let i = 0; i < 30; i++) {
        const start = new Date();
        start.setDate(start.getDate() - i);
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        list.push({ startDate: start, endDate: end, label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) });
      }
    } else if (scheduleView === 'quarterly') {
      for (let i = 0; i < 4; i++) {
        const start = new Date();
        const currentQuarter = Math.floor(start.getMonth() / 3);
        start.setMonth((currentQuarter - i) * 3);
        start.setDate(1);
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 3);
        list.push({ startDate: start, endDate: end, label: `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}` });
      }
    }
    return list.reverse();
  }, [scheduleView]);

  const reportData = useMemo(() => {
    if (!selectedPeriod) return [];
    const data: { name: string, workedMs: number, breakMs: number }[] = [];
    
    allEmployees.forEach(emp => {
      let workedMs = 0;
      let breakMs = 0;
      emp.shifts.forEach(s => {
        const shiftDate = new Date(s.startTime);
        if (shiftDate >= selectedPeriod.startDate && shiftDate < selectedPeriod.endDate) {
          const shiftEnd = s.endTime || Date.now();
          const breaksDuration = s.breaks.reduce((acc, b) => acc + ((b.end || Date.now()) - b.start), 0);
          breakMs += breaksDuration;
          workedMs += (shiftEnd - s.startTime - breaksDuration);
        }
      });
      if (workedMs > 0 || breakMs > 0) {
        data.push({ name: emp.name, workedMs, breakMs });
      }
    });
    return data;
  }, [allEmployees, selectedPeriod]);

  useEffect(() => {
    if (scheduleView === 'daily' && items.length > 0) {
      setSelectedPeriod(items[0]);
    }
  }, [scheduleView, items]);

  return (
    <div className="flex-1 flex flex-col p-10 overflow-auto bg-slate-50/30">
      <div className="max-w-6xl w-full mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Staff Analytics Schedule</h2>
            <p className="text-sm font-bold text-slate-400">Select a period to view detailed shift reports.</p>
          </div>
          <div className="flex flex-wrap items-center bg-slate-200/50 p-1.5 rounded-2xl gap-1">
            <button onClick={() => { setScheduleView('daily'); }} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${scheduleView === 'daily' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Today</button>
            <button onClick={() => { setScheduleView('weekly'); setSelectedPeriod(null); }} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${scheduleView === 'weekly' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Weekly</button>
            <button onClick={() => { setScheduleView('monthly'); setSelectedPeriod(null); }} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${scheduleView === 'monthly' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Monthly</button>
            <button onClick={() => { setScheduleView('quarterly'); setSelectedPeriod(null); }} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${scheduleView === 'quarterly' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Quarterly</button>
          </div>
        </div>
        
        {scheduleView !== 'daily' && (
        <motion.div 
          layout 
          className={`grid gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden shadow-sm
            ${scheduleView === 'daily' ? 'grid-cols-1 max-w-sm' : scheduleView === 'weekly' ? 'grid-cols-3 md:grid-cols-7' : scheduleView === 'monthly' ? 'grid-cols-5 md:grid-cols-10' : 'grid-cols-2 md:grid-cols-4'}
          `}
        >
          <AnimatePresence mode="popLayout">
            {items.map((item, i) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                key={item.label}
                className={`bg-white relative group transition-colors flex flex-col items-center justify-center text-center p-2 md:p-4 ${selectedPeriod?.label === item.label ? 'bg-blue-50 z-10' : 'hover:bg-slate-50'} ${scheduleView === 'daily' ? 'py-12' : 'aspect-square'}`}
              >
                <span className={`text-xs md:text-sm font-bold ${selectedPeriod?.label === item.label ? 'text-blue-700' : 'text-slate-700'}`}>{item.label}</span>
                <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest mt-1 ${selectedPeriod?.label === item.label ? 'text-blue-400' : 'text-slate-400'}`}>{scheduleView}</span>
                
                <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all bg-white/95 backdrop-blur-sm p-2 md:p-3 ${selectedPeriod?.label === item.label ? 'opacity-100 ring-inset ring-2 ring-blue-500 rounded-none' : 'opacity-0 group-hover:opacity-100'}`}>
                  <button 
                    onClick={() => setSelectedPeriod(item)} 
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${selectedPeriod?.label === item.label ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                  >
                     <span className="text-[10px] md:text-xs font-black uppercase tracking-wider">{selectedPeriod?.label === item.label ? 'Viewing' : 'View'}</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        )}

        {selectedPeriod && (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedPeriod.label} Summary</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Shift Spreadsheet</p>
              </div>
              {exportPDF && (
                <button 
                  onClick={() => exportPDF({ type: scheduleView, startDate: selectedPeriod.startDate, endDate: selectedPeriod.endDate })}
                  className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-black px-4 py-2 rounded-xl flex items-center gap-2 text-sm shadow-sm transition-all"
                >
                  <Download size={16} />
                  Export
                </button>
              )}
            </div>
            
            {reportData.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                  <ShieldCheck size={32} />
                </div>
                <h4 className="text-lg font-black text-slate-900">No Shifts Recorded</h4>
                <p className="text-sm font-bold text-slate-400 max-w-sm mt-2">There were no staff shifts during this period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 text-xs font-black text-slate-400 uppercase tracking-widest">Employee Name</th>
                      <th className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 text-xs font-black text-slate-400 uppercase tracking-widest">Time Worked</th>
                      <th className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 text-xs font-black text-slate-400 uppercase tracking-widest">Time on Break</th>
                      <th className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 text-xs font-black text-slate-400 uppercase tracking-widest">Total Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{row.name}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-emerald-600 font-bold bg-emerald-50/30">
                          {formatTime(row.workedMs)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-rose-600 font-bold bg-rose-50/30">
                          {formatTime(row.breakMs)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-slate-700 font-bold">
                          {formatTime(row.workedMs + row.breakMs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShiftRegistryDashboard({ 
  allEmployees,
  setAllEmployees,
  reservations,
  isGlobalAccess,
  clockedInEmployeeIds,
  setClockedInEmployeeIds,
  viewMode
}: ShiftRegistryDashboardProps) {

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);

  const activeEmployees = useMemo(() => allEmployees.filter(e => clockedInEmployeeIds.includes(e.id)), [allEmployees, clockedInEmployeeIds]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = allEmployees.find(e => e.pinCode === pinInput);
    if (emp) {
      setPinError(false);
      
      // Play subtle sound effect
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // Up to A6
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } catch (error) {
        console.warn("Audio not supported or permitted");
      }

      if (!clockedInEmployeeIds.includes(emp.id)) {
        setClockedInEmployeeIds(prev => [...prev, emp.id]);
      }
      
      // Check if they need to start a shift
      const hasActive = emp.shifts.find(s => s.endTime === null);
      if (!hasActive) {
        const newShift: EmployeeShift = {
          id: `shift-${Date.now()}`,
          startTime: Date.now(),
          endTime: null,
          breaks: []
        };
        setAllEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, shifts: [...e.shifts, newShift] } : e));
      }
      setPinInput('');
      setShowPinEntry(false);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const exportPeriodReport = ({ type, startDate, endDate }: { type: string, startDate: Date, endDate: Date }) => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`${type.charAt(0).toUpperCase() + type.slice(1)} Shift Summary Report`, 14, 20);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(12);
    
    doc.text(`Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, 14, 30);
    
    let yOffset = 40;
    
    allEmployees.forEach(emp => {
        const periodShifts = emp.shifts.filter(s => {
          const shiftDate = new Date(s.startTime);
          return shiftDate >= startDate && shiftDate < endDate;
        });
        if (periodShifts.length === 0) return;

        if (yOffset > 270) {
            doc.addPage();
            yOffset = 20;
        }
        doc.setFont("Helvetica", "bold");
        doc.text(`Employee: ${emp.name}`, 14, yOffset);
        yOffset += 8;
        doc.setFont("Helvetica", "normal");

        let totalWorkedMs = 0;
        let totalBreakMs = 0;

        periodShifts.forEach(s => {
          const shiftEnd = s.endTime || Date.now();
          const breaksDuration = s.breaks.reduce((acc, b) => acc + ((b.end || Date.now()) - b.start), 0);
          totalBreakMs += breaksDuration;
          totalWorkedMs += (shiftEnd - s.startTime - breaksDuration);
        });

        doc.text(`Time Worked: ${formatTime(totalWorkedMs)}`, 14, yOffset);
        yOffset += 8;
        doc.text(`Time on Break: ${formatTime(totalBreakMs)}`, 14, yOffset);
        yOffset += 12;
    });

    doc.save(`Shift_${type}_Report_${startDate.toLocaleDateString().replace(/\//g, '-')}.pdf`);
  };

  const exportPDF = () => {
    if (activeEmployees.length === 0) return;
    const targets = activeEmployees;
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Shift Summary Report", 14, 20);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
    
    let yOffset = 40;
    
    targets.forEach(emp => {
        if (yOffset > 270) {
            doc.addPage();
            yOffset = 20;
        }
        doc.setFont("Helvetica", "bold");
        doc.text(`Employee: ${emp.name}`, 14, yOffset);
        yOffset += 8;
        doc.setFont("Helvetica", "normal");
        const activeShift = emp.shifts.find(s => s.endTime === null);
        if (activeShift) {
            doc.text(`Shift Started: ${new Date(activeShift.startTime).toLocaleTimeString()}`, 14, yOffset);
            yOffset += 8;
            
            // Re-calculate time just for PDF output roughly
            const now = Date.now();
            let breaksSum = 0;
            activeShift.breaks.forEach(b => {
                breaksSum += (b.end || now) - b.start;
            });
            const worked = formatTime(now - activeShift.startTime - breaksSum);
            doc.text(`Time Worked: ${worked}`, 14, yOffset);
            yOffset += 12;
        }
    });

    doc.save(`Shift_Summary_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
  };

  if (isGlobalAccess) {
    if (viewMode === 'analytics') {
      return <StaffAnalyticsScheduleView allEmployees={allEmployees} exportPDF={exportPeriodReport} />;
    }
    return <StaffManagementOwnerView allEmployees={allEmployees} setAllEmployees={setAllEmployees} />;
  }

  return (
    <div className="flex-1 flex flex-col p-10 overflow-auto bg-slate-50/30">
      <div className="max-w-6xl w-full mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Shift Registry</h2>
            <p className="text-sm font-bold text-slate-400">Manage employee clock-ins, breaks, and view activity summaries.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {activeEmployees.length > 0 && (
                <button 
                  onClick={() => setShowPinEntry(true)}
                  className="bg-white text-slate-700 font-black px-6 py-3 rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
                >
                  <Plus size={18} />
                  Clock In Staff
                </button>
            )}
            
            {isGlobalAccess && activeEmployees.length > 0 && (
              <button 
                onClick={exportPDF}
                className="bg-emerald-600 text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
              >
                <Download size={18} />
                Export Report
              </button>
            )}
          </div>
        </div>

        {/* PIN ENTRY MODAL/CARD */}
        {(activeEmployees.length === 0 || showPinEntry) && (
          <div className="bg-white border text-center border-slate-200 rounded-[2.5rem] p-16 shadow-sm flex flex-col items-center relative animate-in fade-in slide-in-from-top-4">
            {activeEmployees.length > 0 && (
                <button onClick={() => setShowPinEntry(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                    <StopCircle size={20} />
                </button>
            )}
            <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-8 shadow-inner">
              <KeyRound size={40} />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">Enter Staff Code</h3>
            <p className="text-sm font-bold text-slate-400 mb-8 max-w-sm">
              Please enter your specific employee PIN code to clock in and start your shift.
            </p>
            
            <form onSubmit={handlePinSubmit} className="flex flex-col items-center gap-4 w-full max-w-xs">
              <input 
                type="password" 
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="****"
                className={`w-full text-center text-4xl font-black tracking-[0.5em] py-4 rounded-2xl border-2 outline-none transition-all ${pinError ? 'border-rose-300 bg-rose-50 text-rose-500' : 'border-slate-200 focus:border-blue-500 bg-slate-50'}`}
                maxLength={4}
                autoFocus
              />
              {pinError && <p className="text-xs font-black text-rose-500 uppercase flex items-center gap-1"><ShieldAlert size={14}/> Invalid Code</p>}
              <button 
                type="submit"
                disabled={pinInput.length < 4}
                className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 mt-2"
              >
                CLOCK IN
              </button>
            </form>
          </div>
        )}

        {/* ACTIVE SHIFT CARDS */}
        {activeEmployees.length > 0 && (
            <div className="space-y-8 mt-8">
                {activeEmployees.map(emp => (
                    <StaffShiftCard 
                        key={emp.id} 
                        employee={emp} 
                        allEmployees={allEmployees} 
                        setAllEmployees={setAllEmployees}
                        setClockedInEmployeeIds={setClockedInEmployeeIds}
                    />
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
