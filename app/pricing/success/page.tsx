'use client';

import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useTranslation } from 'react-i18next';

export default function PlatformStatusPage() {
  const { t } = useTranslation('common');
  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center py-20">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#C0001E]">Strikers Match</p>
          <h1 className="text-3xl font-black uppercase text-white mb-3" style={{ letterSpacing: '-0.5px' }}>
            {t('pricingSuccess.title')}
          </h1>
          <p className="text-sm text-[#9A9A9A] mb-8 leading-relaxed">
            {t('pricingSuccess.body')}
          </p>

          <div className="space-y-3">
            <Link
              href="/events"
              className="block w-full py-3 text-sm font-bold tracking-widest uppercase text-white transition-colors"
              style={{ background: '#C0001E' }}
            >
              {t('pricingSuccess.events')}
            </Link>
            <Link
              href="/directorio"
              className="block w-full py-3 text-sm font-bold tracking-widest uppercase text-white border border-[#3A3A3A] hover:border-white transition-colors"
            >
              {t('pricingSuccess.directory')}
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
