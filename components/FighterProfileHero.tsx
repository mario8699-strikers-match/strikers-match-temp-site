'use client';

import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { RecordValue } from '@/components/CombatRecord';
import { countryFlagEmoji, getCountryName } from '@/lib/countries';
import { getSocialMediaDisplayValue, getSocialMediaHref } from '@/lib/socialMedia';
import { disciplineI18nKey } from '@/lib/disciplines';
import { fighterWeightClassI18nKey } from '@/lib/fighterDisplay';

interface FighterProfileHeroProps {
  fullName: string;
  photoUrl?: string | null;
  nationalityCode?: string | null;
  countryCode?: string | null;
  country?: string | null;
  instagram?: string | null;
  primaryDiscipline?: string | null;
  weight?: string | null;
  team?: string | null;
  wins?: number | null;
  losses?: number | null;
  draws?: number | null;
  experienceLevel?: 'amateur' | 'pro' | null;
  verified?: boolean;
  roster?: boolean;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toLocaleUpperCase();
}

export function FighterProfileHero({
  fullName,
  photoUrl,
  nationalityCode,
  countryCode,
  country,
  instagram,
  primaryDiscipline,
  weight,
  team,
  wins,
  losses,
  draws,
  experienceLevel = 'amateur',
  verified = false,
  roster = false,
}: FighterProfileHeroProps) {
  const { t, i18n } = useTranslation(['fighters', 'events']);
  const language = i18n.resolvedLanguage || i18n.language;
  const flagCode = nationalityCode || countryCode;
  const flag = countryFlagEmoji(flagCode);
  const nationalityName = flagCode
    ? getCountryName(flagCode, language)
    : country?.trim() || '';
  const countryName = (countryCode ? getCountryName(countryCode, language) : '')
    || country?.trim()
    || nationalityName;
  const instagramHref = instagram ? getSocialMediaHref('instagram', instagram) : null;
  const disciplineKey = disciplineI18nKey(primaryDiscipline);
  const localizedDiscipline = disciplineKey
    ? t(`fighters.disciplines.${disciplineKey}`, { defaultValue: primaryDiscipline ?? '' })
    : primaryDiscipline;
  const weightClassKey = fighterWeightClassI18nKey(weight);
  const localizedWeight = weightClassKey
    ? t(`events:events.weightClasses.${weightClassKey}`, { defaultValue: weight ?? '' })
    : weight;

  const facts = [
    { label: t('fighters.profile.primarySport'), value: localizedDiscipline },
    { label: t('fighters.profile.weight'), value: localizedWeight },
    { label: t('fighters.profile.country'), value: countryName ? `${flag ? `${flag} ` : ''}${countryName}` : null },
    { label: t('fighters.profile.team'), value: team },
  ];

  return (
    <section className="overflow-hidden border border-zinc-200 bg-white shadow-[0_18px_60px_rgba(0,0,0,0.08)]">
      <div className="h-1.5 bg-[#C0001E]" />
      <div className="grid md:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <div className="relative aspect-[4/5] min-h-[360px] overflow-hidden bg-zinc-950 md:aspect-auto md:min-h-[560px]">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={t('fighters.profile.photoAlt', { name: fullName })}
              fill
              priority
              sizes="(max-width: 767px) 100vw, 42vw"
              className="object-cover object-top"
            />
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#343434_0%,#101010_58%,#050505_100%)] px-6 text-center md:min-h-[560px]">
              <span className="font-display text-8xl font-black uppercase tracking-[-0.06em] text-white/20">
                {initials(fullName) || 'SM'}
              </span>
              <span className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-white/50">
                {t('fighters.profile.noPhoto')}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C0001E]">
              {t('fighters.profile.eyebrow')}
            </span>
            <span className="bg-zinc-950 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
              {experienceLevel === 'pro'
                ? t('fighters.profile.pro')
                : t('fighters.profile.amateur')}
            </span>
            {verified && (
              <span className="border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                {t('fighters.profile.verified')}
              </span>
            )}
            {roster && (
              <span className="border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800">
                {t('fighters.profile.roster')}
              </span>
            )}
          </div>

          <div className="mt-7">
            <h1 className="break-words text-4xl font-black uppercase leading-[0.92] sm:text-5xl lg:text-6xl">
              {fullName}
              {flag && (
                <span className="ml-3 inline-block align-[0.08em] text-[0.52em]" title={nationalityName} aria-label={nationalityName}>
                  {flag}
                </span>
              )}
            </h1>
            {nationalityName && (
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {nationalityName}
              </p>
            )}
          </div>

          <div className="my-8 border-y border-zinc-200 py-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              {experienceLevel === 'pro'
                ? t('fighters.profile.professionalRecord')
                : t('fighters.profile.amateurRecord')}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2 font-display text-5xl font-black tracking-[-0.04em] sm:text-6xl">
              <RecordValue part="wins" value={wins ?? 0} />
              <span className="text-zinc-300">–</span>
              <RecordValue part="losses" value={losses ?? 0} />
              <span className="text-zinc-300">–</span>
              <RecordValue part="draws" value={draws ?? 0} />
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
              {t('fighters.profile.recordOrder')}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0 border-b border-zinc-100 pb-4">
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                  {fact.label}
                </dt>
                <dd className="mt-1 break-words text-base font-bold text-zinc-950">
                  {fact.value || t('fighters.profile.notSpecified')}
                </dd>
              </div>
            ))}
          </dl>

          {instagramHref && instagram && (
            <a
              href={instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex min-h-12 w-fit items-center gap-3 border border-zinc-950 bg-zinc-950 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:border-[#C0001E] hover:bg-[#C0001E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C0001E]"
              aria-label={t('fighters.profile.openInstagram', { name: fullName })}
            >
              <InstagramIcon />
              <span>{getSocialMediaDisplayValue(instagram)}</span>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 stroke-current" fill="none" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.7" r="1" className="fill-current stroke-none" />
    </svg>
  );
}
