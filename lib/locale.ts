import type { Locale } from '@/i18n/config';

const BCP_47_LOCALES: Record<Locale, string> = {
  es: 'es',
  en: 'en',
  ru: 'ru',
};

export function normalizeAppLocale(language?: string | null): Locale {
  const baseLanguage = language?.toLowerCase().split('-')[0];
  if (baseLanguage === 'en' || baseLanguage === 'ru') return baseLanguage;
  return 'es';
}

export function getFormattingLocale(language?: string | null) {
  return BCP_47_LOCALES[normalizeAppLocale(language)];
}

export function formatLocalizedDate(
  value: Date | string,
  language?: string | null,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getFormattingLocale(language), options).format(date);
}

export function formatLocalizedNumber(
  value: number,
  language?: string | null,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(getFormattingLocale(language), options).format(value);
}

export function formatLocalizedCurrency(
  value: number,
  currency: string,
  language?: string | null,
) {
  return formatLocalizedNumber(value, language, {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
}
