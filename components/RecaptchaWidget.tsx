import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { getRecaptchaSiteKey, loadRecaptchaScript } from '../services/recaptcha';

export interface RecaptchaWidgetHandle {
  getToken: () => string | null;
  reset: () => void;
  isEnabled: () => boolean;
}

const RecaptchaWidget = forwardRef<RecaptchaWidgetHandle>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const siteKey = getRecaptchaSiteKey();

  useImperativeHandle(ref, () => ({
    getToken: () => {
      if (!siteKey || widgetIdRef.current === null) {
        return null;
      }
      return window.grecaptcha?.getResponse(widgetIdRef.current) || null;
    },
    reset: () => {
      if (widgetIdRef.current !== null) {
        window.grecaptcha?.reset(widgetIdRef.current);
      }
    },
    isEnabled: () => Boolean(siteKey),
  }));

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return;
    }

    let cancelled = false;

    void loadRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current) {
          return;
        }
        widgetIdRef.current = window.grecaptcha!.render(containerRef.current, {
          sitekey: siteKey,
        });
      })
      .catch((error) => {
        console.error('reCAPTCHA failed to load', error);
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  if (!siteKey) {
    return null;
  }

  return <div ref={containerRef} className="flex justify-center py-1" />;
});

RecaptchaWidget.displayName = 'RecaptchaWidget';

export default RecaptchaWidget;
