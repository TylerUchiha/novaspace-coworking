import React, { useState } from 'react';
import { UserProfile } from '../types';
import { UserAvatar } from './UserAvatar';
import PhoneVerificationForm from './PhoneVerificationForm';
import { normalizePhoneDigits } from '../services/phoneVerification';

interface GooglePhoneRequiredModalProps {
  user: UserProfile;
  onVerified: (profile: UserProfile) => Promise<void>;
  onSignOut: () => Promise<void>;
}

const GooglePhoneRequiredModal: React.FC<GooglePhoneRequiredModalProps> = ({
  user,
  onVerified,
  onSignOut,
}) => {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleVerified = async (_verifiedE164: string, phoneDigits: string) => {
    await onVerified({ ...user, phone: phoneDigits, phoneVerified: true });
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-[2rem] border border-slate-200 shadow-2xl p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <UserAvatar pfp={user.pfp} name={user.name} size="lg" className="mb-4 ring-4 ring-blue-100" />
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            Verify your phone
          </h2>
          <p className="text-slate-500 font-medium text-sm leading-relaxed">
            Hi {user.name.split(' ')[0]}, confirm your phone number with a text message to finish setting up your account.
          </p>
        </div>

        <PhoneVerificationForm
          initialPhone={user.phone ? normalizePhoneDigits(user.phone) : ''}
          submitLabel="Verify & Continue"
          onVerified={handleVerified}
        />

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            {isSigningOut ? 'Signing out...' : 'Sign out and use a different account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GooglePhoneRequiredModal;
