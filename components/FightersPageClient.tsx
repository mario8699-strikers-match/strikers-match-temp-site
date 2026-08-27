'use client';

import { useEffect, useState, useCallback, useMemo, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { fighterService } from '@/services/fighterService';
import { fighterFollowService } from '@/services/fighterFollowService';
import { manualFighterService } from '@/services/manualFighterService';
import { supabase } from '@/lib/supabaseClient';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import { RecordValue } from '@/components/CombatRecord';
import type { FighterWithProfile, ManualFighterWithCreator } from '@/types';

const PAGE_SIZE = 12;

// Unified card entry discriminated by `kind`
export type FighterDirectoryEntry =
  | { kind: 'registered'; data: FighterWithProfile }
  | { kind: 'manual'; data: ManualFighterWithCreator };

interface FightersPageClientProps {
  initialEntries: FighterDirectoryEntry[];
}

export function FightersPageClient({ initialEntries }: FightersPageClientProps) {
  const { t } = useTranslation('fighters');
  const router = useRouter();

  const [entries, setEntries] = useState<FighterDirectoryEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'available'>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});

  const loadAll = useCallback(async () => {
    const registeredPromise = filter === 'available'
      ? fighterService.getAvailable()
      : fighterService.getAll();

    try {
      const [regRes, manualRes] = await Promise.all([registeredPromise, manualFighterService.getAllPublic()]);
      const registered: FighterDirectoryEntry[] = ((regRes.data as FighterWithProfile[]) ?? [])
        .map((f) => ({ kind: 'registered' as const, data: f }));

      let manual: FighterDirectoryEntry[] = (manualRes.data ?? [])
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
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadAll();
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
            void loadAll();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'manual_fighters' },
        () => {
          void loadAll();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const goTo = (entry: FighterDirectoryEntry) => {
    if (entry.kind === 'manual') {
      router.push(`/fighters/manual/${entry.data.id}`);
    } else {
      router.push(`/fighters/${entry.data.id}`);
    }
  };

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;

    return entries.filter((entry) => {
      const isManual = entry.kind === 'manual';
      const name = isManual ? entry.data.full_name : (entry.data.profiles?.full_name ?? '');
      const city = isManual ? (entry.data.city ?? '') : (entry.data.profiles?.city ?? '');
      const weightClass = entry.data.weight_class ?? '';
      const gym = entry.data.gym_name ?? '';
      const disciplines = isManual
        ? (entry.data.discipline ? [entry.data.discipline] : [])
        : (entry.data.disciplines ?? []);
      return [name, city, weightClass, gym, ...disciplines]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [entries, searchQuery]);

  const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  const pageEntries = useMemo(
    () => filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredEntries, page]
  );
  const pageRegisteredFighterIds = useMemo(
    () => pageEntries
      .filter((entry): entry is { kind: 'registered'; data: FighterWithProfile } => entry.kind === 'registered')
      .map((entry) => entry.data.id),
    [pageEntries]
  );
  const pageRegisteredFighterIdsKey = pageRegisteredFighterIds.join(',');

  useEffect(() => {
    if (!pageRegisteredFighterIdsKey) return;
    let cancelled = false;

    fighterFollowService.getFollowerCounts(pageRegisteredFighterIds).then(({ data }) => {
      if (!cancelled && data) {
        setFollowerCounts((current) => ({ ...current, ...data }));
      }
    });

    return () => { cancelled = true; };
  }, [pageRegisteredFighterIds, pageRegisteredFighterIdsKey]);

  const runSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchDraft);
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="fighters" />

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Title + filters */}
        <div className="flex flex-col gap-6 mb-10">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>Strikers Match</p>
            <h1 className="font-display font-black uppercase leading-none" style={{ fontSize: 'clamp(2.5rem,6vw,4.5rem)', letterSpacing: '-0.02em', color: '#0A0A0A' }}>
              {t('fighters.title')}
            </h1>
            <p className="mt-2 text-sm" style={{ color: '#5A5A5A' }}>{t('fighters.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <form onSubmit={runSearch} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-700">{t('fighters.search.label')}</span>
                <input
                  type="search"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder={t('fighters.search.placeholder')}
                  className="min-h-12 w-full border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                />
              </label>
              <button type="submit" className="min-h-12 border border-zinc-900 bg-zinc-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-white sm:self-end">
                {t('fighters.search.button')}
              </button>
            </form>

            <div className="flex gap-0 overflow-hidden border border-zinc-200">
              {(['all', 'available'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    if (filter === f) return;
                    setPage(1);
                    setLoading(true);
                    setFilter(f);
                  }}
                  className={`min-h-12 px-4 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${
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
        </div>

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">{t('fighters.loading')}</div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-500 text-sm">{searchQuery ? t('fighters.search.empty') : t('fighters.empty')}</p>
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
              const age = isManual ? null : getAge(entry.data.profiles?.date_of_birth);
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
              const followers = isManual ? null : (followerCounts[entry.data.id] ?? 0);
              const photoUrl = entry.data.photo_url;
              const initials = getInitials(name);

              return (
                <div
                  key={`${entry.kind}-${entry.data.id}`}
                  className="border border-zinc-200 bg-white hover:border-[#C0001E] transition-colors group cursor-pointer overflow-hidden"
                  onClick={() => goTo(entry)}
                >
                  <div className="aspect-[4/3] w-full bg-zinc-100">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-100">
                        <span className="text-4xl font-black uppercase text-zinc-400">{initials}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
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
                      <p className="text-lg font-bold"><RecordValue part="wins" value={wins} /></p>
                      <p className="text-xs text-zinc-500">{t('fighters.wins')}</p>
                    </div>
                    <div className="bg-zinc-50 py-2">
                      <p className="text-lg font-bold"><RecordValue part="losses" value={losses} /></p>
                      <p className="text-xs text-zinc-500">{t('fighters.losses')}</p>
                    </div>
                    <div className="bg-zinc-50 py-2">
                      <p className="text-lg font-bold"><RecordValue part="draws" value={draws} /></p>
                      <p className="text-xs text-zinc-500">{t('fighters.draws')}</p>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-2">
                    {age !== null && (
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1">
                        {t('fighters.age')}: {age}
                      </span>
                    )}
                    {weightClass && (
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1">{weightClass}</span>
                    )}
                    {followers !== null && (
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1">
                        {followers} {followers === 1 ? t('fighters.follower') : t('fighters.followers')}
                      </span>
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

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SM';
}

function getAge(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
