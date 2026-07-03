import React, { useEffect, useRef, useState } from 'react';
import { Clock, LogOut } from 'lucide-react';

const formatShiftTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

interface ShiftTimerWidgetProps {
  isActive: boolean;
  onEndShift: () => void;
}

const ShiftTimerWidget: React.FC<ShiftTimerWidgetProps> = ({ isActive, onEndShift }) => {
  const [elapsed, setElapsed] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      startRef.current = null;
      setElapsed(0);
      setIsOpen(false);
      return;
    }
    startRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      if (startRef.current) {
        setElapsed(Date.now() - startRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-2xl cursor-pointer hover:bg-blue-100 transition-colors"
      >
        <Clock size={14} className="text-blue-600" />
        <span className="text-xs font-black text-blue-700 font-mono">
          {formatShiftTime(elapsed)}
        </span>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-48 animate-in fade-in zoom-in-95 overflow-hidden">
            <button
              onClick={() => {
                onEndShift();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-rose-50 text-rose-600 font-black text-xs transition-colors flex items-center gap-2"
            >
              <LogOut size={14} /> End Work Day
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftTimerWidget;
