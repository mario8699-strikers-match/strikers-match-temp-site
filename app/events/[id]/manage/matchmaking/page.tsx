'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineCombatRecord } from '@/components/CombatRecord';
import { EventManageFrame } from '@/components/EventManageFrame';
import { authService } from '@/services/authService';
import { approveMatchAsBout, approveMatchSuggestionAsBout } from '@/services/boutService';
import {
  getEventCompatibilityPool,
  participantName,
  regenerateEventMatchSuggestions,
  reviewMatchSuggestion,
  type CompatibilityResult,
} from '@/services/compatibilityService';
import { supabase } from '@/lib/supabaseClient';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import { advanceGuidedOnboarding } from '@/services/onboardingService';
import {
  getMatchesForEvent,
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
  weight_class_mismatch: 'Categorías de peso incompatibles',
  gender_division_mismatch: 'Divisiones incompatibles',
  same_team: 'Mismo equipo',
  weight_tolerance_exceeded: 'Diferencia de peso excedida',
  age_tolerance_exceeded: 'Diferencia de edad excedida',
  experience_tolerance_exceeded: 'Diferencia de experiencia excedida',
  competition_class_mismatch: 'Amateur/pro incompatible',
  skill_rating_tolerance_exceeded: 'Diferencia de nivel excedida',
  fighter_a_weight_range_exceeded: 'El peso del rival queda fuera del rango del peleador A',
  fighter_b_weight_range_exceeded: 'El peso del rival queda fuera del rango del peleador B',
  recent_opponent: 'Rivales recientes',
};

const WARNING_LABELS: Record<string, string> = {
  exact_weight_missing: 'Falta peso exacto',
  age_missing: 'Falta edad',
  skill_rating_missing: 'Falta evaluación de nivel',
  knockout_record_gap: 'Diferencia relevante en récord KO/TKO',
  special_restrictions_require_review: 'Hay restricciones especiales que revisar',
  recent_fight_requires_review: 'Pelea reciente: revisar descanso y autorización aplicable',
  recent_ko_loss_requires_review: 'Derrota reciente por KO: requiere revisión específica',
  promoter_preferences_require_review: 'Revisar preferencias del promotor configuradas para el evento',
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

  useEffect(() => {
    if (!canManage) return;
    const channel = supabase
      .channel(`event-matchmaking:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_suggestions', filter: `event_id=eq.${eventId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_registrations', filter: `event_id=eq.${eventId}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [canManage, eventId, reload]);

  const visibleSuggestions = useMemo(
    () => suggestions.filter((suggestion) => showInvalid || suggestion.eligible),
    [showInvalid, suggestions]
  );
  const activePairKeys = useMemo(() => new Set(
    matches
      .filter((match) => match.match_status !== 'cancelled')
      .filter((match) => match.fighter_a_registration_id && match.fighter_b_registration_id)
      .map((match) => [match.fighter_a_registration_id!, match.fighter_b_registration_id!].sort().join(':'))
  ), [matches]);

  const confirmSuggestion = async (suggestion: CompatibilityResult) => {
    const key = [suggestion.fighter_a_registration_id, suggestion.fighter_b_registration_id].sort().join(':');
    setActing(key);
    setError(null);
    setMessage(null);
    const result = await approveMatchSuggestionAsBout(suggestion.id);
    if (result.error) setError(result.error);
    else {
      setMessage('Combate confirmado. El gráfico se generó automáticamente.');
      if (profile && !profile.onboarding_completed && !profile.onboarding_dismissed
        && profile.onboarding_event_id === eventId && profile.onboarding_step <= 6) {
        const advancement = await advanceGuidedOnboarding(6, eventId, true);
        if (advancement.data) setProfile(advancement.data);
      }
      await reload();
    }
    setActing(null);
  };

  const regenerate = async () => {
    setActing('regenerate');
    setError(null);
    setMessage(null);
    const result = await regenerateEventMatchSuggestions(eventId);
    if (result.error) setError(result.error);
    else setMessage(`${result.data ?? 0} combinaciones actualizadas.`);
    await reload();
    setActing(null);
  };

  const reviewSuggestion = async (
    suggestion: CompatibilityResult,
    action: 'reject' | 'request_changes' | 'lock' | 'restore'
  ) => {
    let reason: string | undefined;
    if (action === 'reject' || action === 'request_changes') {
      reason = window.prompt(action === 'reject' ? 'Motivo del rechazo' : 'Cambios solicitados')?.trim();
      if (!reason) return;
    }
    setActing(suggestion.id);
    setError(null);
    const result = await reviewMatchSuggestion(suggestion.id, action, reason);
    if (result.error) setError(result.error);
    else setMessage('Revisión guardada.');
    await reload();
    setActing(null);
  };

  const approveBout = async (matchId: string) => {
    setActing(matchId);
    setError(null);
    setMessage(null);
    const result = await approveMatchAsBout(matchId);
    if (result.error) setError(result.error);
    else {
      setMessage(t('events.engine.matchmaking.boutApproved'));
      if (profile && !profile.onboarding_completed && !profile.onboarding_dismissed
        && profile.onboarding_event_id === eventId && profile.onboarding_step <= 6) {
        const advancement = await advanceGuidedOnboarding(6, eventId, true);
        if (advancement.data) setProfile(advancement.data);
      }
    }
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link href={`/events/${eventId}/manage/participants`} className="flex min-h-11 items-center justify-center whitespace-nowrap bg-[#C0001E] px-4 py-3 text-center text-xs font-bold uppercase text-white">Participantes</Link>
          <Link href={`/events/${eventId}/manage/settings`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.settings')}</Link>
          <Link href={`/events/${eventId}/manage/bouts`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.bouts')}</Link>
          <Link href={`/events/${eventId}`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.event')}</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
        <Metric label={t('events.engine.matchmaking.combinations')} value={suggestions.length} />
        <Metric label={t('events.engine.matchmaking.compatible')} value={eligibleCount} />
        <Metric label={t('events.engine.matchmaking.conflicts')} value={invalidCount} />
        <Metric label={t('events.engine.matchmaking.proposals')} value={matches.filter((match) => match.match_status !== 'cancelled').length} />
      </div>

      {eligibleCount === 0 && (
        <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">
            {suggestions.length === 0
              ? 'El matchmaking automático necesita al menos dos participantes listos.'
              : `Strikers Match analizó ${suggestions.length} combinaciones, pero ninguna cumple todavía las reglas del evento.`}
          </p>
          <p className="mt-1">
            La categoría se calcula automáticamente con la disciplina, la edad y el peso del peleador. Completa únicamente los datos faltantes marcados en Participantes; el sistema volverá a analizar y ordenar los enfrentamientos automáticamente.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link href={`/events/${eventId}/manage/participants`} className="inline-flex min-h-11 items-center justify-center bg-zinc-900 px-4 py-3 text-xs font-bold uppercase text-white">
              Completar participantes
            </Link>
            {invalidCount > 0 && !showInvalid && (
              <button type="button" onClick={() => setShowInvalid(true)} className="min-h-11 border border-amber-300 bg-white px-4 py-3 text-xs font-bold uppercase text-amber-950">
                Ver por qué no coinciden
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase text-zinc-900">{t('events.engine.matchmaking.suggestions')}</h2>
            <p className="mt-1 text-sm text-zinc-500">Strikers Match genera y ordena los enfrentamientos automáticamente. Tú confirmas, rechazas o solicitas cambios.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={regenerate} disabled={acting === 'regenerate'} className="min-h-11 bg-zinc-900 px-4 py-3 text-sm font-bold text-white disabled:bg-zinc-300">
              {acting === 'regenerate' ? 'Calculando…' : 'Regenerar sugerencias'}
            </button>
            <button type="button" onClick={() => setShowInvalid((current) => !current)} className="min-h-11 border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-800">
              {showInvalid ? t('events.engine.matchmaking.hideConflicts') : t('events.engine.matchmaking.showConflicts')}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {visibleSuggestions.length === 0 ? (
            <p className="border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">{t('events.engine.matchmaking.noCombinations')}</p>
          ) : visibleSuggestions.map((suggestion) => {
            const pairKey = [suggestion.fighter_a_registration_id, suggestion.fighter_b_registration_id].sort().join(':');
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
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                        {Object.entries(suggestion.scoreBreakdown).map(([label, value]) => (
                          <span key={label} className="border border-zinc-200 px-2 py-1">{scoreLabel(label)}: {value}</span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-zinc-500">Encuentros previos entre ambos: {suggestion.previous_matchup_count} · Estado: {suggestion.status}</p>
                    {suggestion.review_reason && <p className="mt-1 text-xs font-medium text-zinc-700">Nota: {suggestion.review_reason}</p>}
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                    <button type="button" disabled={!suggestion.eligible || proposed || acting === pairKey || suggestion.status === 'rejected'} onClick={() => confirmSuggestion(suggestion)} className="min-h-11 bg-[#C0001E] px-4 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:bg-zinc-300">
                      {proposed ? 'Combate creado' : acting === pairKey ? 'Confirmando…' : 'Confirmar combate'}
                    </button>
                    {suggestion.status === 'locked' ? (
                      <ReviewButton label="Desbloquear" disabled={acting === suggestion.id} onClick={() => reviewSuggestion(suggestion, 'restore')} />
                    ) : (
                      <ReviewButton label="Fijar" disabled={acting === suggestion.id} onClick={() => reviewSuggestion(suggestion, 'lock')} />
                    )}
                    <ReviewButton label="Pedir cambios" disabled={acting === suggestion.id} onClick={() => reviewSuggestion(suggestion, 'request_changes')} />
                    {suggestion.status === 'rejected'
                      ? <ReviewButton label="Restaurar" disabled={acting === suggestion.id} onClick={() => reviewSuggestion(suggestion, 'restore')} />
                      : <ReviewButton label="Rechazar" danger disabled={acting === suggestion.id} onClick={() => reviewSuggestion(suggestion, 'reject')} />}
                  </div>
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
                <p className="font-bold text-zinc-900">{match.fighter_a_registration?.display_name ?? match.fighter_a?.profiles?.full_name ?? '—'} vs {match.fighter_b_registration?.display_name ?? match.fighter_b?.profiles?.full_name ?? '—'}</p>
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
      <p className="font-bold text-zinc-900">{participantName(registration)}</p>
      <p className="mt-1 text-xs text-zinc-600">{registration.registered_weight_class ?? registration.fighters?.weight_class ?? registration.manual_fighters?.weight_class ?? t('events.engine.matchmaking.pendingWeight')} · {formatKg(registration.weigh_in_weight)} real</p>
      <p className="mt-1 text-xs text-zinc-600">{registration.registered_discipline ?? t('events.engine.matchmaking.pendingDiscipline')} · {registration.ruleset ?? 'reglamento pendiente'}</p>
      <p className="mt-1 text-xs text-zinc-600">{registration.experience_level ?? 'nivel pendiente'} · habilidad {registration.skill_rating ?? '—'}/10 · {registration.gender_division ?? 'división pendiente'} · {registration.age_at_event ?? '—'} años</p>
      <p className="mt-1 text-xs text-zinc-600">{registration.team_name ?? t('events.engine.matchmaking.pendingTeam')} · {[registration.city, registration.state].filter(Boolean).join(', ') || 'ubicación pendiente'}</p>
      <p className="mt-1 text-xs text-zinc-500">
        <InlineCombatRecord wins={registration.record_wins} losses={registration.record_losses} draws={registration.record_draws} winLabel="G" lossLabel="P" drawLabel="E" />
      </p>
      <p className="mt-1 text-xs text-zinc-500">KO/TKO: {registration.ko_wins + registration.tko_wins} a favor · {registration.ko_losses + registration.tko_losses} en contra</p>
      <p className="mt-1 text-xs text-zinc-500">Solicitado: {formatKg(registration.requested_weight_kg)} · rango: {formatRange(registration.acceptable_weight_min_kg, registration.acceptable_weight_max_kg)}</p>
      <p className="mt-1 text-xs text-zinc-500">Disponibilidad: {registration.availability_confirmed ? 'confirmada' : 'pendiente'}{registration.available_from || registration.available_to ? ` (${registration.available_from ?? 'ahora'}–${registration.available_to ?? 'abierta'})` : ''}</p>
      {registration.special_restrictions.length > 0 && <p className="mt-2 border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-900">Restricciones: {registration.special_restrictions.join(' · ')}</p>}
    </div>
  );
}

function ReviewButton({ label, onClick, disabled, danger = false }: { label: string; onClick: () => void; disabled: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`min-h-11 border px-3 py-2 text-xs font-bold uppercase disabled:opacity-50 ${danger ? 'border-red-200 text-red-700' : 'border-zinc-300 text-zinc-700'}`}>{label}</button>;
}

function scoreLabel(value: string) {
  return ({ weight: 'Peso', age: 'Edad', experience: 'Experiencia', record: 'Récord', knockout: 'KO/TKO', skill: 'Nivel', opponentHistory: 'Historial', location: 'Ubicación', availability: 'Disponibilidad' } as Record<string, string>)[value] ?? value;
}

function formatKg(value: number | null) {
  return value == null ? '—' : `${value} kg`;
}

function formatRange(minimum: number | null, maximum: number | null) {
  if (minimum == null && maximum == null) return '—';
  return `${minimum ?? '—'}–${maximum ?? '—'} kg`;
}
