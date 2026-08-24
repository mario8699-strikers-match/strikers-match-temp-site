'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineCombatRecord } from '@/components/CombatRecord';
import { EventManageFrame } from '@/components/EventManageFrame';
import { authService } from '@/services/authService';
import { approveMatchAsBout } from '@/services/boutService';
import {
  getEventCompatibilityPool,
  type CompatibilityResult,
} from '@/services/compatibilityService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import {
  getMatchesForEvent,
  proposeMatch,
  type MatchWithContext,
} from '@/services/matchService';
import type { Event, Profile } from '@/types';

const FAILURE_LABELS: Record<string, string> = {
  same_fighter: 'Mismo peleador',
  different_event: 'Registro de otro evento',
  fighter_a_not_eligible: 'Primer peleador no elegible',
  fighter_b_not_eligible: 'Segundo peleador no elegible',
  fighter_a_already_assigned: 'Primer peleador ya asignado',
  fighter_b_already_assigned: 'Segundo peleador ya asignado',
  discipline_mismatch: 'Disciplinas incompatibles',
  ruleset_mismatch: 'Reglamentos incompatibles',
  gender_division_mismatch: 'Divisiones incompatibles',
  same_team: 'Mismo equipo',
  weight_tolerance_exceeded: 'Diferencia de peso excedida',
  age_tolerance_exceeded: 'Diferencia de edad excedida',
  experience_tolerance_exceeded: 'Diferencia de experiencia excedida',
  recent_opponent: 'Rivales recientes',
};

const WARNING_LABELS: Record<string, string> = {
  exact_weight_missing: 'Falta peso exacto',
  age_missing: 'Falta edad',
  rank_missing: 'Falta rango',
};

export default function MatchmakingBoardPage() {
  const { t } = useTranslation('events');
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [suggestions, setSuggestions] = useState<CompatibilityResult[]>([]);
  const [matches, setMatches] = useState<MatchWithContext[]>([]);
  const [showInvalid, setShowInvalid] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [poolResult, matchResult] = await Promise.all([
      getEventCompatibilityPool(eventId),
      getMatchesForEvent(eventId),
    ]);
    if (poolResult.error) setError(poolResult.error);
    setSuggestions(poolResult.data ?? []);
    setMatches(matchResult.data ?? []);
  }, [eventId]);

  useEffect(() => {
    Promise.all([authService.getSession(), eventService.getById(eventId)]).then(
      async ([sessionResult, eventResult]) => {
        const nextProfile = sessionResult.data?.profile ?? null;
        const nextEvent = eventResult.data ?? null;
        setProfile(nextProfile);
        setEvent(nextEvent);
        const operatorAllowed = await canUseEventFeature(eventId, 'matchmaking', nextProfile, nextEvent);
        setCanManage(operatorAllowed);
        if (operatorAllowed) {
          await reload();
        }
        setLoading(false);
      }
    );
  }, [eventId, reload]);

  const visibleSuggestions = useMemo(
    () => suggestions.filter((suggestion) => showInvalid || suggestion.eligible),
    [showInvalid, suggestions]
  );
  const activePairKeys = useMemo(() => new Set(
    matches
      .filter((match) => match.match_status !== 'cancelled')
      .map((match) => [match.fighter_a_id, match.fighter_b_id].sort().join(':'))
  ), [matches]);

  const createProposal = async (suggestion: CompatibilityResult) => {
    const key = [suggestion.fighterA.fighter_id, suggestion.fighterB.fighter_id].sort().join(':');
    setActing(key);
    setError(null);
    setMessage(null);
    const result = await proposeMatch(
      eventId,
      suggestion.fighterA.fighter_id,
      suggestion.fighterB.fighter_id,
      {
        score: suggestion.totalScore,
        scoreBreakdown: { ...suggestion.scoreBreakdown },
        warnings: suggestion.warnings,
        ruleVersion: suggestion.ruleVersion,
      }
    );
    if (result.error) setError(result.error);
    else {
      setMessage(t('events.engine.matchmaking.proposalCreated'));
      await reload();
    }
    setActing(null);
  };

  const approveBout = async (matchId: string) => {
    setActing(matchId);
    setError(null);
    setMessage(null);
    const result = await approveMatchAsBout(matchId);
    if (result.error) setError(result.error);
    else setMessage(t('events.engine.matchmaking.boutApproved'));
    await reload();
    setActing(null);
  };

  if (loading || profile === undefined) {
    return <PageFrame><p className="text-sm text-zinc-500">{t('events.engine.loading.matchmaking')}</p></PageFrame>;
  }

  if (!canManage) {
    return (
      <PageFrame>
        <h1 className="text-3xl font-black uppercase text-zinc-900">{t('events.engine.matchmaking.title')}</h1>
        <p className="mt-3 text-sm text-zinc-600">{t('events.engine.permission.manageEvent')}</p>
        <Link href={`/events/${eventId}`} className="mt-6 inline-block min-h-11 border border-zinc-300 px-4 py-3 text-sm font-bold text-zinc-800">
          {t('events.engine.nav.backToEvent')}
        </Link>
      </PageFrame>
    );
  }

  const eligibleCount = suggestions.filter((suggestion) => suggestion.eligible).length;
  const invalidCount = suggestions.length - eligibleCount;

  return (
    <PageFrame>
      <div className="flex flex-col gap-5 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">{t('events.engine.brand')}</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-zinc-900 sm:text-5xl">{t('events.engine.matchmaking.title')}</h1>
          <p className="mt-2 text-sm text-zinc-600">{event?.event_name}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
          <Link href={`/events/${eventId}/manage/settings`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.settings')}</Link>
          <Link href={`/events/${eventId}/manage/bouts`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.bouts')}</Link>
          <Link href={`/events/${eventId}/manage/print`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.print')}</Link>
          <Link href={`/events/${eventId}/manage/live`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.live')}</Link>
          <Link href={`/events/${eventId}/manage/streaming`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.streaming')}</Link>
          <Link href={`/events/${eventId}`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.event')}</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
        <Metric label={t('events.engine.matchmaking.combinations')} value={suggestions.length} />
        <Metric label={t('events.engine.matchmaking.compatible')} value={eligibleCount} />
        <Metric label={t('events.engine.matchmaking.conflicts')} value={invalidCount} />
        <Metric label={t('events.engine.matchmaking.proposals')} value={matches.filter((match) => match.match_status !== 'cancelled').length} />
      </div>

      {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase text-zinc-900">{t('events.engine.matchmaking.suggestions')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('events.engine.matchmaking.suggestionsHelp')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowInvalid((current) => !current)}
            className="min-h-11 border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-800"
          >
            {showInvalid ? t('events.engine.matchmaking.hideConflicts') : t('events.engine.matchmaking.showConflicts')}
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {visibleSuggestions.length === 0 ? (
            <p className="border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">{t('events.engine.matchmaking.noCombinations')}</p>
          ) : visibleSuggestions.map((suggestion) => {
            const pairKey = [suggestion.fighterA.fighter_id, suggestion.fighterB.fighter_id].sort().join(':');
            const proposed = activePairKeys.has(pairKey);
            return (
              <article key={pairKey} className="border border-zinc-200 bg-white p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                  <FighterCell registration={suggestion.fighterA} />
                  <div className="flex items-center justify-center border-y border-zinc-200 py-2 text-xs font-black uppercase tracking-widest sm:border-x sm:border-y-0 sm:px-4 sm:py-0">VS</div>
                  <FighterCell registration={suggestion.fighterB} />
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase text-zinc-900">
                      {suggestion.eligible ? t('events.engine.matchmaking.compatiblePercent', { score: suggestion.totalScore }) : t('events.engine.matchmaking.notAllowed')}
                    </p>
                    {suggestion.hardFailures.length > 0 && (
                      <p className="mt-1 text-xs text-red-700">{suggestion.hardFailures.map((item) => FAILURE_LABELS[item] ?? item).join(' · ')}</p>
                    )}
                    {suggestion.warnings.length > 0 && (
                      <p className="mt-1 text-xs text-amber-800">{suggestion.warnings.map((item) => WARNING_LABELS[item] ?? item).join(' · ')}</p>
                    )}
                    {suggestion.eligible && (
                      <p className="mt-1 text-xs text-zinc-500">
                        Peso {suggestion.scoreBreakdown.weight}/30 · Experiencia {suggestion.scoreBreakdown.experience}/25 · Edad {suggestion.scoreBreakdown.age}/15 · Rango {suggestion.scoreBreakdown.rank}/20
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!suggestion.eligible || proposed || acting === pairKey}
                    onClick={() => createProposal(suggestion)}
                    className="min-h-11 w-full bg-zinc-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-auto"
                  >
                    {proposed ? t('events.engine.matchmaking.existingProposal') : acting === pairKey ? t('events.engine.matchmaking.saving') : t('events.engine.matchmaking.createProposal')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black uppercase text-zinc-900">{t('events.engine.matchmaking.proposals')}</h2>
        <div className="mt-4 space-y-3">
          {matches.length === 0 ? (
            <p className="border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">{t('events.engine.matchmaking.noProposals')}</p>
          ) : matches.map((match) => (
            <div key={match.id} className="flex flex-col gap-3 border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-bold text-zinc-900">{match.fighter_a?.profiles?.full_name ?? '—'} vs {match.fighter_b?.profiles?.full_name ?? '—'}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{t('events.engine.matchmaking.stateLine', { status: match.match_status, a: match.fighter_a_status, b: match.fighter_b_status })}</p>
              </div>
              {match.match_status === 'confirmed' && !match.approved_at && (
                <button type="button" onClick={() => approveBout(match.id)} disabled={acting === match.id}
                  className="min-h-11 w-full bg-[#C0001E] px-4 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:bg-zinc-300 sm:w-auto">
                  {acting === match.id ? t('events.engine.matchmaking.approving') : t('events.engine.matchmaking.approveBout')}
                </button>
              )}
              {match.approved_at && <span className="self-start border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold uppercase text-emerald-800">{t('events.engine.matchmaking.approvedBout')}</span>}
            </div>
          ))}
        </div>
      </section>
    </PageFrame>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <EventManageFrame>{children}</EventManageFrame>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="bg-white p-4"><p className="text-2xl font-black text-zinc-900">{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p></div>;
}

function FighterCell({ registration }: { registration: CompatibilityResult['fighterA'] }) {
  const { t } = useTranslation('events');
  return (
    <div className="bg-zinc-50 p-4">
      <p className="font-bold text-zinc-900">{registration.fighters?.profiles?.full_name ?? '—'}</p>
      <p className="mt-1 text-xs text-zinc-600">{registration.registered_weight_class ?? registration.fighters?.weight_class ?? t('events.engine.matchmaking.pendingWeight')}</p>
      <p className="mt-1 text-xs text-zinc-600">{registration.registered_discipline ?? t('events.engine.matchmaking.pendingDiscipline')} · {registration.team_name ?? t('events.engine.matchmaking.pendingTeam')}</p>
      <p className="mt-1 text-xs text-zinc-500">
        <InlineCombatRecord wins={registration.record_wins} losses={registration.record_losses} draws={registration.record_draws} winLabel="G" lossLabel="P" drawLabel="E" />
      </p>
    </div>
  );
}
