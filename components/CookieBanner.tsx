'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const COOKIE_CONSENT_KEY = 'sm_cookie_consent';

/**
 * Tracks whether the user has accepted cookies.
 * Stores consent timestamp in localStorage.
 */
export function getCookieConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(COOKIE_CONSENT_KEY);
}

export function setCookieConsent(): void {
  localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
}

export function CookieBanner() {
  const { t } = useTranslation('legal');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if consent has not been given yet
    if (!getCookieConsent()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    setCookieConsent();
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-700 px-4 py-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white mb-1">
            {t('legal.cookies.bannerTitle')}
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {t('legal.cookies.bannerText')}{' '}
            <a
              href="/privacy-policy"
              className="underline text-zinc-300 hover:text-white transition-colors"
            >
              {t('legal.cookies.learnMore')}
            </a>
          </p>
        </div>
        <button
          onClick={handleAccept}
          className="flex-shrink-0 px-5 py-2 bg-white text-zinc-900 text-sm font-semibold hover:bg-zinc-100 transition-colors"
        >
          {t('legal.cookies.accept')}
        </button>
      </div>
    </div>
  );
}
