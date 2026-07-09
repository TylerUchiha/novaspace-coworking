declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, params: { sitekey: string }) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
      ready: (callback: () => void) => void;
    };
    onRecaptchaLoad?: () => void;
  }
}

let scriptLoadPromise: Promise<void> | null = null;

export function getRecaptchaSiteKey(): string | undefined {
  const key = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
  return key?.trim() || undefined;
}

/** Production builds require a site key — never silently skip login protection. */
export function isRecaptchaMisconfigured(): boolean {
  return Boolean(import.meta.env.PROD) && !getRecaptchaSiteKey();
}

export function isRecaptchaRequired(): boolean {
  if (isRecaptchaMisconfigured()) return true;
  return Boolean(getRecaptchaSiteKey());
}

export function loadRecaptchaScript(): Promise<void> {
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => resolve());
      return;
    }

    window.onRecaptchaLoad = () => {
      window.grecaptcha?.ready(() => resolve());
    };

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}
