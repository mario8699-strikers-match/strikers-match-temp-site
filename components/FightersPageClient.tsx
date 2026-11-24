'use client';

import Image from 'next/image';
import { Fragment, useEffect, useState, useCallback, useMemo, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import {
  GiBelt,
  GiBlackBelt,
  GiBootKick,
  GiBoxingGlove,
  GiConfrontation,
  GiFist,
  GiGloves,
  GiHighKick,
  GiHighPunch,
  GiKimono,
  GiLeg,
  GiPunch,
  GiPunchBlast,
  GiPunchingBag,
} from 'react-icons/gi';
import { MdSportsMartialArts, MdSportsMma } from 'react-icons/md';
import { TbKarate } from 'react-icons/tb';
import { fighterService } from '@/services/fighterService';
import { fighterFollowService } from '@/services/fighterFollowService';
import { manualFighterService } from '@/services/manualFighterService';
import { supabase } from '@/lib/supabaseClient';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import { RecordValue } from '@/components/CombatRecord';
import {
  DISCIPLINE_OPTIONS,
  disciplineI18nKey,
  disciplineMatches,
  normalizeDisciplineList,
  sortDisciplines,
} from '@/lib/disciplines';
import type { FighterWithProfile, ManualFighterWithCreator } from '@/types';
import { countryFlagEmoji, getCountryName } from '@/lib/countries';
import { fighterPublicPath, manualFighterPublicPath } from '@/lib/publicUrls';
import { fighterWeightClassI18nKey } from '@/lib/fighterDisplay';

const PAGE_SIZE = 12;

// Unified card entry discriminated by `kind`
export type FighterDirectoryEntry =
  | { kind: 'registered'; data: FighterWithProfile }
  | { kind: 'manual'; data: ManualFighterWithCreator };

interface FightersPageClientProps {
  initialEntries: FighterDirectoryEntry[];
}

export function FightersPageClient({ initialEntries }: FightersPageClientProps) {
  const { t, i18n } = useTranslation(['fighters', 'events']);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<FighterDirectoryEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'available'>('all');
  const [competitionLevel, setCompetitionLevel] = useState<'pro' | 'amateur' | 'all'>('pro');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const selectedDisciplines = useMemo(
    () => normalizeDisciplineList(searchParams.getAll('discipline')),
    [searchParams]
  );
  const selectedCountry = searchParams.get('country')?.toUpperCase() ?? '';

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
      router.push(manualFighterPublicPath(entry.data));
    } else {
      router.push(fighterPublicPath(entry.data));
    }
  };

  const disciplineOptions = useMemo(() => sortDisciplines([
    ...DISCIPLINE_OPTIONS,
    ...entries.flatMap(entryDisciplines),
  ]), [entries]);

  const countryOptions = useMemo(() => [...new Set(entries
    .map(entryCountryCode)
    .filter((code): code is string => Boolean(code)))]
    .sort((a, b) => getCountryName(a, i18n.resolvedLanguage).localeCompare(
      getCountryName(b, i18n.resolvedLanguage),
      i18n.resolvedLanguage,
      { sensitivity: 'base' },
    )), [entries, i18n.resolvedLanguage]);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      const disciplines = entryDisciplines(entry);
      const experienceLevel = entry.data.experience_level ?? 'amateur';
      if (competitionLevel === 'pro' && experienceLevel !== 'pro') return false;
      if (competitionLevel === 'amateur' && experienceLevel === 'pro') return false;
      if (selectedDisciplines.length > 0
        && !selectedDisciplines.some((discipline) => disciplineMatches(disciplines, discipline))) {
        return false;
      }
      if (selectedCountry && entryCountryCode(entry) !== selectedCountry) return false;
      if (!query) return true;

      const isManual = entry.kind === 'manual';
      const name = isManual ? entry.data.full_name : (entry.data.profiles?.full_name ?? '');
      const city = isManual ? (entry.data.city ?? '') : (entry.data.profiles?.city ?? '');
      const weightClass = entry.data.weight_class ?? '';
      const gym = entry.data.gym_name ?? '';
      return [name, city, weightClass, gym, ...disciplines]
        .some((value) => value.toLowerCase().includes(query));
    }).sort((entryA, entryB) => {
      const rankComparison = entryDirectoryRank(entryA) - entryDirectoryRank(entryB);
      if (rankComparison !== 0) return rankComparison;
      const countryA = getCountryName(entryCountryCode(entryA), i18n.resolvedLanguage)
        || t('fighters.countryFilter.unspecified');
      const countryB = getCountryName(entryCountryCode(entryB), i18n.resolvedLanguage)
        || t('fighters.countryFilter.unspecified');
      const countryComparison = countryA.localeCompare(countryB, i18n.resolvedLanguage, { sensitivity: 'base' });
      if (countryComparison !== 0) return countryComparison;
      return entryName(entryA).localeCompare(entryName(entryB), i18n.resolvedLanguage, { sensitivity: 'base' });
    });
  }, [competitionLevel, entries, i18n.resolvedLanguage, searchQuery, selectedCountry, selectedDisciplines, t]);

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

  const updateDisciplineFilters = (nextDisciplines: string[]) => {
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('discipline');
    for (const discipline of normalizeDisciplineList(nextDisciplines)) {
      params.append('discipline', discipline);
    }
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  const updateCountryFilter = (countryCode: string) => {
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (countryCode) params.set('country', countryCode);
    else params.delete('country');
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="fighters" />

      <main className="flex-1">
        <section className="relative isolate overflow-hidden bg-zinc-950 text-white">
          <Image
            src="/images/fighters-directory-hero.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[72%_center] sm:object-center"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.98)_0%,rgba(0,0,0,0.86)_45%,rgba(0,0,0,0.26)_78%,rgba(0,0,0,0.18)_100%)]" />
          <div className="mx-auto flex min-h-[500px] max-w-7xl flex-col justify-end px-4 pb-8 pt-20 sm:px-6 sm:pb-10 lg:min-h-[560px] lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-black uppercase tracking-[0.28em] text-[#F01835]">Strikers Match</p>
              <h1 className="font-display text-[clamp(3.5rem,9vw,7.5rem)] font-black uppercase leading-[0.78] tracking-[-0.035em]">
                {t('fighters.title')}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">{t('fighters.subtitle')}</p>
            </div>

            <form onSubmit={runSearch} className="mt-8 flex max-w-4xl flex-col gap-2 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">{t('fighters.search.label')}</span>
                <SearchIcon />
                <input
                  type="search"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder={t('fighters.search.placeholder')}
                  className="min-h-14 w-full border border-white/15 bg-zinc-900/90 py-4 pl-12 pr-4 text-base text-white outline-none backdrop-blur placeholder:text-zinc-400 focus:border-[#F01835]"
                />
              </label>
              <button type="submit" className="min-h-14 bg-[#C0001E] px-8 py-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#E00025] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {t('fighters.search.button')}
              </button>
            </form>
          </div>
        </section>

        <section className="bg-zinc-950 text-white">
          <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 border border-white/10 sm:max-w-md">
              {(['all', 'available'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => {
                    if (filter === f) return;
                    setPage(1);
                    setLoading(true);
                    setFilter(f);
                  }}
                  className={`min-h-14 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition-colors ${filter === f
                    ? 'bg-[#C0001E] text-white'
                    : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}
                >
                  {t(`fighters.filter.${f}`)}
                </button>
              ))}
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(220px,0.32fr)_minmax(0,0.68fr)]">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{t('fighters.countryFilter.label')}</span>
                  <select
                    value={selectedCountry}
                    onChange={(event) => updateCountryFilter(event.target.value)}
                    className="min-h-12 w-full border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-[#C0001E]"
                  >
                    <option value="">{t('fighters.countryFilter.all')}</option>
                    {countryOptions.map((code) => (
                      <option key={code} value={code}>{countryFlagEmoji(code)} {getCountryName(code, i18n.resolvedLanguage)}</option>
                    ))}
                  </select>
                </label>

                <fieldset>
                  <legend className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{t('fighters.levelFilter.label')}</legend>
                  <div className="grid grid-cols-3">
                    {(['pro', 'amateur', 'all'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={competitionLevel === level}
                        onClick={() => { setCompetitionLevel(level); setPage(1); }}
                        className={`min-h-12 border px-2 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${competitionLevel === level
                          ? 'border-[#C0001E] bg-[#C0001E] text-white'
                          : 'border-white/15 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:text-white'}`}
                      >
                        {t(`fighters.levelFilter.${level}`)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <fieldset>
                <legend className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{t('fighters.disciplineFilter.label')}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  <button
                    type="button"
                    aria-pressed={selectedDisciplines.length === 0}
                    onClick={() => updateDisciplineFilters([])}
                    className={`group flex min-h-16 items-center gap-3 border px-3 py-3 text-left text-sm font-bold uppercase tracking-wide transition-all ${selectedDisciplines.length === 0
                      ? 'border-[#C0001E] bg-[#C0001E] text-white shadow-[0_8px_24px_rgba(192,0,30,0.28)]'
                      : 'border-white/10 bg-zinc-900 text-zinc-200 hover:-translate-y-0.5 hover:border-[#C0001E] hover:bg-zinc-800'}`}
                  >
                    <DisciplineMark discipline="all" />
                    <span>{t('fighters.disciplineFilter.all')}</span>
                  </button>
                  {disciplineOptions.map((discipline) => {
                    const selected = selectedDisciplines.some((item) => item.toLocaleLowerCase() === discipline.toLocaleLowerCase());
                    const translationKey = disciplineI18nKey(discipline);
                    return (
                      <button
                        key={discipline}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => updateDisciplineFilters(selected
                          ? selectedDisciplines.filter((item) => item.toLocaleLowerCase() !== discipline.toLocaleLowerCase())
                          : [...selectedDisciplines, discipline])}
                        className={`group flex min-h-16 items-center gap-3 border px-3 py-3 text-left text-sm font-bold uppercase tracking-wide transition-all ${selected
                          ? 'border-[#C0001E] bg-[#C0001E] text-white shadow-[0_8px_24px_rgba(192,0,30,0.28)]'
                          : 'border-white/10 bg-zinc-900 text-zinc-200 hover:-translate-y-0.5 hover:border-[#C0001E] hover:bg-zinc-800'}`}
                      >
                        <DisciplineMark discipline={discipline} />
                        <span>{translationKey ? t(`fighters.disciplines.${translationKey}`, { defaultValue: discipline }) : discipline}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">{t('fighters.disciplineFilter.help')}</p>
              </fieldset>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">{t('fighters.loading')}</div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-500 text-sm">{searchQuery ? t('fighters.search.empty') : t('fighters.empty')}</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pageEntries.map((entry, index) => {
              const isManual = entry.kind === 'manual';
              const name = isManual
                ? entry.data.full_name
                : (entry.data.profiles?.full_name ?? '—');
              const city = isManual
                ? entry.data.city
                : entry.data.profiles?.city;
              const age = entry.data.age ?? null;
              const verified = !isManual && entry.data.verified;
              const weightClass = entry.data.weight_class;
              const disciplines = entryDisciplines(entry);
              const experience = entry.data.experience_level;
              const wins = entry.data.record_wins ?? 0;
              const losses = entry.data.record_losses ?? 0;
              const draws = entry.data.record_draws ?? 0;
              const isAvailable = isManual
                ? entry.data.is_available
                : entry.data.is_available;
              const followers = isManual ? null : (followerCounts[entry.data.id] ?? 0);
              const photoUrl = entry.data.photo_url;
              const exactWeight = entry.data.exact_weight;
              const heightCm = entry.data.height_cm;
              const willingToTravel = entry.data.available_to_travel_internationally === true;
              const koTkoWins = (entry.data.ko_wins ?? 0) + (entry.data.tko_wins ?? 0);
              const skillRating = entry.data.skill_rating;
              const weightClassKey = fighterWeightClassI18nKey(weightClass);
              const rulesets = entry.data.preferred_rulesets ?? [];
              const initials = getInitials(name);
              const nationalityCode = entry.data.nationalities?.[0];
              const countryCode = entryCountryCode(entry);
              const previousCountryCode = index > 0 ? entryCountryCode(pageEntries[index - 1]) : null;

              return (
                <Fragment key={`${entry.kind}-${entry.data.id}`}>
                {countryCode !== previousCountryCode && (
                  <div className="border-b-2 border-zinc-900 pb-2 sm:col-span-2 lg:col-span-3">
                    <h2 className="font-display text-2xl font-black uppercase text-zinc-950">
                      {countryCode
                        ? `${countryFlagEmoji(countryCode)} ${getCountryName(countryCode, i18n.resolvedLanguage)}`
                        : t('fighters.countryFilter.unspecified')}
                    </h2>
                  </div>
                )}
                <div
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
                        {nationalityCode && <span className="mr-2" aria-hidden="true">{countryFlagEmoji(nationalityCode)}</span>}
                        {name}
                      </h2>
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

                  <dl className="mb-4 grid grid-cols-3 divide-x divide-zinc-200 border-y border-zinc-200 py-3 text-center">
                    <div className="min-w-0 px-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{t('fighters.card.city')}</dt>
                      <dd className="mt-1 truncate text-xs font-semibold text-zinc-800" title={city ?? undefined}>{city ?? '—'}</dd>
                    </div>
                    <div className="min-w-0 px-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{t('fighters.card.height')}</dt>
                      <dd className="mt-1 text-xs font-semibold text-zinc-800">{heightCm != null ? `${heightCm} cm` : '—'}</dd>
                    </div>
                    <div className="min-w-0 px-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{t('fighters.card.weight')}</dt>
                      <dd className="mt-1 text-xs font-semibold text-zinc-800">{exactWeight != null ? `${exactWeight} kg` : '—'}</dd>
                    </div>
                  </dl>

                  {willingToTravel && (
                    <div className="mb-4 flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] text-white" aria-hidden="true">✓</span>
                      <span>{t('fighters.card.willingToTravel')}</span>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-2">
                    {age !== null && (
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1">
                        {t('fighters.age')}: {age}
                      </span>
                    )}
                    {weightClass && (
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1">
                        {weightClassKey
                          ? t(`events:events.weightClasses.${weightClassKey}`, { defaultValue: weightClass })
                          : weightClass}
                      </span>
                    )}
                    {skillRating != null && <span className="text-xs bg-zinc-100 px-2 py-1 text-zinc-700">{t('fighters.skillLevel')} {skillRating}/10</span>}
                    <span className="text-xs bg-zinc-100 px-2 py-1 text-zinc-700">KO/TKO {koTkoWins}</span>
                    {rulesets.map((ruleset) => <span key={ruleset} className="text-xs border border-zinc-200 px-2 py-1 text-zinc-700">{ruleset}</span>)}
                    {followers !== null && (
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1">
                        {followers} {followers === 1 ? t('fighters.follower') : t('fighters.followers')}
                      </span>
                    )}
                    {disciplines.map((discipline) => {
                      const translationKey = disciplineI18nKey(discipline);
                      return (
                        <span key={discipline} className="text-xs font-bold px-2 py-1 uppercase tracking-wide bg-[#0A0A0A] text-white">
                          {translationKey
                            ? t(`fighters.disciplines.${translationKey}`, { defaultValue: discipline })
                            : discipline}
                        </span>
                      );
                    })}
                    <span className={`text-xs font-bold px-2 py-1 uppercase tracking-widest ${experience === 'pro' ? 'bg-[#C0001E] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                      {experience === 'pro' ? t('fighters.profile.pro') : t('fighters.profile.amateur')}
                    </span>
                    <span className={`text-xs px-2 py-1 ${isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {isAvailable ? t('fighters.available') : t('fighters.unavailable')}
                    </span>
                  </div>
                  </div>
                </div>
                </Fragment>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
        </div>
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

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function DisciplineMark({ discipline }: { discipline: string }) {
  const key = discipline === 'all' ? 'all' : disciplineI18nKey(discipline) ?? 'other';
  const Icon = DISCIPLINE_ICONS[key] ?? MdSportsMartialArts;

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-current/25 bg-black/20 transition-transform group-hover:scale-105" aria-hidden="true">
      <Icon className="h-6 w-6" />
    </span>
  );
}

const DISCIPLINE_ICONS: Record<string, IconType> = {
  all: MdSportsMartialArts,
  boxing: GiBoxingGlove,
  muayThai: GiPunchingBag,
  mma: MdSportsMma,
  kickboxing: GiHighKick,
  karate: TbKarate,
  judo: GiKimono,
  wrestling: GiConfrontation,
  limaLama: GiBlackBelt,
  jiuJitsu: GiBelt,
  pointFight: GiHighPunch,
  bareKnuckle: GiFist,
  k1: GiPunchBlast,
  lightContact: GiGloves,
  kickLight: GiBootKick,
  lowKick: GiLeg,
  fullContact: GiPunch,
  other: MdSportsMartialArts,
};

function entryDisciplines(entry: FighterDirectoryEntry): string[] {
  return entry.kind === 'manual'
    ? normalizeDisciplineList(entry.data.disciplines, entry.data.discipline)
    : normalizeDisciplineList(entry.data.disciplines);
}

function entryName(entry: FighterDirectoryEntry): string {
  return entry.kind === 'manual'
    ? entry.data.full_name
    : entry.data.profiles?.full_name ?? '';
}

function entryCountryCode(entry: FighterDirectoryEntry): string {
  const value = entry.kind === 'manual'
    ? entry.data.country_code
    : entry.data.profiles?.country_code;
  return value?.trim().toUpperCase() ?? '';
}

function entryDirectoryRank(entry: FighterDirectoryEntry): number {
  if (entry.data.age != null && entry.data.age < 18) return 2;
  return entry.data.experience_level === 'pro' ? 0 : 1;
}
