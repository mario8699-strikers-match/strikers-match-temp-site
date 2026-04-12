export const i18nConfig = {
  locales: ['es', 'en'] as const,
  defaultLocale: 'es' as const,
  localeLabels: {
    es: 'Español',
    en: 'English',
  },
};

export type Locale = (typeof i18nConfig.locales)[number];
