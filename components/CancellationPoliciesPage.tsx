import React, { useState } from 'react';
import { LocationData, Vendor } from '../types';
import { ShieldCheck, HelpCircle, Save, Building, Info, AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';
import { useRemoteConfig } from './RemoteConfigProvider';

interface CancellationPoliciesPageProps {
  locations: LocationData[];
  vendor: Vendor;
  onUpdateLocationMeta: (locId: string, updates: Partial<LocationData>) => void;
  onUpdateVendor: (vendorId: string, updates: Partial<Vendor>) => void;
}

export const CancellationPoliciesPage: React.FC<CancellationPoliciesPageProps> = ({
  locations,
  vendor,
  onUpdateLocationMeta,
  onUpdateVendor,
}) => {
  const { defaultCancellationPolicyText } = useRemoteConfig();
  const [globalPolicy, setGlobalPolicy] = useState(vendor.cancellationPolicy || defaultCancellationPolicyText);
  const [branchPolicies, setBranchPolicies] = useState<Record<string, string>>(
    locations.reduce((acc, loc) => ({ ...acc, [loc.id]: loc.cancellationPolicy || '' }), {})
  );

  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingBranch, setSavingBranch] = useState<Record<string, boolean>>({});
  const [savedSuccessGlobal, setSavedSuccessGlobal] = useState(false);
  const [savedSuccessBranch, setSavedSuccessBranch] = useState<Record<string, boolean>>({});

  const handleSaveGlobal = async () => {
    setSavingGlobal(true);
    setSavedSuccessGlobal(false);
    
    // Simulate minor visual loading for high-quality feel
    await new Promise((resolve) => setTimeout(resolve, 600));
    
    onUpdateVendor(vendor.id, { cancellationPolicy: globalPolicy });
    setSavingGlobal(false);
    setSavedSuccessGlobal(true);
    setTimeout(() => setSavedSuccessGlobal(false), 3000);
  };

  const handleSaveBranch = async (locId: string) => {
    setSavingBranch((prev) => ({ ...prev, [locId]: true }));
    setSavedSuccessBranch((prev) => ({ ...prev, [locId]: false }));

    await new Promise((resolve) => setTimeout(resolve, 600));

    onUpdateLocationMeta(locId, { cancellationPolicy: branchPolicies[locId] });
    setSavingBranch((prev) => ({ ...prev, [locId]: false }));
    setSavedSuccessBranch((prev) => ({ ...prev, [locId]: true }));
    setTimeout(() => {
      setSavedSuccessBranch((prev) => ({ ...prev, [locId]: false }));
    }, 3000);
  };

  return (
    <div className="flex-1 bg-slate-50/40 overflow-y-auto p-10 font-['Inter']">
      <div className="max-w-5xl mx-auto space-y-12 pb-16">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 flex items-center gap-3">
              <ShieldCheck className="text-blue-600 w-10 h-10 shrink-0" strokeWidth={2.5} />
              Cancellation Policies
            </h2>
            <p className="text-slate-500 font-semibold italic text-sm">
              Configure the cancellation rules for the entire brand.
            </p>
          </div>
        </header>

        {/* Global Policy Box */}
        <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-10 space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Building size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Global Brand Policy</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Applies globally to all bookings across all branches.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Global Policy Text
              </label>
              <textarea
                value={globalPolicy}
                onChange={(e) => setGlobalPolicy(e.target.value)}
                placeholder="e.g. Free cancellation up to 24 hours prior to booking. Cancellations within 24 hours are charged 50% of the total amount. No-shows are charged in full."
                rows={4}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-blue-400 focus:bg-white transition-all shadow-sm resize-none text-sm leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleSaveGlobal}
                disabled={savingGlobal}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer"
              >
                <Save size={14} />
                {savingGlobal ? 'Saving...' : 'Save Global Policy'}
              </button>

              {savedSuccessGlobal && (
                <span className="text-emerald-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle size={14} /> Saved successfully!
                </span>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
