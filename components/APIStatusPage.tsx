
import React, { useEffect } from 'react';
import { ChevronLeft, Activity, CheckCircle2, AlertCircle, Clock, Server } from 'lucide-react';

interface APIStatusPageProps {
  onBack: () => void;
}

const APIStatusPage: React.FC<APIStatusPageProps> = ({ onBack }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-8 lg:p-16 overflow-y-auto font-['Inter']">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 hover:text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] mb-12 transition-colors group text-slate-400"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Selection
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-emerald-600 p-2 rounded-xl text-white">
              <Activity size={24} />
            </div>
            <h1 className="text-sm font-black text-emerald-600 uppercase tracking-[0.3em]">System Health</h1>
          </div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">
            API <span className="text-emerald-600 italic">Status</span>
          </h2>
          <p className="text-lg text-slate-500 font-medium mt-4">
            Real-time monitoring of our global workspace infrastructure and member services.
          </p>
        </header>

        <div className="grid gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">All Systems Operational</h3>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Last checked: 2 minutes ago</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-emerald-200">
              Operational
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Server size={20} className="text-blue-500" />
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Core Services</h4>
              </div>
              <div className="space-y-4">
                {[
                  { name: 'Identity Auth', status: '99.99%', health: 'Operational' },
                  { name: 'Booking Engine', status: '99.95%', health: 'Operational' },
                  { name: 'Member Portal', status: '99.90%', health: 'Operational' }
                ].map((service) => (
                  <div key={service.name} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600 font-bold">{service.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-400">{service.status}</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Clock size={20} className="text-indigo-500" />
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Global Latency</h4>
              </div>
              <div className="space-y-4">
                {[
                  { name: 'North America', latency: '42ms', health: 'Optimal' },
                  { name: 'Europe', latency: '38ms', health: 'Optimal' },
                  { name: 'Asia Pacific', latency: '112ms', health: 'Good' }
                ].map((region) => (
                  <div key={region.name} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600 font-bold">{region.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-400">{region.latency}</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-20 pt-10 border-t border-slate-200 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">© 2025 NOVASPACE WORLDWIDE ECOSYSTEM</p>
        </footer>
      </div>
    </div>
  );
};

export default APIStatusPage;
