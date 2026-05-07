'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { userService } from '@/services/userService';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabaseClient';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import type { Profile } from '@/types';

const PAGE_SIZE = 12;

type PromoterWithFlyer = Profile & { latestFlyer: string | null; eventCount: number };

export default function PromotersPage() {
  const { t } = useTranslation('promoters');

  const [promoters, setPromoters] = useState<PromoterWithFlyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      const [{ data: profiles }, { data: session }] = await Promise.all([
        userService.listByRole('promoter'),
        authService.getSession(),
      ]);

      setIsLoggedIn(!!session?.profile);

      if (!profiles || profiles.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch latest published event (with flyer) for each promoter in one query
      const { data: events } = await supabase
        .from('events')
        .select('promoter_id, flyer_url')
        .eq('status', 'published')
        .not('flyer_url', 'is', null)
        .order('event_date', { ascending: false });

      // Build a map: promoter_id → first event with flyer
      const flyerMap: Record<string, string> = {};
      const countMap: Record<string, number> = {};
      for (const ev of events ?? []) {
        countMap[ev.promoter_id] = (countMap[ev.promoter_id] ?? 0) + 1;
        if (!flyerMap[ev.promoter_id] && ev.flyer_url) {
          flyerMap[ev.promoter_id] = ev.flyer_url;
        }
      }

      setPromoters(
        profiles.map((p) => ({
          ...p,
          latestFlyer: flyerMap[p.id] ?? null,
          eventCount: countMap[p.id] ?? 0,
        }))
      );
      setLoading(false);
    };

    load();
  }, []);

  const totalPages = Math.ceil(promoters.length / PAGE_SIZE);
  const pagePromoters = useMemo(
    () => promoters.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [promoters, page]
  );

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="promoters" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>Strikers Match</p>
          <h1 className="font-display font-black uppercase leading-none" style={{ fontSize: 'clamp(2.5rem,6vw,4.5rem)', letterSpacing: '-0.02em', color: '#0A0A0A' }}>
            {t('promoters.title')}
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#5A5A5A' }}>{t('promoters.subtitle')}</p>
        </div>

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">{t('promoters.loading')}</div>
        ) : promoters.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-500 text-sm">{t('promoters.empty')}</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pagePromoters.map((promoter) => (
              <div key={promoter.id} className="border border-zinc-200 bg-white overflow-hidden hover:border-zinc-400 transition-colors">

                {/* Flyer image — always publicly visible */}
                {promoter.latestFlyer ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={promoter.latestFlyer}
                    alt={`Flyer de ${promoter.full_name}`}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-zinc-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                {/* Card body */}
                <div className="p-5">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-zinc-200 flex items-center justify-center flex-shrink-0">
                      {promoter.full_name ? (
                        <span className="text-zinc-700 font-bold text-sm">{promoter.full_name.charAt(0).toUpperCase()}</span>
                      ) : (
                        <svg className="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h2 className="font-display font-black uppercase leading-none text-xl" style={{ color: '#0A0A0A' }}>{promoter.full_name || 'Promotor'}</h2>
                      {promoter.city && <p className="text-xs text-zinc-500 mt-0.5">{promoter.city}</p>}
                    </div>
                    {promoter.eventCount > 0 && (
                      <span className="ml-auto text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5">
                        {promoter.eventCount} evento{promoter.eventCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* CTA — locked unless logged in */}
                  {isLoggedIn ? (
                    <a
                      href={`/events?promoter=${promoter.id}`}
                      className="block w-full text-center text-xs font-bold tracking-widest uppercase text-white bg-[#C0001E] hover:bg-[#9A0018] px-4 py-2.5 transition-colors"
                    >
                      {t('promoters.viewEvents')}
                    </a>
                  ) : (
                    <a
                      href="/login"
                      className="flex items-center justify-center gap-1.5 w-full text-center text-xs font-medium text-zinc-400 bg-zinc-50 border border-dashed border-zinc-200 px-4 py-2.5 hover:bg-zinc-100 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Inicia sesión para ver eventos
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} labels={{ prev: t('promoters.previous', { defaultValue: 'Anterior' }), next: t('promoters.next', { defaultValue: 'Siguiente' }) }} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
