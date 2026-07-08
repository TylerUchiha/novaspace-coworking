import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, Phone, RefreshCw } from 'lucide-react';
import PhoneNumberInput from './PhoneNumberInput';
import {
  PhoneVerificationSession,
  buildPhoneE164FromParts,
  confirmPhoneVerificationCode,
  destroyRecaptcha,
  isLocalhostPhoneAuthBlocked,
  isValidNationalPhoneNumber,
  mapPhoneAuthError,
  normalizePhoneDigits,
  parsePhoneNumberParts,
  sendPhoneVerificationSms,
} from '../services/phoneVerification';

type Step = 'phone' | 'send' | 'code';

const RESEND_COOLDOWN_SECONDS = 3 * 60;

function formatResendCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function hasValidLockedPhone(phoneDigits: string): boolean {
  const parts = parsePhoneNumberParts(phoneDigits);
  return isValidNationalPhoneNumber(parts.nationalNumber);
}

interface PhoneVerificationFormProps {
  initialPhone?: string;
  /** When true, uses the profile phone and only shows a send-code step plus the SMS code field. */
  lockPhone?: boolean;
  submitLabel?: string;
  onVerified: (verifiedPhoneE164: string, phoneDigits: string) => Promise<void>;
  onCancel?: () => void;
}

const PhoneVerificationForm: React.FC<PhoneVerificationFormProps> = ({
  initialPhone = '',
  lockPhone = false,
  submitLabel = 'Verify & Continue',
  onVerified,
  onCancel,
}) => {
  const phoneLocked = lockPhone && hasValidLockedPhone(initialPhone);
  const lockedParts = useMemo(() => parsePhoneNumberParts(initialPhone), [initialPhone]);

  const [step, setStep] = useState<Step>(() => (phoneLocked ? 'send' : 'phone'));
  const [countryCode, setCountryCode] = useState(lockedParts.countryCode);
  const [nationalNumber, setNationalNumber] = useState(lockedParts.nationalNumber);
  const [phoneDigits, setPhoneDigits] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const sessionRef = useRef<PhoneVerificationSession | null>(null);
  const phoneE164Ref = useRef('');

  useEffect(() => {
    return () => destroyRecaptcha();
  }, []);

  useEffect(() => {
    if (!phoneLocked) {
      const parts = parsePhoneNumberParts(initialPhone);
      setCountryCode(parts.countryCode);
      setNationalNumber(parts.nationalNumber);
      setPhoneDigits(initialPhone);
      return;
    }

    const parts = parsePhoneNumberParts(initialPhone);
    setCountryCode(parts.countryCode);
    setNationalNumber(parts.nationalNumber);
    setPhoneDigits(initialPhone);
    sessionRef.current = null;
    destroyRecaptcha();
    setStep('send');
    setCode('');
    setError(null);
    setResendCooldown(0);
  }, [initialPhone, phoneLocked]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const activeCountryCode = phoneLocked ? lockedParts.countryCode : countryCode;
  const activeNationalNumber = phoneLocked ? lockedParts.nationalNumber : nationalNumber;

  const handlePhoneChange = ({ fullDigits, countryCode: nextCountryCode, nationalNumber: nextNational }: {
    fullDigits: string;
    countryCode: string;
    nationalNumber: string;
  }) => {
    setPhoneDigits(fullDigits);
    setCountryCode(nextCountryCode);
    setNationalNumber(nextNational);
    setError(null);
  };

  const resolvePhoneE164 = () => {
    if (phoneE164Ref.current) return phoneE164Ref.current;
    const phoneE164 = buildPhoneE164FromParts(activeCountryCode, activeNationalNumber);
    phoneE164Ref.current = phoneE164;
    return phoneE164;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidNationalPhoneNumber(activeNationalNumber)) {
      setError('Please enter a valid phone number.');
      return;
    }

    const phoneE164 = buildPhoneE164FromParts(activeCountryCode, activeNationalNumber);
    phoneE164Ref.current = phoneE164;

    setIsSending(true);
    try {
      sessionRef.current = await sendPhoneVerificationSms(phoneE164);
      setStep('code');
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(mapPhoneAuthError(err));
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.replace(/\D/g, '');
    if (trimmedCode.length < 6) {
      setError('Enter the 6-digit code from your SMS.');
      return;
    }

    if (!sessionRef.current) {
      setError('Verification session expired. Request a new code.');
      setStep(phoneLocked ? 'send' : 'phone');
      return;
    }

    setIsConfirming(true);
    try {
      const verifiedE164 = await confirmPhoneVerificationCode(sessionRef.current, trimmedCode);
      const digits = normalizePhoneDigits(verifiedE164 || phoneE164Ref.current);
      await onVerified(verifiedE164 || phoneE164Ref.current, digits);
      sessionRef.current = null;
    } catch (err) {
      setError(mapPhoneAuthError(err));
    } finally {
      setIsConfirming(false);
    }
  };

  const handleChangeNumber = () => {
    if (phoneLocked) {
      onCancel?.();
      return;
    }

    sessionRef.current = null;
    destroyRecaptcha();
    setStep('phone');
    setCode('');
    setError(null);
    setResendCooldown(0);
    phoneE164Ref.current = '';
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isSending) return;

    setError(null);
    setIsSending(true);
    try {
      const phoneE164 = resolvePhoneE164();
      sessionRef.current = await sendPhoneVerificationSms(phoneE164);
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(mapPhoneAuthError(err));
    } finally {
      setIsSending(false);
    }
  };

  const displayPhoneE164 = phoneE164Ref.current || buildPhoneE164FromParts(activeCountryCode, activeNationalNumber);

  return (
    <div className="space-y-5">
      {isLocalhostPhoneAuthBlocked() && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold leading-relaxed">
          Phone SMS does not work on <code className="font-mono">localhost</code>. Use{' '}
          <code className="font-mono">http://127.0.0.1:{window.location.port || '3000'}</code>{' '}
          in your browser instead.
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={handleSendCode} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Phone Number
            </label>
            <PhoneNumberInput
              value={phoneDigits}
              onChange={handlePhoneChange}
              autoFocus
            />
          </div>

          {error && <p className="text-sm font-bold text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={isSending || !nationalNumber.trim()}
            className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-wider text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sending code...
              </>
            ) : (
              <>
                <Phone size={18} />
                Send verification code
              </>
            )}
          </button>
        </form>
      ) : step === 'send' ? (
        <form onSubmit={handleSendCode} className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-slate-500 font-medium">
              We&apos;ll text a verification code to{' '}
              <span className="font-bold text-slate-800">{displayPhoneE164}</span>
            </p>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="mt-1 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Edit phone number in profile
              </button>
            )}
          </div>

          {error && <p className="text-sm font-bold text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={isSending}
            className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-wider text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sending code...
              </>
            ) : (
              <>
                <Phone size={18} />
                Send verification code
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirmCode} className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-slate-500 font-medium">
              Enter the code sent to <span className="font-bold text-slate-800">{displayPhoneE164}</span>
            </p>
            <button
              type="button"
              onClick={handleChangeNumber}
              className="mt-1 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              {phoneLocked ? 'Edit phone number in profile' : 'Change number'}
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Verification Code
            </label>
            <div className="relative">
              <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
                placeholder="000000"
                maxLength={6}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 text-center tracking-[0.3em] text-lg placeholder:text-slate-300 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                autoFocus
                required
              />
            </div>
          </div>

          {error && <p className="text-sm font-bold text-red-600 text-center">{error}</p>}

          <button
            type="button"
            onClick={() => void handleResendCode()}
            disabled={isSending || resendCooldown > 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending new code...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                {resendCooldown > 0
                  ? `Request new code in ${formatResendCooldown(resendCooldown)}`
                  : 'Request new code'}
              </>
            )}
          </button>

          <button
            type="submit"
            disabled={isConfirming || code.length < 6}
            className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-wider text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              submitLabel
            )}
          </button>
        </form>
      )}

      {onCancel && (step === 'phone' || step === 'send') && (
        <div className="text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default PhoneVerificationForm;
