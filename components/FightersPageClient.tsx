'use client';

import Image from 'next/image';
import { Fragment, useEffect, useState, useCallback, useMemo, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import {
  GiBlackBelt,
  GiBootKick,
  GiBoxingGlove,
  GiConfrontation,
  GiFist,
  GiGloves,
  GiHighKick,
  GiHighPunch,
  GiKimono,
  GiKneeling,
  GiLeg,
  GiNinjaArmor,
  GiPunch,
  GiPunchBlast,
  GiPunchingBag,
} from 'react-icons/gi';
import { MdSportsMartialArts, MdSportsMma } from 'react-icons/md';
import { fighterService } from '@/services/fighterService';
import { manualFighterService } from '@/services/manualFighterService';
import { supabase } from '@/lib/supabaseClient';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import {
  DISCIPLINE_OPTIONS,
  disciplineI18nKey,
  disciplineMatches,
  normalizeDisciplineList,
} from '@/lib/disciplines';
import type { FighterWithProfile, ManualFighterWithCreator } from '@/types';
import { countryFlagEmoji, getCountryName } from '@/lib/countries';
import { fighterPublicPath, manualFighterPublicPath } from '@/lib/publicUrls';
import { fighterWeightClassI18nKey } from '@/lib/fighterDisplay';
import { getSocialMediaDisplayValue } from '@/lib/socialMedia';

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
  const selectedDisciplines = useMemo(
    () => normalizeDisciplineList(searchParams.getAll('discipline'))
      .filter((discipline) => DISCIPLINE_OPTIONS.includes(discipline)),
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

  const disciplineOptions = DISCIPLINE_OPTIONS;

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
    <div className="min-h-screen bg-zinc-950 font-sans flex flex-col">
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

        <div className="mx-auto w-full max-w-7xl bg-zinc-950 px-4 py-12 sm:px-6 lg:px-8">

        {loading ? (
          <div className="border border-white/10 bg-zinc-900/60 py-24 text-center text-sm text-zinc-400">{t('fighters.loading')}</div>
        ) : filteredEntries.length === 0 ? (
          <div className="border border-dashed border-white/15 bg-zinc-900/40 py-24 text-center">
            <p className="text-sm text-zinc-400">{searchQuery ? t('fighters.search.empty') : t('fighters.empty')}</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 gap-4">
            {pageEntries.map((entry, index) => {
              const isManual = entry.kind === 'manual';
              const name = isManual
                ? entry.data.full_name
                : (entry.data.profiles?.full_name ?? '—');
              const city = isManual
                ? entry.data.city
                : entry.data.profiles?.city;
              const verified = !isManual && entry.data.verified;
              const weightClass = entry.data.weight_class;
              const disciplines = entryDisciplines(entry);
              const experience = entry.data.experience_level;
              const wins = entry.data.record_wins ?? 0;
              const losses = entry.data.record_losses ?? 0;
              const draws = entry.data.record_draws ?? 0;
              const isAvailable = entry.data.is_available;
              const photoUrl = entry.data.photo_url;
              const exactWeight = entry.data.exact_weight;
              const heightCm = entry.data.height_cm;
              const willingToTravel = entry.data.available_to_travel_internationally === true;
              const weightClassKey = fighterWeightClassI18nKey(weightClass);
              const initials = getInitials(name);
              const nationalityCode = entry.data.nationalities?.[0];
              const countryCode = entryCountryCode(entry);
              const countryName = countryCode ? getCountryName(countryCode, i18n.resolvedLanguage) : '';
              const location = [countryName, city].filter(Boolean).join(', ');
              const instagram = isManual ? entry.data.instagram : entry.data.profiles?.instagram;
              const instagramHandle = instagram ? getSocialMediaDisplayValue(instagram) : '';
              const gymName = entry.data.gym_name;
              const localizedWeightClass = weightClassKey
                ? t(`events:events.weightClasses.${weightClassKey}`, { defaultValue: weightClass ?? '' })
                : weightClass;
              const previousCountryCode = index > 0 ? entryCountryCode(pageEntries[index - 1]) : null;

              return (
                <Fragment key={`${entry.kind}-${entry.data.id}`}>
                {countryCode !== previousCountryCode && (
                  <div className="border-b border-white/15 pb-3 pt-4">
                    <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white">
                      {countryCode
                        ? `${countryFlagEmoji(countryCode)} ${getCountryName(countryCode, i18n.resolvedLanguage)}`
                        : t('fighters.countryFilter.unspecified')}
                    </h2>
                  </div>
                )}
                <button
                  type="button"
                  className="group grid w-full overflow-hidden border border-white/10 bg-[#101012] text-left text-white shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-0.5 hover:border-[#C0001E] hover:shadow-[0_20px_60px_rgba(192,0,30,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C0001E] sm:grid-cols-[210px_minmax(0,1fr)]"
                  onClick={() => goTo(entry)}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900 sm:aspect-auto sm:min-h-[250px]">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt={name} className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full min-h-[230px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,#2b2b2f_0%,#111113_65%,#080808_100%)]">
                        <span className="font-display text-5xl font-black uppercase text-white/25">{initials}</span>
                      </div>
                    )}
                    {(nationalityCode || countryCode) && (
                      <span className="absolute bottom-3 right-3 bg-black/75 px-2.5 py-1.5 text-xl shadow-lg" aria-hidden="true">
                        {countryFlagEmoji(nationalityCode || countryCode)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-2xl font-black uppercase leading-none text-white transition-colors group-hover:text-[#F01835] sm:text-3xl">
                            {name}
                          </h3>
                          {verified && (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-400">
                              <span aria-hidden="true">✓</span>{t('fighters.verified')}
                            </span>
                          )}
                          {isManual && (
                            <span className="border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-300">
                              {t('fighters.roster_badge')}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">{location || t('fighters.countryFilter.unspecified')}</p>
                        {instagramHandle && (
                          <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-zinc-200" aria-label={`Instagram ${instagramHandle}`}>
                            <InstagramMark />
                            <span>{instagramHandle}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-center gap-2 self-start sm:self-auto">
                        {experience === 'pro' && (
                          <span
                            className="flex h-[78px] w-[68px] flex-col items-center justify-center border-x border-b border-white/30 bg-[#C0001E] text-center text-white drop-shadow-[0_8px_14px_rgba(0,0,0,0.55)]"
                            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)' }}
                            role="img"
                            aria-label={t('fighters.card.proBadge')}
                            title={t('fighters.card.proBadge')}
                          >
                            <span className="font-display text-2xl font-black uppercase leading-none tracking-wide">PRO</span>
                            <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.18em] text-white/80">Fighter</span>
                          </span>
                        )}
                        <span className={`inline-flex w-fit items-center gap-2 text-sm font-bold ${isAvailable ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${isAvailable ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.65)]' : 'bg-zinc-600'}`} aria-hidden="true" />
                          {isAvailable ? t('fighters.available') : t('fighters.unavailable')}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_150px_minmax(150px,0.8fr)] lg:items-center">
                      <div className="flex min-w-0 flex-wrap gap-2">
                        {disciplines.map((discipline) => {
                          const translationKey = disciplineI18nKey(discipline);
                          return (
                            <span key={discipline} className="bg-zinc-800 px-3 py-2 text-xs font-black uppercase tracking-wide text-white">
                              {translationKey ? t(`fighters.disciplines.${translationKey}`, { defaultValue: discipline }) : discipline}
                            </span>
                          );
                        })}
                        {localizedWeightClass && (
                          <span className="border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200">{localizedWeightClass}</span>
                        )}
                        {exactWeight != null && (
                          <span className="border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200">{exactWeight} kg</span>
                        )}
                        {heightCm != null && (
                          <span className="border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200">{heightCm} cm</span>
                        )}
                        <span className={`px-3 py-2 text-xs font-black uppercase tracking-wide ${experience === 'pro' ? 'bg-[#C0001E] text-white' : 'bg-white/10 text-zinc-300'}`}>
                          {experience === 'pro' ? t('fighters.profile.pro') : t('fighters.profile.amateur')}
                        </span>
                      </div>

                      <div className="border-y border-white/10 py-4 text-center lg:border-x lg:border-y-0 lg:px-5 lg:py-2">
                        <p className="flex items-center justify-center gap-1 font-display text-3xl font-black tracking-wide" aria-label={`${wins}-${losses}-${draws}`}>
                          <span className="text-emerald-400">{wins}</span>
                          <span className="text-zinc-600" aria-hidden="true">–</span>
                          <span className="text-red-500">{losses}</span>
                          <span className="text-zinc-600" aria-hidden="true">–</span>
                          <span className="text-blue-500">{draws}</span>
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{t('fighters.card.record')}</p>
                      </div>

                      <div className="min-w-0 lg:px-4 lg:text-center">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{t('fighters.card.club')}</p>
                        <p className="mt-2 break-words text-sm font-bold text-zinc-200">{gymName || '—'}</p>
                      </div>
                    </div>

                    {willingToTravel && (
                      <div className="mt-5 inline-flex items-center gap-2 border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-zinc-950" aria-hidden="true">✓</span>
                        <span>{t('fighters.card.willingToTravel')}</span>
                      </div>
                    )}
                  </div>
                </button>
                </Fragment>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} variant="dark" />
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

function InstagramMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-[#F01835]">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
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
  karate: GiNinjaArmor,
  judo: GiKimono,
  wrestling: GiConfrontation,
  limaLama: GiBlackBelt,
  jiuJitsu: GiKneeling,
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
