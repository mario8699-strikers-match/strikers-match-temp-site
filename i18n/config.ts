export const i18nConfig = {
  locales: ['es', 'en', 'ru'] as const,
  defaultLocale: 'es' as const,
  localeLabels: {
    es: 'Español',
    en: 'English',
    ru: 'Русский',
  },
  htmlLanguageTags: {
    es: 'es',
    en: 'en',
    ru: 'ru',
  },
};

export type Locale = (typeof i18nConfig.locales)[number];
