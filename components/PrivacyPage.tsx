
import React, { useEffect } from 'react';
import { ChevronLeft, Shield, Lock, Eye, ShieldCheck, Cookie, Mail } from 'lucide-react';
import { SUPPORT_EMAIL } from '../constants/contact';

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
            Effective date: July 2025. NovaSpace (&quot;we&quot;, &quot;us&quot;) operates novaspace.work from Egypt.
          </p>
        </header>

        <div className="space-y-8">
          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Lock size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Data We Collect</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed mb-4">
              We collect information you provide when creating an account, making a booking, contacting support, or using workspace services. This may include your name, email address, phone number, booking preferences, and NovaSpace credit balance.
            </p>
            <p className="text-slate-600 font-medium leading-relaxed">
              We also receive technical data such as device type, browser, IP address, and usage events through Firebase (Google) services that power authentication, hosting, databases, analytics, and error monitoring.
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
              We use your information to provide and improve NovaSpace, process bookings and credits, send transactional emails (confirmations, reminders, support replies), prevent fraud, and comply with legal obligations. We do not sell your personal data.
            </p>
          </section>

          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <Cookie size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Cookies &amp; Analytics</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed mb-4">
              Essential cookies and local storage are required for sign-in, session management, and security (including reCAPTCHA and optional App Check).
            </p>
            <p className="text-slate-600 font-medium leading-relaxed">
              With your consent, we use Firebase Analytics and optional Crashlytics to understand how the service is used and to diagnose errors. You can accept or decline analytics cookies via the banner shown on your first visit. Declining limits us to essential cookies only.
            </p>
          </section>

          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Retention, Security &amp; Your Rights</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed mb-4">
              Account and booking data are retained while your account is active and as needed for legal, accounting, or dispute purposes. Data is stored on Google Firebase infrastructure with industry-standard safeguards.
            </p>
            <p className="text-slate-600 font-medium leading-relaxed">
              You may request access, correction, or deletion of your personal data by contacting us. Google Sign-In is subject to Google&apos;s privacy policy in addition to this one.
            </p>
          </section>

          <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Mail size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Contact</h3>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed">
              For privacy questions or data requests, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 font-bold hover:underline">
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

export default PrivacyPage;
