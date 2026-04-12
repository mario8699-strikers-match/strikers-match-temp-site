import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { i18nConfig } from '@/i18n/config';

import esCommon from '@/public/locales/es/common.json';
import esNavigation from '@/public/locales/es/navigation.json';
import esAuth from '@/public/locales/es/auth.json';
import esDashboard from '@/public/locales/es/dashboard.json';
import esEvents from '@/public/locales/es/events.json';
import esAdmin from '@/public/locales/es/admin.json';
import esFighters from '@/public/locales/es/fighters.json';
import esPromoters from '@/public/locales/es/promoters.json';
import esSponsors from '@/public/locales/es/sponsors.json';
import esGallery from '@/public/locales/es/gallery.json';
import esLegal from '@/public/locales/es/legal.json';

import enCommon from '@/public/locales/en/common.json';
import enNavigation from '@/public/locales/en/navigation.json';
import enAuth from '@/public/locales/en/auth.json';
import enDashboard from '@/public/locales/en/dashboard.json';
import enEvents from '@/public/locales/en/events.json';
import enAdmin from '@/public/locales/en/admin.json';
import enFighters from '@/public/locales/en/fighters.json';
import enPromoters from '@/public/locales/en/promoters.json';
import enSponsors from '@/public/locales/en/sponsors.json';
import enGallery from '@/public/locales/en/gallery.json';
import enLegal from '@/public/locales/en/legal.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    missingKeyHandler: false,
    saveMissing: false,
    debug: false,
    // suppress i18next Locize promotional message
    initImmediate: false,
    lng: i18nConfig.defaultLocale,
    fallbackLng: i18nConfig.defaultLocale,
    supportedLngs: i18nConfig.locales,
    defaultNS: 'common',
    ns: ['common', 'navigation', 'auth', 'dashboard', 'events', 'admin', 'fighters', 'promoters', 'sponsors', 'gallery', 'legal'],
    resources: {
      es: {
        common: esCommon,
        navigation: esNavigation,
        auth: esAuth,
        dashboard: esDashboard,
        events: esEvents,
        admin: esAdmin,
        fighters: esFighters,
        promoters: esPromoters,
        sponsors: esSponsors,
        gallery: esGallery,
        legal: esLegal,
      },
      en: {
        common: enCommon,
        navigation: enNavigation,
        auth: enAuth,
        dashboard: enDashboard,
        events: enEvents,
        admin: enAdmin,
        fighters: enFighters,
        promoters: enPromoters,
        sponsors: enSponsors,
        gallery: enGallery,
        legal: enLegal,
      },
    },
    detection: {
      order: ['localStorage', 'cookie', 'htmlTag', 'navigator'],
      caches: ['localStorage', 'cookie'],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
