
import React, { useEffect } from 'react';
import { ChevronLeft, Shield, Lock, Eye, ShieldCheck } from 'lucide-react';

interface PrivacyPageProps {
  onBack: () => void;
}

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
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
          Back
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <Shield size={24} />
            </div>
            <h1 className="text-sm font-black text-blue-600 uppercase tracking-[0.3em]">Legal</h1>
          </div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">
            Privacy <span className="text-blue-600 italic">Policy</span>
          </h2>
          <p className="text-lg text-slate-500 font-medium mt-4">
            Your privacy is our priority. Learn how we handle your data at NovaSpace.
          </p>
        </header>

        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Lock size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Data Collection</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              We collect information that you provide directly to us, such as when you create an account, make a booking, or contact support. This may include your name, email address, phone number, and payment information.
            </p>
          </section>

          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <Eye size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">How We Use Data</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              We use the information we collect to provide, maintain, and improve our services, to process your transactions, and to communicate with you about your bookings and account.
            </p>
          </section>

          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Data Security</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              We implement a variety of security measures to maintain the safety of your personal information when you enter, submit, or access your personal information.
            </p>
          </section>
        </div>

        <footer className="mt-20 pt-10 border-t border-slate-200 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">© 2025 NOVASPACE WORLDWIDE ECOSYSTEM</p>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPage;
