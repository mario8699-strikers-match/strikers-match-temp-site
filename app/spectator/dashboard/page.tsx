'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { InlineCombatRecord } from '@/components/CombatRecord';
import { Pagination } from '@/components/Pagination';
import { authService } from '@/services/authService';
import { fighterFollowService } from '@/services/fighterFollowService';
import type { FighterFollowWithFighter, Profile } from '@/types';

const FOLLOWS_PAGE_SIZE = 20;

const WEIGHT_LABELS: Record<string, string> = {
  minimosca: 'Minimosca',
  mosca: 'Mosca',
  supermosca: 'Supermosca',
  gallo: 'Gallo',
  supergallo: 'Supergallo',
  pluma: 'Pluma',
  superpluma: 'Superpluma',
  ligero: 'Ligero',
  superligero: 'Superligero',
  welter: 'Welter',
  superwelter: 'Superwelter',
  medio: 'Medio',
  supermedio: 'Supermedio',
  semipesado: 'Semipesado',
  crucero: 'Crucero',
  pesado: 'Pesado',
};

export default function SpectatorDashboardPage() {
  const { t } = useTranslation('spectator');
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [follows, setFollows] = useState<FighterFollowWithFighter[]>([]);
  const [page, setPage] = useState(1);
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await authService.getSession();
      const currentProfile = sessionData?.profile ?? null;
      if (!currentProfile) {
        window.location.href = `/login?next=${encodeURIComponent('/spectator/dashboard')}`;
        return;
      }
      if (currentProfile.role !== 'spectator' && currentProfile.role !== 'admin') {
        window.location.href = '/';
        return;
      }

      const { data, error: followError } = await fighterFollowService.listForSpectator(currentProfile.id);
      if (cancelled) return;
      setProfile(currentProfile);
      setFollows(data ?? []);
      setError(followError);
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const available = follows.filter((follow) => follow.fighters.is_available).length;
    const cities = new Set(
      follows
        .map((follow) => follow.fighters.profiles?.city?.trim())
        .filter(Boolean)
    ).size;
    const disciplines = new Set(
      follows.flatMap((follow) => follow.fighters.disciplines ?? []).filter(Boolean)
    ).size;

    return { available, cities, disciplines };
  }, [follows]);

  const totalPages = Math.max(1, Math.ceil(follows.length / FOLLOWS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleFollows = useMemo(() => {
    const start = (safePage - 1) * FOLLOWS_PAGE_SIZE;
    return follows.slice(start, start + FOLLOWS_PAGE_SIZE);
  }, [follows, safePage]);
  const visibleFighterIds = useMemo(
    () => visibleFollows.map((follow) => follow.fighter_id),
    [visibleFollows]
  );
  const visibleFighterIdsKey = visibleFighterIds.join(',');

  useEffect(() => {
    if (!visibleFighterIdsKey) return;
    let cancelled = false;

    fighterFollowService.getFollowerCounts(visibleFighterIds).then(({ data }) => {
      if (!cancelled && data) {
        setFollowerCounts((current) => ({ ...current, ...data }));
      }
    });

    return () => { cancelled = true; };
  }, [visibleFighterIds, visibleFighterIdsKey]);

  const handlePageChange = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  };

  const handleUnfollow = async (fighterId: string) => {
    if (!profile) return;
    const previous = follows;
    setFollows((current) => current.filter((follow) => follow.fighter_id !== fighterId));
    const { error: unfollowError } = await fighterFollowService.unfollow(profile.id, fighterId);
    if (unfollowError) {
      setFollows(previous);
      setError(unfollowError);
    }
  };

  if (profile === undefined || loading) {
    return (
      <div className="min-h-screen bg-white font-sans flex flex-col">
        <Navbar activePage={null} />
        <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-zinc-500">{t('spectator.loading')}</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="mb-6 border border-zinc-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-[#C0001E]">
                {t('spectator.eyebrow')}
              </p>
              <h1 className="font-display font-black uppercase leading-none text-zinc-950" style={{ fontSize: 'clamp(2.6rem,7vw,5.25rem)' }}>
                {t('spectator.title')}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600">{t('spectator.subtitle')}</p>
            </div>
            <Link
              href="/fighters"
              className="inline-flex min-h-12 w-full items-center justify-center bg-[#C0001E] px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#9A0018] sm:w-auto"
            >
              {t('spectator.findFighters')}
            </Link>
          </div>
        </section>

        {error && (
          <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {[
            { label: t('spectator.stats.following'), value: follows.length },
            { label: t('spectator.stats.available'), value: stats.available },
            { label: t('spectator.stats.cities'), value: stats.cities },
            { label: t('spectator.stats.disciplines'), value: stats.disciplines },
          ].map((item) => (
            <div key={item.label} className="border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
              <p className="font-display text-4xl font-black leading-none text-zinc-950 sm:text-5xl">{item.value}</p>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500">{item.label}</p>
            </div>
          ))}
        </section>

        {follows.length === 0 ? (
          <section className="border border-dashed border-zinc-200 px-5 py-16 text-center">
            <h2 className="font-display text-3xl font-black uppercase text-zinc-950">{t('spectator.emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600">{t('spectator.emptyBody')}</p>
            <Link
              href="/fighters"
              className="mt-6 inline-flex min-h-11 items-center bg-zinc-900 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#C0001E]"
            >
              {t('spectator.findFighters')}
            </Link>
          </section>
        ) : (
          <section>
            <div className="mb-4 flex flex-col gap-2 border-b border-zinc-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-2xl font-black uppercase text-zinc-950">
                {t('spectator.followedTitle')}
              </h2>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                {follows.length}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {visibleFollows.map((follow) => (
                <SpectatorFighterCard
                  key={follow.id}
                  follow={follow}
                  followerCount={followerCounts[follow.fighter_id] ?? 0}
                  onUnfollow={() => handleUnfollow(follow.fighter_id)}
                />
              ))}
            </div>
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              labels={{
                prev: t('common.previous', { ns: 'common', defaultValue: 'Anterior' }),
                next: t('common.next', { ns: 'common', defaultValue: 'Siguiente' }),
              }}
            />
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

function SpectatorFighterCard({
  follow,
  followerCount,
  onUnfollow,
}: {
  follow: FighterFollowWithFighter;
  followerCount: number;
  onUnfollow: () => void;
}) {
  const { t } = useTranslation('spectator');
  const fighter = follow.fighters;
  const fighterName = fighter.profiles?.full_name ?? t('spectator.fighterFallback');
  const age = getAge(fighter.profiles?.date_of_birth);
  const bouts = (fighter.record_wins ?? 0) + (fighter.record_losses ?? 0) + (fighter.record_draws ?? 0);
  const division = fighter.weight_class ? (WEIGHT_LABELS[fighter.weight_class] ?? fighter.weight_class) : '—';
  const disciplines = fighter.disciplines?.length ? fighter.disciplines.join(', ') : '—';
  const primaryDiscipline = fighter.disciplines?.[0] ?? 'box';
  const weight = fighter.exact_weight ? `${fighter.exact_weight} kg` : division;

  return (
    <article className="overflow-hidden border border-zinc-200 bg-white p-3 sm:p-5 lg:p-6">
      <header className="border-b border-zinc-200 pb-4 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#C0001E]">{t('spectator.registered')}</p>
        <h3 className="mt-2 break-words font-display text-3xl font-black uppercase leading-none text-zinc-950 sm:text-5xl">
          {fighterName}
        </h3>
        <div className="mx-auto mt-5 grid max-w-md grid-cols-2 border-b-4 border-zinc-200 text-center text-xs font-bold uppercase tracking-wide text-zinc-500 sm:text-sm">
          <span className="border-b-4 border-[#C0001E] pb-3 text-[#C0001E]">
            {t('spectator.recordTabs.amateur')}
          </span>
          <span className="pb-3">{t('spectator.recordTabs.all')}</span>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div>
          <div className="grid grid-cols-3 overflow-hidden border border-zinc-200 text-center font-display text-4xl font-black leading-none sm:text-6xl">
            <div className="bg-emerald-600 px-2 py-3 text-white">{fighter.record_wins ?? 0}</div>
            <div className="bg-red-700 px-2 py-3 text-white">{fighter.record_losses ?? 0}</div>
            <div className="bg-blue-500 px-2 py-3 text-white">{fighter.record_draws ?? 0}</div>
          </div>
          <div className="grid grid-cols-3 text-center text-xs font-bold uppercase tracking-widest">
            <span className="py-2 text-emerald-700">{t('spectator.record.wins')}</span>
            <span className="py-2 text-red-700">{t('spectator.record.losses')}</span>
            <span className="py-2 text-blue-700">{t('spectator.record.draws')}</span>
          </div>

          <div className="relative h-[300px] overflow-hidden bg-zinc-100 sm:h-[360px]">
            {fighter.photo_url ? (
              <Image
                src={fighter.photo_url}
                alt={fighterName}
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-bold uppercase tracking-widest text-zinc-400">
                {t('spectator.noPhoto')}
              </div>
            )}
          </div>

          <div className="border-x border-b border-zinc-200">
            <button
              type="button"
              onClick={onUnfollow}
              className="block min-h-12 w-full bg-zinc-200 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-zinc-700 transition-colors hover:bg-zinc-300"
            >
              {t('spectator.unfollow')}
            </button>
            <Link
              href={`/fighters/${fighter.id}`}
              className="block min-h-12 w-full border-t border-zinc-200 bg-white px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-zinc-900 transition-colors hover:text-[#C0001E]"
            >
              {t('spectator.viewProfile')}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-10 gap-y-2 self-start md:grid-cols-2">
          <InfoRow label={t('spectator.profileStats.division')} value={division} />
          <InfoRow label={t('spectator.profileStats.status')} value={fighter.is_available ? t('spectator.available') : t('spectator.unavailable')} tone={fighter.is_available ? 'green' : 'muted'} />
          <InfoRow label={t('spectator.profileStats.followers')} value={String(followerCount)} />
          <InfoRow label={t('spectator.profileStats.discipline')} value={disciplines} />
          <InfoRow label={t('spectator.profileStats.bouts')} value={String(bouts)} />
          <InfoRow label={t('spectator.profileStats.gym')} value={fighter.gym_name ?? '—'} />
          <InfoRow label={t('spectator.profileStats.age')} value={age !== null ? String(age) : '—'} />
          <InfoRow label={t('spectator.profileStats.city')} value={fighter.profiles?.city ?? fighter.state ?? '—'} />
          <InfoRow label={t('spectator.profileStats.weight')} value={weight} />
          <InfoRow label={t('spectator.profileStats.height')} value={fighter.height_cm ? `${fighter.height_cm} cm` : '—'} />
          <InfoRow label={t('spectator.profileStats.reach')} value={fighter.reach_cm ? `${fighter.reach_cm} cm` : '—'} />

          <div className="md:col-span-2">
            <div className="mt-4 border-t border-zinc-200 pt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                {t('spectator.record.label')}
              </p>
              <div className="mt-2 text-sm">
                <InlineCombatRecord
                  wins={fighter.record_wins}
                  losses={fighter.record_losses}
                  draws={fighter.record_draws}
                  winLabel="W"
                  lossLabel="L"
                  drawLabel="D"
                />
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[#C0001E]">
                {primaryDiscipline}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'muted';
}) {
  const valueClass = tone === 'green'
    ? 'text-emerald-700'
    : tone === 'muted'
      ? 'text-zinc-500'
      : 'text-zinc-900';

  return (
    <div className="grid grid-cols-1 gap-1 py-1.5 text-sm sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-4">
      <dt className="font-black lowercase text-zinc-950 sm:text-right">{label}</dt>
      <dd className={`min-w-0 break-words font-medium ${valueClass}`}>{value}</dd>
    </div>
  );
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
