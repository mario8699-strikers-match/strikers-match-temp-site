'use client';

import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export default function TermsPage() {
  const { t } = useTranslation('legal');

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-xs font-bold tracking-[0.25em] uppercase mb-4" style={{ color: '#C0001E' }}>
          Strikers Match
        </p>
        <h1 className="text-3xl font-extrabold text-zinc-900 mb-2">
          {t('legal.terms.title')}
        </h1>
        <p className="text-sm text-zinc-400 mb-10">
          {t('legal.lastUpdated')}: March 2026
        </p>

        <p className="text-sm text-zinc-700 leading-relaxed mb-8">
          {t('legal.terms.intro')}
        </p>

        {SECTIONS.map((n) => {
          const hasSubs = n === 3;
          return (
            <section key={n} className="mb-8">
              <h2 className="text-base font-bold text-zinc-900 mb-2">
                {t(`legal.terms.section${n}Title`)}
              </h2>
              <p className={`text-sm text-zinc-700 leading-relaxed ${hasSubs ? 'mb-4' : ''}`}>
                {t(`legal.terms.section${n}Text`)}
              </p>
              {hasSubs && (
                <ul className="list-disc pl-5 space-y-3 text-sm text-zinc-700 leading-relaxed">
                  <li>{t('legal.terms.section3Sub1')}</li>
                  <li>{t('legal.terms.section3Sub2')}</li>
                  <li>{t('legal.terms.section3Sub3')}</li>
                  <li>{t('legal.terms.section3Sub4')}</li>
                </ul>
              )}
            </section>
          );
        })}
      </main>

      <Footer />
    </div>
  );
}
