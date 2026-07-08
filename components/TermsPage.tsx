
import React, { useEffect } from 'react';
import { ChevronLeft, FileText, Scale, Gavel, CheckCircle2 } from 'lucide-react';
import { SUPPORT_EMAIL } from '../constants/contact';

interface TermsPageProps {
  onBack: () => void;
}

const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
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
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <FileText size={24} />
            </div>
            <h1 className="text-sm font-black text-indigo-600 uppercase tracking-[0.3em]">Legal</h1>
          </div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">
            Terms of <span className="text-indigo-600 italic">Service</span>
          </h2>
          <p className="text-lg text-slate-500 font-medium mt-4">
            Effective date: July 2025. By using NovaSpace you agree to these terms.
          </p>
        </header>

        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Scale size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Agreement to Terms</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              By accessing or using NovaSpace at novaspace.work, you agree to these Terms of Service and our Privacy Policy. If you do not agree, you may not use the service. These terms are governed by the laws of Egypt.
            </p>
          </section>

          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Gavel size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">User Responsibilities</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              You are responsible for keeping your account credentials secure and for all activity under your account. You agree to provide accurate information, comply with workspace rules at each location, and not misuse the platform for fraud, harassment, or unauthorized access.
            </p>
          </section>

          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Bookings &amp; Cancellations</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed mb-4">
              Bookings are subject to availability and the policies of each workspace provider. Unless a location specifies otherwise, the default cancellation policy applies:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-600 font-medium leading-relaxed">
              <li>Cancellations made more than 24 hours before the booking start time receive a full refund in NovaSpace credits.</li>
              <li>Cancellations within 24 hours are non-refundable and cannot be cancelled online.</li>
              <li>No-shows forfeit the full booking amount.</li>
            </ul>
            <p className="text-slate-600 font-medium leading-relaxed mt-4">
              NovaSpace credits have no cash value unless a separate paid top-up feature is explicitly offered and completed through an approved payment provider.
            </p>
          </section>

          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-4">Contact</h3>
            <p className="text-slate-600 font-medium leading-relaxed">
              Questions about these terms? Email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-600 font-bold hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
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

export default TermsPage;
