import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  PHONE_COUNTRY_OPTIONS,
  buildPhoneDigits,
  parsePhoneNumberParts,
} from '../services/phoneVerification';

export interface PhoneNumberInputChange {
  fullDigits: string;
  countryCode: string;
  nationalNumber: string;
}

interface PhoneNumberInputProps {
  value?: string;
  onChange?: (change: PhoneNumberInputChange) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  compact?: boolean;
  showHint?: boolean;
}

const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  value = '',
  onChange,
  placeholder = '121 188 4876',
  autoFocus = false,
  disabled = false,
  compact = false,
  showHint = true,
}) => {
  const parsed = parsePhoneNumberParts(value);
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [nationalNumber, setNationalNumber] = useState(parsed.nationalNumber);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastEmittedRef = useRef(value);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const next = parsePhoneNumberParts(value);
    setCountryCode(next.countryCode);
    setNationalNumber(next.nationalNumber);
    lastEmittedRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const emitChange = (nextCountryCode: string, nextNationalNumber: string) => {
    const fullDigits = buildPhoneDigits(nextCountryCode, nextNationalNumber);
    lastEmittedRef.current = fullDigits;
    onChange?.({
      fullDigits,
      countryCode: nextCountryCode,
      nationalNumber: nextNationalNumber,
    });
  };

  const handleCountrySelect = (nextCountryCode: string) => {
    setCountryCode(nextCountryCode);
    emitChange(nextCountryCode, nationalNumber);
    setMenuOpen(false);
  };

  const handleNationalChange = (raw: string) => {
    const nextNational = raw.replace(/\D/g, '').slice(0, 12);
    setNationalNumber(nextNational);
    emitChange(countryCode, nextNational);
  };

  const fieldHeight = compact ? 'py-3' : 'py-4';
  const textSize = compact ? 'text-sm' : 'text-base';

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/30 ${disabled ? 'opacity-50' : ''}`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          aria-label={`Country code +${countryCode}`}
          className={`flex shrink-0 items-center gap-1.5 border-r border-slate-200 bg-white px-3 ${fieldHeight} font-black text-slate-900 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed`}
        >
          <span className={`${textSize} tracking-tight`}>+{countryCode}</span>
          <ChevronDown
            size={compact ? 14 : 16}
            className={`text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <input
          type="tel"
          inputMode="numeric"
          value={nationalNumber}
          onChange={(e) => handleNationalChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          required
          className={`min-w-0 flex-1 bg-transparent px-4 ${fieldHeight} font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none ${textSize}`}
        />
      </div>

      {menuOpen && (
        <div
          role="listbox"
          aria-label="Choose country code"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl"
        >
          {PHONE_COUNTRY_OPTIONS.map((option) => {
            const isSelected = option.code === countryCode;
            return (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleCountrySelect(option.code)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-blue-50 font-black text-blue-700'
                    : 'font-bold text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{option.label}</span>
                <span className={isSelected ? 'text-blue-600' : 'text-slate-400'}>
                  +{option.code}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {showHint && (
        <p className="mt-2 text-xs font-medium text-slate-400">
          Default +20 Egypt · tap the code to change country
        </p>
      )}
    </div>
  );
};

export default PhoneNumberInput;
