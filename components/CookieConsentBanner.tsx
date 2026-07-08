import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { getAnalyticsConsent, setAnalyticsConsent } from '../utils/analyticsConsent';
import { initFirebaseMonitoring } from '../services/firebaseMonitoring';

export const CookieConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getAnalyticsConsent() === null);
  }, []);

  const accept = () => {
    setAnalyticsConsent('accepted');
    void initFirebaseMonitoring();
    setVisible(false);
  };

  const reject = () => {
    setAnalyticsConsent('rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[9999] p-4 sm:p-6"
    >
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Cookie size={20} />
          </div>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            We use cookies and Firebase Analytics to improve NovaSpace. You can accept analytics cookies or
            continue with essential cookies only. See our{' '}
            <Link to="/privacy" className="text-blue-600 font-bold hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={reject}
            className="px-4 py-2.5 rounded-xl text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={accept}
            className="px-4 py-2.5 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
