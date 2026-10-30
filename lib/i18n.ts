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
import esOnboarding from '@/public/locales/es/onboarding.json';
import esSpectator from '@/public/locales/es/spectator.json';

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
import enOnboarding from '@/public/locales/en/onboarding.json';
import enSpectator from '@/public/locales/en/spectator.json';

import ruCommon from '@/public/locales/ru/common.json';
import ruNavigation from '@/public/locales/ru/navigation.json';
import ruAuth from '@/public/locales/ru/auth.json';
import ruDashboard from '@/public/locales/ru/dashboard.json';
import ruEvents from '@/public/locales/ru/events.json';
import ruAdmin from '@/public/locales/ru/admin.json';
import ruFighters from '@/public/locales/ru/fighters.json';
import ruPromoters from '@/public/locales/ru/promoters.json';
import ruSponsors from '@/public/locales/ru/sponsors.json';
import ruGallery from '@/public/locales/ru/gallery.json';
import ruLegal from '@/public/locales/ru/legal.json';
import ruOnboarding from '@/public/locales/ru/onboarding.json';
import ruSpectator from '@/public/locales/ru/spectator.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    missingKeyHandler: false,
    saveMissing: false,
    debug: false,
    showSupportNotice: false,
    initImmediate: false,
    lng: i18nConfig.defaultLocale,
    fallbackLng: {
      ru: ['en'],
      en: ['es'],
      default: [i18nConfig.defaultLocale],
    },
    supportedLngs: i18nConfig.locales,
    defaultNS: 'common',
    ns: ['common', 'navigation', 'auth', 'dashboard', 'events', 'admin', 'fighters', 'promoters', 'sponsors', 'gallery', 'legal', 'onboarding', 'spectator'],
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
        onboarding: esOnboarding,
        spectator: esSpectator,
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
        onboarding: enOnboarding,
        spectator: enSpectator,
      },
      ru: {
        common: ruCommon,
        navigation: ruNavigation,
        auth: ruAuth,
        dashboard: ruDashboard,
        events: ruEvents,
        admin: ruAdmin,
        fighters: ruFighters,
        promoters: ruPromoters,
        sponsors: ruSponsors,
        gallery: ruGallery,
        legal: ruLegal,
        onboarding: ruOnboarding,
        spectator: ruSpectator,
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
