'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { i18nConfig, type Locale } from '@/i18n/config';

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    const updateDocumentLanguage = (language: string) => {
      const locale = language.split('-')[0] as Locale;
      document.documentElement.lang = i18nConfig.htmlLanguageTags[locale]
        ?? i18nConfig.defaultLocale;
    };

    updateDocumentLanguage(i18n.resolvedLanguage || i18n.language);
    i18n.on('languageChanged', updateDocumentLanguage);
    return () => {
      i18n.off('languageChanged', updateDocumentLanguage);
    };
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
