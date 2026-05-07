'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fighterService } from '@/services/fighterService';
import { manualFighterService } from '@/services/manualFighterService';
import { supabase } from '@/lib/supabaseClient';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import type { FighterWithProfile, ManualFighterWithCreator } from '@/types';

const PAGE_SIZE = 12;

// Unified card entry discriminated by `kind`
type Entry =
  | { kind: 'registered'; data: FighterWithProfile }
  | { kind: 'manual'; data: ManualFighterWithCreator };

export default function FightersPage() {
  const { t } = useTranslation('fighters');

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available'>('all');
  const [page, setPage] = useState(1);

  const loadAll = useCallback(() => {
    setLoading(true);
    const registeredPromise = filter === 'available'
      ? fighterService.getAvailable()
      : fighterService.getAll();

    Promise.all([registeredPromise, manualFighterService.getAllPublic()]).then(
      ([regRes, manualRes]) => {
        const registered: Entry[] = ((regRes.data as FighterWithProfile[]) ?? [])
          .map((f) => ({ kind: 'registered' as const, data: f }));

        let manual: Entry[] = (manualRes.data ?? [])
          .map((m) => ({ kind: 'manual' as const, data: m }));

        if (filter === 'available') {
          manual = manual.filter((e) => e.data.is_available);
        }

        // Interleave by creation date desc — both already sorted desc from backend
        const combined = [...registered, ...manual].sort((a, b) => {
          const da = new Date(a.data.created_at).getTime();
          const db = new Date(b.data.created_at).getTime();
          return db - da;
        });
        setEntries(combined);
        setLoading(false);
      }
    );
  }, [filter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Supabase Realtime: auto-refresh when availability changes
  useEffect(() => {
    const channel = supabase
      .channel('fighters-list-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fighters' },
        (payload) => {
          const old = payload.old as Record<string, unknown>;
          const updated = payload.new as Record<string, unknown>;
          if (
            old.is_available !== updated.is_available ||
            old.short_notice_ready !== updated.short_notice_ready
          ) {
            loadAll();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'manual_fighters' },
        () => loadAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const goTo = (entry: Entry) => {
    if (entry.kind === 'manual') {
      window.location.href = `/fighters/manual/${entry.data.id}`;
    } else {
      window.location.href = `/fighters/${entry.data.id}`;
    }
  };

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const pageEntries = useMemo(
    () => entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [entries, page]
  );

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="fighters" />

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title + filters */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>Strikers Match</p>
            <h1 className="font-display font-black uppercase leading-none" style={{ fontSize: 'clamp(2.5rem,6vw,4.5rem)', letterSpacing: '-0.02em', color: '#0A0A0A' }}>
              {t('fighters.title')}
            </h1>
            <p className="mt-2 text-sm" style={{ color: '#5A5A5A' }}>{t('fighters.subtitle')}</p>
          </div>
          <div className="flex gap-0 border border-zinc-200 overflow-hidden">
            {(['all', 'available'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setLoading(true); setFilter(f); }}
                className={`px-4 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${
                  filter === f
                    ? 'bg-[#0A0A0A] text-white'
                    : 'bg-white text-[#5A5A5A] hover:bg-zinc-50'
                }`}
              >
                {t(`fighters.filter.${f}`)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">{t('fighters.loading')}</div>
        ) : entries.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-500 text-sm">{t('fighters.empty')}</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pageEntries.map((entry) => {
              const isManual = entry.kind === 'manual';
              const name = isManual
                ? entry.data.full_name
                : (entry.data.profiles?.full_name ?? '—');
              const city = isManual
                ? entry.data.city
                : entry.data.profiles?.city;
              const verified = !isManual && entry.data.verified;
              const weightClass = entry.data.weight_class;
              const disciplines = isManual
                ? (entry.data.discipline ? [entry.data.discipline] : [])
                : (entry.data.disciplines ?? []);
              const experience = entry.data.experience_level;
              const wins = entry.data.record_wins ?? 0;
              const losses = entry.data.record_losses ?? 0;
              const draws = entry.data.record_draws ?? 0;
              const isAvailable = isManual
                ? entry.data.is_available
                : entry.data.is_available;

              return (
                <div
                  key={`${entry.kind}-${entry.data.id}`}
                  className="border border-zinc-200 bg-white p-6 hover:border-[#C0001E] transition-colors group cursor-pointer"
                  onClick={() => goTo(entry)}
                >
                  {/* Name + verified/roster badge */}
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div>
                      <h2 className="font-display font-black uppercase leading-none text-2xl group-hover:text-[#C0001E] transition-colors" style={{ color: '#0A0A0A' }}>
                        {name}
                      </h2>
                      <p className="text-xs mt-1" style={{ color: '#9A9A9A' }}>{city ?? '—'}</p>
                    </div>
                    {isManual ? (
                      <span className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5">
                        {t('fighters.roster_badge')}
                      </span>
                    ) : verified && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {t('fighters.verified')}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="bg-zinc-50 py-2">
                      <p className="text-lg font-bold text-zinc-900">{wins}</p>
                      <p className="text-xs text-zinc-500">{t('fighters.wins')}</p>
                    </div>
                    <div className="bg-zinc-50 py-2">
                      <p className="text-lg font-bold text-zinc-900">{losses}</p>
                      <p className="text-xs text-zinc-500">{t('fighters.losses')}</p>
                    </div>
                    <div className="bg-zinc-50 py-2">
                      <p className="text-lg font-bold text-zinc-900">{draws}</p>
                      <p className="text-xs text-zinc-500">{t('fighters.draws')}</p>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-2">
                    {weightClass && (
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1">{weightClass}</span>
                    )}
                    {disciplines.map(d => (
                      <span key={d} className="text-xs font-bold px-2 py-1 uppercase tracking-wide bg-[#0A0A0A] text-white">{d}</span>
                    ))}
                    <span className={`text-xs font-bold px-2 py-1 uppercase tracking-widest ${experience === 'pro' ? 'bg-[#C0001E] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                      {experience === 'pro' ? 'Pro' : 'Amateur'}
                    </span>
                    <span className={`text-xs px-2 py-1 ${isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {isAvailable ? t('fighters.available') : t('fighters.unavailable')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
