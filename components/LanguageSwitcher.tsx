'use client';

import { useTranslation } from 'react-i18next';
import { i18nConfig, type Locale } from '@/i18n/config';
import { authService } from '@/services/authService';

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark';
}

export function LanguageSwitcher({ variant = 'light' }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation('common');
  const currentLocale = (i18n.resolvedLanguage || i18n.language).split('-')[0] as Locale;

  const handleLanguageChange = (locale: Locale) => {
    void i18n.changeLanguage(locale);
    void authService.getSession().then(({ data }) => {
      if (data?.profile?.id) {
        // Browser storage/cookie remains the immediate fallback. Once the
        // international schema is applied, signed-in users also retain this
        // preference across devices; a missing pre-migration column is benign.
        void authService.updateProfile(data.profile.id, { preferred_language: locale });
      }
    });
  };

  const wrapperClass = variant === 'dark'
    ? 'flex items-center border border-[#3A3A3A] overflow-hidden'
    : 'flex items-center border border-zinc-300 overflow-hidden';

  const activeClass = 'bg-[#C0001E] text-white';
  const inactiveClass = variant === 'dark'
    ? 'bg-transparent text-[#9A9A9A] hover:text-white transition-colors'
    : 'bg-white text-zinc-600 hover:bg-zinc-50 transition-colors';

  return (
    <div className={wrapperClass}>
      {i18nConfig.locales.map((locale) => (
        <button
          key={locale}
          onClick={() => handleLanguageChange(locale)}
          className={`flex-1 whitespace-nowrap text-center px-2 py-1 text-xs font-bold tracking-wide ${
            currentLocale === locale ? activeClass : inactiveClass
          }`}
          aria-label={t('common.switchToLanguage', { language: i18nConfig.localeLabels[locale] })}
        >
          {i18nConfig.localeLabels[locale]}
        </button>
      ))}
    </div>
  );
}
