'use client';

import { useTranslation } from 'react-i18next';
import { i18nConfig, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark';
}

export function LanguageSwitcher({ variant = 'light' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const currentLocale = i18n.language as Locale;

  const handleLanguageChange = (locale: Locale) => {
    i18n.changeLanguage(locale);
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
          className={`flex-1 text-center px-3 py-1 text-xs font-bold tracking-widest ${
            currentLocale === locale ? activeClass : inactiveClass
          }`}
          aria-label={`Switch to ${i18nConfig.localeLabels[locale]}`}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
