import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';
import { UserAvatar } from './UserAvatar';
import {
  mapEmailVerificationError,
  sendEmailVerificationCodeRemote,
  verifyEmailCodeRemote,
} from '../services/emailVerification';
import { auth } from '../services/firebase';

interface EmailVerificationModalProps {
  user: UserProfile;
  email?: string | null;
  onVerified: () => Promise<void>;
  onSignOut?: () => Promise<void>;
  onDismiss?: () => void;
}

const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  user,
  email,
  onVerified,
  onSignOut,
  onDismiss,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [sentTo, setSentTo] = useState(email || user.email);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [initialSendDone, setInitialSendDone] = useState(false);

  const applySendError = (err: unknown) => {
    const message = mapEmailVerificationError(err);
    const waitMatch = message.match(/Please wait (\d+) seconds before requesting another code\./);
    if (waitMatch) {
      setResendCooldown(Number(waitMatch[1]));
      setInitialSendDone(true);
      return;
    }
    setError(message);
  };

  const sendCode = useCallback(async () => {
    setError(null);
    setIsSending(true);
    try {
      const result = await sendEmailVerificationCodeRemote();
      if (result.alreadyVerified) {
        await onVerified();
        return;
      }
      if (result.email) {
        setSentTo(result.email);
      }
      setResendCooldown(60);
      setInitialSendDone(true);
    } catch (err) {
      applySendError(err);
    } finally {
      setIsSending(false);
    }
  }, [onVerified]);

  useEffect(() => {
    if (initialSendDone || isSending) return;
    void sendCode();
  }, [initialSendDone, isSending, sendCode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    setIsVerifying(true);
    try {
      await verifyEmailCodeRemote(trimmed);
      await auth.currentUser?.reload();
      await onVerified();
    } catch (err) {
      setError(mapEmailVerificationError(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignOut = async () => {
    if (!onSignOut) return;
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
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Mail size={22} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            Verify your email
          </h2>
          <p className="text-slate-500 font-medium text-sm leading-relaxed">
            {isSending && !initialSendDone ? (
              <>Sending a verification code to your email...</>
            ) : (
              <>
                Hi {user.name.split(' ')[0]}, we sent a 6-digit code to{' '}
                <span className="text-slate-700 font-bold">{sentTo}</span>. Enter it below to continue.
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              placeholder="000000"
              className="mt-2 w-full text-center text-2xl font-black tracking-[0.4em] px-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm font-bold text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isVerifying || code.length !== 6}
            className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isVerifying ? <Loader2 size={18} className="animate-spin" /> : null}
            {isVerifying ? 'Verifying...' : 'Verify email'}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={isSending || resendCooldown > 0}
            className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:text-blue-700 disabled:opacity-50"
          >
            {isSending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors disabled:opacity-50"
            >
              {isSigningOut ? 'Signing out...' : 'Sign out and use a different account'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationModal;
