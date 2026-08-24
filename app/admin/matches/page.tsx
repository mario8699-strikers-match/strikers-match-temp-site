'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoutMethodText } from '@/components/CombatRecord';
import { adminService } from '@/services/adminService';
import type { Bout } from '@/types';
import type { MatchWithContext } from '@/services/matchService';

type AdminBout = Bout & {
  events?: { id: string; event_name: string } | null;
  event_mats?: { name: string; mat_number: number } | null;
};

const MATCH_STATUS_STYLE: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
};

const BOUT_STATUS_STYLE: Record<string, string> = {
  approved: 'border-blue-200 bg-blue-50 text-blue-800',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ready: 'border-amber-200 bg-amber-50 text-amber-800',
  in_progress: 'border-[#C0001E] bg-red-50 text-[#C0001E]',
  completed: 'border-zinc-300 bg-zinc-100 text-zinc-800',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
  no_show: 'border-red-200 bg-red-50 text-red-800',
};

export default function AdminMatchesPage() {
  const { t } = useTranslation('admin');
  const [tab, setTab] = useState<'matches' | 'bouts'>('matches');
  const [matches, setMatches] = useState<MatchWithContext[]>([]);
  const [bouts, setBouts] = useState<AdminBout[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([adminService.getAllMatches(), adminService.getAllBouts()])
      .then(([matchResult, boutResult]) => {
        if (!active) return;
        setMatches(matchResult.data ?? []);
        setBouts((boutResult.data ?? []) as AdminBout[]);
        setError(matchResult.error ?? boutResult.error);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los datos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredMatches = useMemo(() => matches.filter((match) => {
    if (status !== 'all' && match.match_status !== status) return false;
    if (!normalizedSearch) return true;
    return [
      match.events?.event_name,
      match.fighter_a?.profiles?.full_name,
      match.fighter_b?.profiles?.full_name,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch));
  }), [matches, normalizedSearch, status]);

  const filteredBouts = useMemo(() => bouts.filter((bout) => {
    if (status !== 'all' && bout.status !== status) return false;
    if (!normalizedSearch) return true;
    return [bout.events?.event_name, bout.fighter_a_snapshot.name, bout.fighter_b_snapshot.name]
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
  }), [bouts, normalizedSearch, status]);

  const statuses = tab === 'matches'
    ? ['pending', 'confirmed', 'cancelled']
    : ['approved', 'confirmed', 'ready', 'in_progress', 'completed', 'cancelled', 'no_show'];

  const changeTab = (next: 'matches' | 'bouts') => {
    setTab(next);
    setStatus('all');
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.matchesPage.title')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('admin.matchesPage.subtitle')}</p>
      </header>

      <div className="grid grid-cols-2 border border-zinc-300 bg-zinc-100 p-1">
        <button type="button" onClick={() => changeTab('matches')}
          className={`min-h-11 px-4 py-2 text-sm font-bold ${tab === 'matches' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700'}`}>
          {t('admin.matchesPage.proposals')} ({matches.length})
        </button>
        <button type="button" onClick={() => changeTab('bouts')}
          className={`min-h-11 px-4 py-2 text-sm font-bold ${tab === 'bouts' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700'}`}>
          {t('admin.matchesPage.bouts')} ({bouts.length})
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
        <div>
          <label htmlFor="admin-match-search" className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('admin.matchesPage.search')}</label>
          <input id="admin-match-search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.matchesPage.searchPlaceholder')} className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </div>
        <div>
          <label htmlFor="admin-match-status" className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('admin.matchesPage.status')}</label>
          <select id="admin-match-status" value={status} onChange={(event) => setStatus(event.target.value)}
            className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900">
            <option value="all">{t('admin.matchesPage.all')}</option>
            {statuses.map((item) => <option key={item} value={item}>{formatStatus(item, t)}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-500">{t('admin.matchesPage.loading')}</p>
      ) : tab === 'matches' ? (
        <MatchList matches={filteredMatches} />
      ) : (
        <BoutList bouts={filteredBouts} />
      )}
    </div>
  );
}

function MatchList({ matches }: { matches: MatchWithContext[] }) {
  const { t } = useTranslation('admin');
  if (matches.length === 0) return <EmptyState text={t('admin.matchesPage.noProposals')} />;
  return (
    <>
      <div className="mt-5 space-y-3 sm:hidden">
        {matches.map((match) => <MatchCard key={match.id} match={match} />)}
      </div>
      <div className="mt-5 hidden overflow-x-auto border border-zinc-200 bg-white sm:block">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50"><tr>{[
            t('admin.matchesPage.event'),
            t('admin.matchesPage.fighters'),
            t('admin.matchesPage.responses'),
            t('admin.matchesPage.compatibility'),
            t('admin.matchesPage.status'),
            t('admin.matchesPage.created'),
          ].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {matches.map((match) => (
              <tr key={match.id}>
                <td className="whitespace-nowrap px-4 py-3"><EventLink id={match.events?.id} name={match.events?.event_name} /></td>
                <td className="px-4 py-3 font-medium text-zinc-900">{fighterNames(match)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">{t('admin.matchesPage.stateLine', { a: match.fighter_a_status, b: match.fighter_b_status })}</td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">{match.compatibility_score ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3"><Status value={match.match_status} styles={MATCH_STATUS_STYLE} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{formatDate(match.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MatchCard({ match }: { match: MatchWithContext }) {
  const { t } = useTranslation('admin');
  return (
    <article className="border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3"><EventLink id={match.events?.id} name={match.events?.event_name} /><Status value={match.match_status} styles={MATCH_STATUS_STYLE} /></div>
      <p className="mt-3 font-bold text-zinc-900">{fighterNames(match)}</p>
      <p className="mt-1 text-xs text-zinc-500">{t('admin.matchesPage.stateLine', { a: match.fighter_a_status, b: match.fighter_b_status })} · {t('admin.matchesPage.compatibility')}: {match.compatibility_score ?? '—'}</p>
      <p className="mt-2 text-xs text-zinc-400">{formatDate(match.created_at)}</p>
    </article>
  );
}

function BoutList({ bouts }: { bouts: AdminBout[] }) {
  const { t } = useTranslation('admin');
  if (bouts.length === 0) return <EmptyState text={t('admin.matchesPage.noBouts')} />;
  return (
    <>
      <div className="mt-5 space-y-3 sm:hidden">
        {bouts.map((bout) => <BoutCard key={bout.id} bout={bout} />)}
      </div>
      <div className="mt-5 hidden overflow-x-auto border border-zinc-200 bg-white sm:block">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50"><tr>{[
            t('admin.matchesPage.combat'),
            t('admin.matchesPage.event'),
            t('admin.matchesPage.fighters'),
            t('admin.matchesPage.area'),
            t('admin.matchesPage.division'),
            t('admin.matchesPage.status'),
            t('admin.matchesPage.method'),
            t('admin.matchesPage.created'),
          ].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-zinc-100">
            {bouts.map((bout) => (
              <tr key={bout.id}>
                <td className="whitespace-nowrap px-4 py-3 font-bold text-zinc-900">{bout.bout_number ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3"><EventLink id={bout.events?.id} name={bout.events?.event_name} /></td>
                <td className="px-4 py-3 font-medium text-zinc-900">{bout.fighter_a_snapshot.name} vs {bout.fighter_b_snapshot.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">{bout.event_mats ? `${bout.event_mats.mat_number}. ${bout.event_mats.name}` : '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">{bout.discipline ?? '—'} · {bout.weight_class ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3"><Status value={bout.status} styles={BOUT_STATUS_STYLE} /></td>
                <td className="whitespace-nowrap px-4 py-3"><BoutMethodText value={bout.method} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{formatDate(bout.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BoutCard({ bout }: { bout: AdminBout }) {
  const { t } = useTranslation('admin');
  return (
    <article className="border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-[#C0001E]">{t('admin.matchesPage.combat')} {bout.bout_number ?? '—'}</p><Status value={bout.status} styles={BOUT_STATUS_STYLE} /></div>
      <p className="mt-2 font-bold text-zinc-900">{bout.fighter_a_snapshot.name} vs {bout.fighter_b_snapshot.name}</p>
      <p className="mt-1 text-xs text-zinc-500">{bout.discipline ?? '—'} · {bout.weight_class ?? '—'} · {bout.event_mats?.name ?? t('admin.matchesPage.noArea')}</p>
      {bout.method && (
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
          {t('admin.matchesPage.method')}: <BoutMethodText value={bout.method} />
        </p>
      )}
      <div className="mt-3"><EventLink id={bout.events?.id} name={bout.events?.event_name} /></div>
    </article>
  );
}

function Status({ value, styles }: { value: string; styles: Record<string, string> }) {
  const { t } = useTranslation('admin');
  return <span className={`inline-block whitespace-nowrap border px-2 py-1 text-xs font-bold uppercase tracking-wide ${styles[value] ?? 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>{formatStatus(value, t)}</span>;
}

function EventLink({ id, name }: { id?: string; name?: string }) {
  return id ? <Link href={`/events/${id}`} className="font-medium text-zinc-800 underline">{name ?? 'Evento'}</Link> : <span className="text-zinc-500">{name ?? '—'}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="mt-5 border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500">{text}</p>;
}

function fighterNames(match: MatchWithContext) {
  return `${match.fighter_a?.profiles?.full_name ?? '—'} vs ${match.fighter_b?.profiles?.full_name ?? '—'}`;
}

function formatStatus(value: string, t: (key: string) => string) {
  return t(`admin.matchesPage.statusLabels.${value}`) || value.replaceAll('_', ' ');
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
