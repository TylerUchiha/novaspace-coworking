import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Lock, Mail, MessageSquare, Phone, X } from 'lucide-react';
import PhoneNumberInput from './PhoneNumberInput';
import {
  buildPhoneE164FromParts,
  confirmPasswordResetPhoneCode,
  destroyRecaptcha,
  isPhoneRateLimitError,
  isValidNationalPhoneNumber,
  mapPhoneAuthError,
  normalizePhoneDigits,
  sendPasswordResetPhoneSms,
  signOutAfterPasswordReset,
} from '../services/phoneVerification';
import {
  completePhonePasswordResetRemote,
  mapPasswordResetError,
  preparePhonePasswordResetRemote,
  sendEmailPasswordReset,
} from '../services/passwordReset';
import type { ConfirmationResult } from 'firebase/auth';

type ResetMethod = 'email' | 'phone';
type PhoneStep = 'phone' | 'code' | 'password' | 'done';

interface ForgotPasswordModalProps {
  initialEmail?: string;
  phoneFallbackEnabled?: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  initialEmail = '',
  phoneFallbackEnabled = true,
  onClose,
}) => {
  const [method, setMethod] = useState<ResetMethod>('email');
  const [email, setEmail] = useState(initialEmail);
  const [emailSent, setEmailSent] = useState(false);
  const [countryCode, setCountryCode] = useState('20');
  const [nationalNumber, setNationalNumber] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('phone');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    return () => destroyRecaptcha();
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await sendEmailPasswordReset(email);
      setEmailSent(true);
    } catch (err) {
      setError(mapPasswordResetError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhonePrepare = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidNationalPhoneNumber(nationalNumber)) {
      setError('Enter a valid phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const digits = normalizePhoneDigits(phoneDigits);
      const result = await preparePhonePasswordResetRemote(digits);
      setSessionId(result.sessionId);

      const phoneE164 = buildPhoneE164FromParts(countryCode, nationalNumber);
      confirmationRef.current = await sendPasswordResetPhoneSms(phoneE164);
      setPhoneStep('code');
    } catch (err) {
      const phoneE164 = buildPhoneE164FromParts(countryCode, nationalNumber);
      setError(
        isPhoneRateLimitError(err)
          ? mapPhoneAuthError(err, phoneE164)
          : mapPasswordResetError(err),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length < 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    if (!confirmationRef.current) {
      setError('Request a new verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordResetPhoneCode(confirmationRef.current, trimmed);
      setPhoneStep('password');
    } catch (err) {
      setError(mapPhoneAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhonePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!sessionId) {
      setError('Reset session expired. Start again.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completePhonePasswordResetRemote(sessionId, newPassword);
      await signOutAfterPasswordReset();
      setPhoneStep('done');
    } catch (err) {
      setError(mapPasswordResetError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reset Password</h2>
          <p className="text-sm font-medium text-slate-500 mt-2">
            {method === 'email'
              ? 'We will email you a link to choose a new password.'
              : 'Verify the phone number saved on your account.'}
          </p>
        </div>

        {phoneFallbackEnabled && (
          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => { setMethod('email'); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'email' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => { setMethod('phone'); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'phone' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Phone
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-600">
            {error}
          </div>
        )}

        {method === 'email' ? (
          emailSent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                <Mail size={22} />
              </div>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                If an account exists for <span className="font-black text-slate-900">{email}</span>, check your inbox for a reset link.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-4 rounded-2xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 font-bold text-slate-900 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Send Reset Link'}
              </button>
            </form>
          )
        ) : phoneStep === 'done' ? (
          <div className="text-center space-y-4">
            <p className="text-sm font-medium text-slate-600">
              Your password has been updated. Sign in with your new password.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        ) : phoneStep === 'password' ? (
          <form onSubmit={handlePhonePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 font-bold text-slate-900 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 font-bold text-slate-900 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Update Password'}
            </button>
          </form>
        ) : phoneStep === 'code' ? (
          <form onSubmit={handlePhoneCodeSubmit} className="space-y-4">
            <p className="text-xs font-medium text-slate-500 text-center">
              Enter the code sent to your phone.
            </p>
            <div className="relative group">
              <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-blue-400 font-bold text-slate-900 text-sm tracking-[0.4em] text-center"
              />
            </div>
            <button
              type="button"
              onClick={() => { setPhoneStep('phone'); setCode(''); setError(null); }}
              className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600"
            >
              <ArrowLeft size={12} /> Change phone
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Verify Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePhonePrepare} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                <Phone size={12} /> Saved Phone Number
              </label>
              <PhoneNumberInput
                value={phoneDigits}
                onChange={({ fullDigits, countryCode: cc, nationalNumber: nn }) => {
                  setPhoneDigits(fullDigits);
                  setCountryCode(cc);
                  setNationalNumber(nn);
                  setError(null);
                }}
                compact
              />
            </div>
            <p className="text-[10px] font-medium text-slate-400 leading-relaxed">
              Use the phone number on your account if you no longer have access to your email.
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Send Verification Code'}
            </button>
          </form>
        )}

        <p className="mt-6 text-[10px] font-medium text-slate-400 text-center leading-relaxed">
          Staff accounts use branch access codes, not passwords. Contact your manager if you need help.
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
