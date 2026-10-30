'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const FREE_GROUPS = [
  {
    titleKey: 'events',
    items: [
      'createPublishEvents',
      'editEventInformation',
      'uploadEventPoster',
      'athleteRegistration',
      'manualRegistrationPayments',
    ],
  },
  {
    titleKey: 'matchmaking',
    items: [
      'fightRequests',
      'matchSuggestions',
      'disciplineValidation',
      'compatibilityReview',
      'manualBoutApproval',
    ],
  },
  {
    titleKey: 'operations',
    items: [
      'bouts',
      'ringAssignment',
      'boutOrder',
      'printCenter',
      'eventOperations',
      'results',
    ],
  },
  {
    titleKey: 'dashboards',
    items: [
      'promoterDashboard',
      'managerDashboard',
      'statistics',
      'eventTeam',
      'publicDirectory',
    ],
  },
];

export default function PricingPage() {
  const { t } = useTranslation('common');

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans text-white">
      <Navbar activePage="pricing" />

      <main className="text-center">
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#C0001E]">Strikers Match</p>
          <h1 className="font-display text-5xl font-black uppercase leading-none sm:text-7xl">
            {t('common.pages.pricing.title')}
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-[#B5B5B5]">
            {t('common.pages.pricing.subtitle')}
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <div className="border border-emerald-700/40 bg-emerald-900/10 p-6 sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-emerald-400">{t('common.pages.pricing.available')}</p>
            <h2 className="mb-6 text-2xl font-black uppercase text-white">{t('common.pages.pricing.included')}</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {FREE_GROUPS.map((group) => (
                <div key={group.titleKey} className="border border-emerald-800/30 bg-[#0A0A0A]/40 p-5">
                  <h3 className="mb-4 font-display text-2xl font-black uppercase text-white">{t(`common.pages.pricing.groups.${group.titleKey}.title`)}</h3>
                  <ul className="space-y-2 text-sm text-[#D5D5D5]">
                    {group.items.map((item) => (
                      <li key={item} className="border border-emerald-900/30 px-3 py-2">
                        {t(`common.pages.pricing.groups.${group.titleKey}.${item}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <div className="border border-[#3A3A3A] bg-[#151515] p-6 opacity-45 grayscale sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-[#9A9A9A]">Studio</p>
            <h2 className="font-display text-3xl font-black uppercase text-[#B5B5B5]">{t('common.pages.pricing.comingSoon')}</h2>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-[#9A9A9A]">
              {t('common.pages.pricing.studioDescription')}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/events"
              className="min-h-11 bg-[#C0001E] px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#9A0018]"
            >
              {t('common.pages.pricing.viewEvents')}
            </Link>
            <Link
              href="/directorio"
              className="min-h-11 border border-[#3A3A3A] px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#1A1A1A]"
            >
              {t('common.pages.pricing.viewDirectory')}
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
