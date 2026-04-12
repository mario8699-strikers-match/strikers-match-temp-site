'use client';

import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export default function PrivacyPolicyPage() {
  const { t } = useTranslation('legal');

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-xs font-bold tracking-[0.25em] uppercase mb-4" style={{ color: '#C0001E' }}>
          Strikers Match
        </p>
        <h1 className="text-3xl font-extrabold text-zinc-900 mb-2">
          {t('legal.privacy.title')}
        </h1>
        <p className="text-sm text-zinc-400 mb-10">
          {t('legal.lastUpdated')}: March 2026
        </p>

        <p className="text-sm text-zinc-700 leading-relaxed mb-8">
          {t('legal.privacy.intro')}
        </p>

        {SECTIONS.map((n) => (
          <section key={n} className="mb-8">
            <h2 className="text-base font-bold text-zinc-900 mb-2">
              {t(`legal.privacy.section${n}Title`)}
            </h2>
            <p className="text-sm text-zinc-700 leading-relaxed">
              {t(`legal.privacy.section${n}Text`)}
            </p>
          </section>
        ))}
      </main>

      <Footer />
    </div>
  );
}
