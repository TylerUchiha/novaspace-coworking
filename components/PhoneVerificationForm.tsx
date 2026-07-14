import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, Phone, RefreshCw } from 'lucide-react';
import PhoneNumberInput from './PhoneNumberInput';
import {
  buildPhoneDigits,
  buildPhoneE164FromParts,
  isValidNationalPhoneNumber,
  normalizePhoneDigits,
  parsePhoneNumberParts,
} from '../services/phoneVerification';
import {
  sendWhatsAppVerificationCodeRemote,
  verifyWhatsAppCodeRemote,
} from '../services/whatsappVerification';

type Step = 'phone' | 'send' | 'code';

const RESEND_COOLDOWN_SECONDS = 60;

function formatResendCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
}

interface PhoneVerificationFormProps {
  initialPhone?: string;
  /** When true, never show a phone input — only send/code steps using initialPhone. */
  lockPhone?: boolean;
  /**
   * @deprecated Auto-send is disabled — kept for API compatibility. Always treated as false.
   */
  autoSend?: boolean;
  submitLabel?: string;
  onVerified: (verifiedPhoneE164: string, phoneDigits: string) => Promise<void>;
  onCancel?: () => void;
}

const PhoneVerificationForm: React.FC<PhoneVerificationFormProps> = ({
  initialPhone = '',
  lockPhone = false,
  autoSend: _autoSend = false,
  submitLabel = 'Verify & Continue',
  onVerified,
  onCancel,
}) => {
  void _autoSend;

  const lockedParts = useMemo(() => parsePhoneNumberParts(initialPhone), [initialPhone]);
  const normalizedInitialPhone = useMemo(
    () => normalizePhoneDigits(initialPhone),
    [initialPhone],
  );

  const [step, setStep] = useState<Step>(() => (lockPhone ? 'send' : 'phone'));
  const [countryCode, setCountryCode] = useState(lockedParts.countryCode);
  const [nationalNumber, setNationalNumber] = useState(lockedParts.nationalNumber);
  const [phoneDigits, setPhoneDigits] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const phoneDigitsRef = useRef('');
  const prevPhoneRef = useRef(normalizedInitialPhone);
  const sendRequestIdRef = useRef(0);
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    const phoneChanged = prevPhoneRef.current !== normalizedInitialPhone;
    prevPhoneRef.current = normalizedInitialPhone;

    const parts = parsePhoneNumberParts(initialPhone);
    setCountryCode(parts.countryCode);
    setNationalNumber(parts.nationalNumber);
    setPhoneDigits(initialPhone);

    if (phoneChanged) {
      sendRequestIdRef.current += 1;
      sendInFlightRef.current = false;
      setCode('');
      setError(null);
      setResendCooldown(0);
      setIsSending(false);
      phoneDigitsRef.current = '';
    }

    if (lockPhone) {
      setStep('send');
    } else if (phoneChanged) {
      setStep('phone');
    }
  }, [initialPhone, normalizedInitialPhone, lockPhone]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const activeCountryCode = lockPhone ? lockedParts.countryCode : countryCode;
  const activeNationalNumber = lockPhone ? lockedParts.nationalNumber : nationalNumber;
  const sendBlocked = isSending || resendCooldown > 0;

  const resolvePhoneDigits = () => {
    if (phoneDigitsRef.current) return phoneDigitsRef.current;
    const digits = buildPhoneDigits(activeCountryCode, activeNationalNumber);
    phoneDigitsRef.current = digits;
    return digits;
  };

  const handlePhoneChange = ({
    fullDigits,
    countryCode: nextCountryCode,
    nationalNumber: nextNational,
  }: {
    fullDigits: string;
    countryCode: string;
    nationalNumber: string;
  }) => {
    setPhoneDigits(fullDigits);
    setCountryCode(nextCountryCode);
    setNationalNumber(nextNational);
    setError(null);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendInFlightRef.current || isSending || resendCooldown > 0) return;

    setError(null);

    if (!isValidNationalPhoneNumber(activeNationalNumber)) {
      setError('Please enter a valid phone number.');
      return;
    }

    const digits = buildPhoneDigits(activeCountryCode, activeNationalNumber);
    phoneDigitsRef.current = digits;

    const requestId = ++sendRequestIdRef.current;
    sendInFlightRef.current = true;
    setIsSending(true);
    try {
      const result = await sendWhatsAppVerificationCodeRemote(digits);
      if (requestId !== sendRequestIdRef.current) return;
      if (result.alreadyVerified) {
        const e164 = buildPhoneE164FromParts(activeCountryCode, activeNationalNumber);
        await onVerified(e164, digits);
        return;
      }
      setStep('code');
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (requestId !== sendRequestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not send WhatsApp code.');
    } finally {
      if (requestId === sendRequestIdRef.current) {
        sendInFlightRef.current = false;
        setIsSending(false);
      }
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.replace(/\D/g, '');
    if (trimmedCode.length < 6) {
      setError('Enter the 6-digit code from WhatsApp.');
      return;
    }

    const digits = resolvePhoneDigits();
    if (!digits) {
      setError('Phone number missing. Go back and try again.');
      setStep(lockPhone ? 'send' : 'phone');
      return;
    }

    setIsConfirming(true);
    try {
      const verified = await verifyWhatsAppCodeRemote(trimmedCode, digits);
      const e164 =
        verified.phoneE164 ||
        buildPhoneE164FromParts(activeCountryCode, activeNationalNumber);
      await onVerified(e164, verified.phone || digits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleChangeNumber = () => {
    if (lockPhone) {
      onCancel?.();
      return;
    }

    sendRequestIdRef.current += 1;
    sendInFlightRef.current = false;
    setStep('phone');
    setCode('');
    setError(null);
    setResendCooldown(0);
    phoneDigitsRef.current = '';
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isSending || sendInFlightRef.current) return;

    setError(null);
    const requestId = ++sendRequestIdRef.current;
    sendInFlightRef.current = true;
    setIsSending(true);
    try {
      const digits = resolvePhoneDigits();
      await sendWhatsAppVerificationCodeRemote(digits);
      if (requestId !== sendRequestIdRef.current) return;
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (requestId !== sendRequestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not resend WhatsApp code.');
    } finally {
      if (requestId === sendRequestIdRef.current) {
        sendInFlightRef.current = false;
        setIsSending(false);
      }
    }
  };

  const displayPhoneE164 =
    buildPhoneE164FromParts(activeCountryCode, activeNationalNumber) ||
    (phoneDigitsRef.current ? `+${phoneDigitsRef.current}` : '');

  const visibleStep = lockPhone ? (step === 'phone' ? 'send' : step) : step;

  const sendButtonLabel = () => {
    if (isSending) {
      return (
        <>
          <Loader2 size={18} className="animate-spin" />
          Sending on WhatsApp...
        </>
      );
    }
    if (resendCooldown > 0) {
      return (
        <>
          <MessageSquare size={18} />
          Try again in {formatResendCooldown(resendCooldown)}
        </>
      );
    }
    return (
      <>
        <MessageSquare size={18} />
        Send WhatsApp code
      </>
    );
  };

  return (
    <div className="space-y-5">
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold leading-relaxed">
        Codes are sent on <span className="font-black">WhatsApp</span> — make sure this number
        has WhatsApp installed.
      </div>

      {visibleStep === 'phone' ? (
        <form onSubmit={handleSendCode} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Phone Number
            </label>
            <PhoneNumberInput value={phoneDigits} onChange={handlePhoneChange} autoFocus />
          </div>

          {error && <p className="text-sm font-bold text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={sendBlocked || !nationalNumber.trim()}
            className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-wider text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendButtonLabel()}
          </button>
        </form>
      ) : visibleStep === 'send' ? (
        <form onSubmit={handleSendCode} className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-slate-500 font-medium">
              We&apos;ll send a WhatsApp code to{' '}
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
            disabled={sendBlocked}
            className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-wider text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendButtonLabel()}
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirmCode} className="space-y-5">
          <div className="text-center">
            <p className="text-sm text-slate-500 font-medium">
              Enter the 6-digit code we sent on WhatsApp to{' '}
              <span className="font-bold text-slate-800">{displayPhoneE164}</span>
            </p>
            <button
              type="button"
              onClick={handleChangeNumber}
              className="mt-1 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              {lockPhone ? 'Cancel' : 'Change number'}
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-2xl font-black tracking-[0.4em] text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              autoFocus
            />
          </div>

          {error && <p className="text-sm font-bold text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={isConfirming || code.replace(/\D/g, '').length < 6}
            className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-wider text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Phone size={18} />
                {submitLabel}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={sendBlocked}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={16} className={isSending ? 'animate-spin' : ''} />
            {resendCooldown > 0
              ? `Resend in ${formatResendCooldown(resendCooldown)}`
              : 'Resend WhatsApp code'}
          </button>
        </form>
      )}
    </div>
  );
};

export default PhoneVerificationForm;
