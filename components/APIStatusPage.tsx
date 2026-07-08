
import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Activity, CheckCircle2, AlertCircle, Clock, Server, RefreshCw } from 'lucide-react';
import { functionsHealthUrl } from '../services/cloudFunctions';

interface APIStatusPageProps {
  onBack: () => void;
}

interface HealthResponse {
  status: string;
  service?: string;
  timestamp?: string;
  message?: string;
}

const APIStatusPage: React.FC<APIStatusPageProps> = ({ onBack }) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const response = await fetch(functionsHealthUrl, { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);

      if (!response.ok) {
        throw new Error(`Health check returned ${response.status}`);
      }

      const data = (await response.json()) as HealthResponse;
      if (data.status !== 'ok') {
        throw new Error(data.message ?? 'Service reported an error');
      }

      setHealth(data);
      setLastChecked(new Date());
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : 'Health check failed');
      setLastChecked(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    void checkHealth();
  }, [checkHealth]);

  const isOperational = health?.status === 'ok' && !error;

  const formatLastChecked = () => {
    if (!lastChecked) return 'Not checked yet';
    const seconds = Math.round((Date.now() - lastChecked.getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    return lastChecked.toLocaleTimeString();
  };

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
            <div className={`p-2 rounded-xl text-white ${isOperational ? 'bg-emerald-600' : 'bg-amber-500'}`}>
              <Activity size={24} />
            </div>
            <h1 className={`text-sm font-black uppercase tracking-[0.3em] ${isOperational ? 'text-emerald-600' : 'text-amber-600'}`}>
              System Health
            </h1>
          </div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">
            API <span className="text-emerald-600 italic">Status</span>
          </h2>
          <p className="text-lg text-slate-500 font-medium mt-4">
            Live status from the NovaSpace Cloud Functions health endpoint.
          </p>
        </header>

        <div className="grid gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${isOperational ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                {isOperational ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {isLoading ? 'Checking...' : isOperational ? 'All Systems Operational' : 'Service Degraded'}
                </h3>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Last checked: {formatLastChecked()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void checkHealth()}
                disabled={isLoading}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors disabled:opacity-50"
                aria-label="Refresh status"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <div className={`px-4 py-2 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg ${
                isOperational ? 'bg-emerald-500 shadow-emerald-200' : 'bg-amber-500 shadow-amber-200'
              }`}>
                {isLoading ? 'Checking' : isOperational ? 'Operational' : 'Degraded'}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-700 p-6 rounded-2xl font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Server size={20} className="text-blue-500" />
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Core Services</h4>
              </div>
              <div className="space-y-4">
                {[
                  { name: 'Cloud Functions', health: isOperational ? 'Operational' : 'Degraded' },
                  { name: health?.service ?? 'novaspace-functions', health: isOperational ? 'Operational' : 'Unavailable' },
                  { name: 'Health Endpoint', health: latencyMs !== null ? `${latencyMs}ms` : '—' },
                ].map((service) => (
                  <div key={service.name} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600 font-bold">{service.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-400">{service.health}</span>
                      <div className={`w-2 h-2 rounded-full shadow-sm ${isOperational ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Clock size={20} className="text-indigo-500" />
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Endpoint Details</h4>
              </div>
              <div className="space-y-4 text-sm text-slate-600 font-medium">
                <p>
                  <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest block mb-1">URL</span>
                  <span className="break-all">{functionsHealthUrl}</span>
                </p>
                {health?.timestamp && (
                  <p>
                    <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Server Time</span>
                    {new Date(health.timestamp).toLocaleString()}
                  </p>
                )}
                {latencyMs !== null && (
                  <p>
                    <span className="font-black text-slate-400 uppercase text-[10px] tracking-widest block mb-1">Round-trip Latency</span>
                    {latencyMs}ms
                  </p>
                )}
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
