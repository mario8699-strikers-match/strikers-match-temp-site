'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import { userService } from '@/services/userService';
import type { Profile } from '@/types';

const PAGE_SIZE = 12;

export default function SponsorsPage() {
  const { t } = useTranslation('sponsors');

  const [sponsors, setSponsors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    userService.listByRole('sponsor').then(({ data }) => {
      setSponsors(data ?? []);
      setLoading(false);
    });
  }, []);

  const totalPages = Math.ceil(sponsors.length / PAGE_SIZE);
  const pageSponsors = useMemo(
    () => sponsors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sponsors, page]
  );

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="sponsors" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>Strikers Match</p>
          <h1 className="font-display font-black uppercase leading-none" style={{ fontSize: 'clamp(2.5rem,6vw,4.5rem)', letterSpacing: '-0.02em', color: '#0A0A0A' }}>
            {t('sponsors.title')}
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#5A5A5A' }}>{t('sponsors.subtitle')}</p>
        </div>

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">{t('sponsors.loading')}</div>
        ) : sponsors.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-900 font-medium">{t('sponsors.empty')}</p>
            <p className="mt-2 text-sm text-zinc-500">{t('sponsors.becomeSponsorSubtitle')}</p>
            <a
              href="/register"
              className="mt-6 inline-block bg-zinc-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              {t('sponsors.becomeSponsor')}
            </a>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pageSponsors.map((sponsor) => (
              <div key={sponsor.id} className="border border-zinc-200 bg-white p-6 hover:border-zinc-400 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-lg flex-shrink-0">
                    {sponsor.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-display font-black uppercase leading-none text-xl" style={{ color: '#0A0A0A' }}>{sponsor.full_name}</h2>
                    {sponsor.city && (
                      <p className="text-xs text-zinc-500 mt-0.5">{sponsor.city}</p>
                    )}
                  </div>
                </div>

                {sponsor.phone && (
                  <p className="text-xs text-zinc-500 mb-4">{sponsor.phone}</p>
                )}

                <a
                  href={`/register`}
                  className="block w-full text-center text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-4 py-2 transition-colors"
                >
                  {t('sponsors.contact')}
                </a>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
