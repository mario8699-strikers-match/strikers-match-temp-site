'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineCombatRecord } from '@/components/CombatRecord';
import { EligibilityStatus } from '@/components/EligibilityStatus';
import { EventManageFrame } from '@/components/EventManageFrame';
import { getCombatWeightGroups } from '@/lib/combatWeightCategories';
import { disciplineMatches, sortDisciplines } from '@/lib/disciplines';
import { searchByClosestName } from '@/lib/personNameSearch';
import { authService } from '@/services/authService';
import {
  approveManualPairingAsBout,
  approveMatchAsBout,
  approveMatchSuggestionAsBout,
} from '@/services/boutService';
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
import { getEventRegistrations } from '@/services/registrationService';
import type { Event, Profile, RegistrationWithFighter } from '@/types';

interface WeightCategoryGroup {
  key: string;
  label: string;
  discipline: string;
  registrations: RegistrationWithFighter[];
}

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
  exact_weight_missing: 'Falta el peso real registrado',
  age_tolerance_exceeded: 'Diferencia de edad excedida',
  experience_tolerance_exceeded: 'Diferencia de experiencia excedida',
  competition_class_mismatch: 'Amateur/pro incompatible',
  skill_rating_tolerance_exceeded: 'Diferencia de nivel excedida',
  fighter_a_weight_range_exceeded: 'El peso del rival queda fuera del rango del peleador A',
  fighter_b_weight_range_exceeded: 'El peso del rival queda fuera del rango del peleador B',
  recent_opponent: 'Rivales recientes',
};

const WARNING_LABELS: Record<string, string> = {
  weight_class_difference_within_tolerance: 'Categorías distintas; los pesos reales están dentro de la tolerancia',
  experience_tolerance_exceeded: 'La diferencia de experiencia requiere revisión del organizador',
  skill_rating_tolerance_exceeded: 'La diferencia de nivel requiere revisión del organizador',
  recent_opponent: 'Ya se enfrentaron recientemente; revisar antes de confirmar la revancha',
  exact_weight_missing: 'Falta peso exacto',
  age_missing: 'Falta edad',
  skill_rating_missing: 'Falta evaluación de nivel',
  knockout_record_gap: 'Diferencia relevante en récord KO/TKO',
  special_restrictions_require_review: 'Hay restricciones especiales que revisar',
  recent_fight_requires_review: 'Pelea reciente: revisar descanso y autorización aplicable',
  recent_ko_loss_requires_review: 'Derrota reciente por KO: requiere revisión específica',
  promoter_preferences_require_review: 'Revisar preferencias del promotor configuradas para el evento',
};

const MANUAL_PAIRING_BLOCKERS = new Set([
  'same_fighter',
  'different_event',
  'fighter_a_not_eligible',
  'fighter_b_not_eligible',
  'fighter_a_already_assigned',
  'fighter_b_already_assigned',
  'discipline_mismatch',
  'ruleset_mismatch',
  'gender_division_mismatch',
  'competition_class_mismatch',
]);

export default function MatchmakingBoardPage() {
  const { t } = useTranslation('events');
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [suggestions, setSuggestions] = useState<CompatibilityResult[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationWithFighter[]>([]);
  const [matches, setMatches] = useState<MatchWithContext[]>([]);
  const [showInvalid, setShowInvalid] = useState(false);
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [manualRegistrationAId, setManualRegistrationAId] = useState('');
  const [manualRegistrationBId, setManualRegistrationBId] = useState('');
  const [manualSearchA, setManualSearchA] = useState('');
  const [manualSearchB, setManualSearchB] = useState('');
  const [manualOverrideReason, setManualOverrideReason] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [poolResult, registrationResult, matchResult] = await Promise.all([
      getEventCompatibilityPool(eventId),
      getEventRegistrations(eventId),
      getMatchesForEvent(eventId),
    ]);
    const loadError = poolResult.error ?? registrationResult.error ?? matchResult.error;
    if (loadError) setError(loadError);
    setSuggestions(poolResult.data ?? []);
    setRegistrations(registrationResult.data ?? []);
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

  const disciplineOptions = useMemo(() => sortDisciplines([
    ...(event?.disciplines_needed ?? []),
    ...registrations.map((registration) => registration.registered_discipline ?? ''),
  ]), [event?.disciplines_needed, registrations]);
  const suggestionsForDiscipline = useMemo(
    () => disciplineFilter === 'all'
      ? suggestions
      : suggestions.filter((suggestion) => (
        disciplineMatches([suggestion.fighterA.registered_discipline], disciplineFilter)
        || disciplineMatches([suggestion.fighterB.registered_discipline], disciplineFilter)
      )),
    [disciplineFilter, suggestions]
  );
  const visibleSuggestions = useMemo(
    () => suggestionsForDiscipline.filter((suggestion) => showInvalid || suggestion.eligible),
    [showInvalid, suggestionsForDiscipline]
  );
  const activePairKeys = useMemo(() => new Set(
    matches
      .filter((match) => match.match_status !== 'cancelled')
      .filter((match) => match.fighter_a_registration_id && match.fighter_b_registration_id)
      .map((match) => [match.fighter_a_registration_id!, match.fighter_b_registration_id!].sort().join(':'))
  ), [matches]);
  const activeAssignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const match of matches) {
      if (match.match_status === 'cancelled') continue;
      for (const registrationId of [match.fighter_a_registration_id, match.fighter_b_registration_id]) {
        if (registrationId) counts.set(registrationId, (counts.get(registrationId) ?? 0) + 1);
      }
    }
    return counts;
  }, [matches]);
  const suggestionByPair = useMemo(() => new Map(
    suggestions.map((suggestion) => [suggestionPairKey(
      suggestion.fighter_a_registration_id,
      suggestion.fighter_b_registration_id
    ), suggestion])
  ), [suggestions]);
  const categoryGroups = useMemo(() => groupRegistrationsByWeightCategory(registrations), [registrations]);
  const categoryGroupsForDiscipline = useMemo(
    () => disciplineFilter === 'all'
      ? categoryGroups
      : categoryGroups.filter((group) => disciplineMatches([group.discipline], disciplineFilter)),
    [categoryGroups, disciplineFilter]
  );
  const visibleCategoryGroups = useMemo(
    () => categoryFilter === 'all'
      ? categoryGroupsForDiscipline
      : categoryGroupsForDiscipline.filter((group) => group.key === categoryFilter),
    [categoryFilter, categoryGroupsForDiscipline]
  );
  const registrationById = useMemo(
    () => new Map(registrations.map((registration) => [registration.id, registration])),
    [registrations]
  );
  const visibleMatches = useMemo(
    () => disciplineFilter === 'all'
      ? matches
      : matches.filter((match) => {
        const registrationA = match.fighter_a_registration_id
          ? registrationById.get(match.fighter_a_registration_id)
          : null;
        const registrationB = match.fighter_b_registration_id
          ? registrationById.get(match.fighter_b_registration_id)
          : null;
        return disciplineMatches([registrationA?.registered_discipline], disciplineFilter)
          || disciplineMatches([registrationB?.registered_discipline], disciplineFilter);
      }),
    [disciplineFilter, matches, registrationById]
  );
  const selectedRegistration = useMemo(
    () => registrations.find((registration) => registration.id === selectedRegistrationId) ?? null,
    [registrations, selectedRegistrationId]
  );
  const manualPairingCandidates = useMemo(
    () => registrations
      .filter((registration) => registration.eligibility_status === 'eligible'
        && ['confirmed', 'waived'].includes(registration.payment_status))
      .sort((registrationA, registrationB) => participantName(registrationA).localeCompare(
        participantName(registrationB),
        'es',
        { sensitivity: 'base' }
      )),
    [registrations]
  );
  const manualRegistrationA = manualRegistrationAId
    ? registrationById.get(manualRegistrationAId) ?? null
    : null;
  const manualRegistrationB = manualRegistrationBId
    ? registrationById.get(manualRegistrationBId) ?? null
    : null;
  const manualCandidatesA = useMemo(
    () => searchManualPairingCandidates(manualPairingCandidates, manualSearchA),
    [manualPairingCandidates, manualSearchA]
  );
  const manualCandidatesB = useMemo(
    () => searchManualPairingCandidates(manualPairingCandidates, manualSearchB)
      .filter((registration) => registration.id !== manualRegistrationAId),
    [manualPairingCandidates, manualRegistrationAId, manualSearchB]
  );
  const manualPairKey = manualRegistrationA && manualRegistrationB
    ? suggestionPairKey(manualRegistrationA.id, manualRegistrationB.id)
    : null;
  const manualSuggestion = manualPairKey ? suggestionByPair.get(manualPairKey) : undefined;
  const manualBlockingReasons = useMemo(
    () => manualPairingBlockingReasons(
      manualRegistrationA,
      manualRegistrationB,
      manualSuggestion,
      manualPairKey ? activePairKeys.has(manualPairKey) : false
    ),
    [activePairKeys, manualPairKey, manualRegistrationA, manualRegistrationB, manualSuggestion]
  );
  const manualOverrideFailures = manualSuggestion?.hardFailures.filter(
    (failure) => !MANUAL_PAIRING_BLOCKERS.has(failure)
  ) ?? [];
  const manualNeedsReason = Boolean(
    manualRegistrationA
    && manualRegistrationB
    && (!manualSuggestion
      || !manualSuggestion.eligible
      || !['active', 'locked', 'changes_requested'].includes(manualSuggestion.status))
  );

  const confirmSuggestion = async (suggestion: CompatibilityResult) => {
    const key = [suggestion.fighter_a_registration_id, suggestion.fighter_b_registration_id].sort().join(':');
    setActing(key);
    setError(null);
    setMessage(null);
    const result = await approveMatchSuggestionAsBout(suggestion.id);
    if (result.error) setError(result.error);
    else {
      setMessage('Combate confirmado. El gráfico se generó automáticamente.');
      setSelectedRegistrationId(null);
      if (profile && !profile.onboarding_completed && !profile.onboarding_dismissed
        && profile.onboarding_event_id === eventId && profile.onboarding_step <= 6) {
        const advancement = await advanceGuidedOnboarding(6, eventId, true);
        if (advancement.data) setProfile(advancement.data);
      }
      await reload();
    }
    setActing(null);
  };

  const selectRegistrationForPairing = (registrationId: string) => {
    setError(null);
    setMessage(null);
    setSelectedRegistrationId(registrationId);
    // A valid tolerance-based rival may sit in an adjacent stored category.
    // Show every category after the first selection instead of trapping the
    // operator inside the selected fighter's label group.
    setCategoryFilter('all');
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

  const confirmManualPairing = async () => {
    if (!manualRegistrationA || !manualRegistrationB || !manualPairKey) {
      setError('Selecciona dos peleadores para crear el combate manual.');
      return;
    }
    if (manualBlockingReasons.length > 0) {
      setError(manualBlockingReasons.join(' · '));
      return;
    }
    if (manualNeedsReason && !manualOverrideReason.trim()) {
      setError('Escribe el motivo para aprobar manualmente esta combinación.');
      return;
    }

    const actingKey = `manual:${manualPairKey}`;
    setActing(actingKey);
    setError(null);
    setMessage(null);
    const result = await approveManualPairingAsBout(
      eventId,
      manualRegistrationA.id,
      manualRegistrationB.id,
      manualOverrideReason
    );

    if (result.error) {
      setError(result.error);
    } else {
      setMessage(`Combate manual confirmado: ${participantName(manualRegistrationA)} vs ${participantName(manualRegistrationB)}. El gráfico se generó automáticamente.`);
      setManualRegistrationAId('');
      setManualRegistrationBId('');
      setManualSearchA('');
      setManualSearchB('');
      setManualOverrideReason('');
      setSelectedRegistrationId(null);
      if (profile && !profile.onboarding_completed && !profile.onboarding_dismissed
        && profile.onboarding_event_id === eventId && profile.onboarding_step <= 6) {
        const advancement = await advanceGuidedOnboarding(6, eventId, true);
        if (advancement.data) setProfile(advancement.data);
      }
      await reload();
    }
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
            El sistema compara el peso real y la edad usando las tolerancias del evento; la categoría guardada sirve como referencia y no bloquea una combinación válida. Completa únicamente los datos faltantes marcados en Participantes.
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

      <section className="border-2 border-zinc-900 bg-white p-4 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C0001E]">Control del organizador</p>
          <h2 className="mt-1 text-2xl font-black uppercase text-zinc-900">Emparejamiento manual</h2>
          <p className="mt-2 max-w-4xl text-sm text-zinc-600">
            Selecciona directamente dos participantes elegibles y con pago confirmado. Puedes aprobar diferencias de categoría, peso, edad o experiencia con un motivo. Género, disciplina, clase amateur/pro, reglamentos incompatibles y límites de combates nunca se pueden omitir.
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-900">
            Tu confirmación crea el combate oficial inmediatamente; los peleadores no necesitan aceptarlo después.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="manual-fighter-search-a" className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">Buscar peleador A por nombre</span>
              <input
                id="manual-fighter-search-a"
                type="search"
                value={manualSearchA}
                onChange={(input) => {
                  setManualSearchA(input.target.value);
                  setManualRegistrationAId('');
                  setManualOverrideReason('');
                  setError(null);
                }}
                placeholder="Escribe el nombre del peleador…"
                autoComplete="off"
                className="min-h-12 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
              />
            </label>
            <select
              aria-label="Resultados para peleador A"
              value={manualRegistrationAId}
              onChange={(input) => {
                const nextId = input.target.value;
                setManualRegistrationAId(nextId);
                const selected = registrationById.get(nextId);
                if (selected) setManualSearchA(participantName(selected));
                if (nextId === manualRegistrationBId) {
                  setManualRegistrationBId('');
                  setManualSearchB('');
                }
                setManualOverrideReason('');
                setError(null);
              }}
              disabled={!manualSearchA.trim() || manualCandidatesA.length === 0}
              className="mt-2 min-h-12 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            >
              <option value="">{manualSearchA.trim() ? 'Seleccionar de los resultados…' : 'Primero escribe un nombre…'}</option>
              {manualCandidatesA.map((registration) => (
                <option key={registration.id} value={registration.id}>
                  {manualPairingOptionLabel(registration, activeAssignmentCounts.get(registration.id) ?? 0)}
                </option>
              ))}
            </select>
            <SearchResultCount query={manualSearchA} count={manualCandidatesA.length} />
          </div>

          <div>
            <label htmlFor="manual-fighter-search-b" className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">Buscar peleador B por nombre</span>
              <input
                id="manual-fighter-search-b"
                type="search"
                value={manualSearchB}
                onChange={(input) => {
                  setManualSearchB(input.target.value);
                  setManualRegistrationBId('');
                  setManualOverrideReason('');
                  setError(null);
                }}
                placeholder="Escribe el nombre del rival…"
                autoComplete="off"
                className="min-h-12 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
              />
            </label>
            <select
              aria-label="Resultados para peleador B"
              value={manualRegistrationBId}
              onChange={(input) => {
                const nextId = input.target.value;
                setManualRegistrationBId(nextId);
                const selected = registrationById.get(nextId);
                if (selected) setManualSearchB(participantName(selected));
                setManualOverrideReason('');
                setError(null);
              }}
              disabled={!manualSearchB.trim() || manualCandidatesB.length === 0}
              className="mt-2 min-h-12 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            >
              <option value="">{manualSearchB.trim() ? 'Seleccionar de los resultados…' : 'Primero escribe un nombre…'}</option>
              {manualCandidatesB.map((registration) => (
                <option key={registration.id} value={registration.id}>
                  {manualPairingOptionLabel(registration, activeAssignmentCounts.get(registration.id) ?? 0)}
                </option>
              ))}
            </select>
            <SearchResultCount query={manualSearchB} count={manualCandidatesB.length} />
          </div>
        </div>

        {manualRegistrationA && manualRegistrationB && (
          <div className="mt-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              <FighterCell registration={manualRegistrationA} />
              <div className="flex items-center justify-center border-y border-zinc-200 py-2 text-xs font-black uppercase tracking-widest sm:border-x sm:border-y-0 sm:px-4 sm:py-0">VS</div>
              <FighterCell registration={manualRegistrationB} />
            </div>

            <div className="mt-4 border-t border-zinc-200 pt-4">
              {manualSuggestion ? (
                <div className={manualSuggestion.eligible ? 'text-emerald-800' : 'text-amber-900'}>
                  <p className="text-sm font-black uppercase">
                    {manualSuggestion.eligible
                      ? `Compatibilidad automática: ${manualSuggestion.totalScore}%`
                      : 'La combinación requiere decisión manual'}
                  </p>
                  {manualSuggestion.hardFailures.length > 0 && (
                    <p className="mt-1 text-xs">
                      {manualSuggestion.hardFailures.map((failure) => FAILURE_LABELS[failure] ?? failure).join(' · ')}
                    </p>
                  )}
                  {manualSuggestion.warnings.length > 0 && (
                    <p className="mt-1 text-xs">
                      {manualSuggestion.warnings.map((warning) => WARNING_LABELS[warning] ?? warning).join(' · ')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm font-bold text-amber-900">No existe una recomendación automática para esta pareja; puedes aprobarla manualmente con un motivo.</p>
              )}

              {manualOverrideFailures.length > 0 && manualBlockingReasons.length === 0 && (
                <p className="mt-3 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  Vas a omitir estas reglas consultivas: {manualOverrideFailures.map((failure) => FAILURE_LABELS[failure] ?? failure).join(' · ')}.
                </p>
              )}

              {manualBlockingReasons.length > 0 && (
                <p className="mt-3 border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                  No se puede crear este combate: {manualBlockingReasons.join(' · ')}
                </p>
              )}

              {manualNeedsReason && manualBlockingReasons.length === 0 && (
                <label className="mt-4 block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">Motivo del ajuste manual</span>
                  <input
                    type="text"
                    value={manualOverrideReason}
                    onChange={(input) => setManualOverrideReason(input.target.value)}
                    placeholder="Ej. Pesos revisados y combate aprobado por el organizador"
                    className="min-h-12 w-full border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                  />
                </label>
              )}

              <button
                type="button"
                disabled={manualBlockingReasons.length > 0
                  || (manualNeedsReason && !manualOverrideReason.trim())
                  || acting === `manual:${manualPairKey}`}
                onClick={confirmManualPairing}
                className="mt-4 min-h-12 w-full bg-[#C0001E] px-5 py-3 text-sm font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-auto"
              >
                {acting === `manual:${manualPairKey}` ? 'Creando combate…' : 'Confirmar combate manual'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="border border-zinc-200 bg-zinc-50 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C0001E]">Vista rápida</p>
            <h2 className="mt-1 text-2xl font-black uppercase text-zinc-900">Peleadores por categoría</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              Revisa todos los participantes del evento por disciplina, edad y peso. Al elegir un peleador se muestran también rivales de categorías vecinas que cumplen las tolerancias configuradas.
            </p>
          </div>
          <div className="grid min-w-64 grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[34rem]">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">Disciplina</span>
              <select
                value={disciplineFilter}
                onChange={(input) => {
                  setDisciplineFilter(input.target.value);
                  setCategoryFilter('all');
                  setSelectedRegistrationId(null);
                }}
                className="min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
              >
                <option value="all">Todas las disciplinas</option>
                {disciplineOptions.map((discipline) => (
                  <option key={discipline} value={discipline}>{discipline}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">Categoría</span>
              <select
                value={categoryFilter}
                onChange={(input) => {
                  setCategoryFilter(input.target.value);
                  setSelectedRegistrationId(null);
                }}
                className="min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
              >
                <option value="all">Todas las categorías ({categoryGroupsForDiscipline.reduce((total, group) => total + group.registrations.length, 0)})</option>
                {categoryGroupsForDiscipline.map((group) => (
                  <option key={group.key} value={group.key}>{group.label} ({group.registrations.length})</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {selectedRegistrationId && selectedRegistration && (
          <div className="mt-4 flex flex-col gap-3 border border-[#C0001E]/30 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-700">
              <span className="font-bold text-zinc-950">Primer peleador seleccionado:</span>{' '}
              {participantName(selectedRegistration)}. Elige cualquier rival habilitado por peso real, edad y las demás reglas del evento.
            </p>
            <button
              type="button"
              onClick={() => setSelectedRegistrationId(null)}
              className="min-h-11 border border-zinc-300 px-4 py-2 text-xs font-bold uppercase text-zinc-700"
            >
              Cancelar selección
            </button>
          </div>
        )}

        <div className="mt-5 space-y-5">
          {visibleCategoryGroups.length === 0 ? (
            <p className="border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500">
              Aún no hay participantes registrados para mostrar por categoría.
            </p>
          ) : visibleCategoryGroups.map((group) => (
            <div key={group.key} className="border border-zinc-200 bg-white">
              <div className="flex flex-col gap-1 border-b border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-black uppercase text-zinc-900">{group.label}</h3>
                <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  {group.registrations.length} {group.registrations.length === 1 ? 'peleador' : 'peleadores'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-px bg-zinc-200 md:grid-cols-2 xl:grid-cols-3">
                {group.registrations.map((registration) => {
                  const selected = registration.id === selectedRegistrationId;
                  const pairKey = selectedRegistrationId
                    ? suggestionPairKey(selectedRegistrationId, registration.id)
                    : null;
                  const suggestion = pairKey ? suggestionByPair.get(pairKey) : undefined;
                  const pairAlreadyCreated = pairKey ? activePairKeys.has(pairKey) : false;
                  const canCreatePair = suggestionCanCreateBout(suggestion, pairAlreadyCreated);
                  const canStartPairing = registration.eligibility_status === 'eligible'
                    && registrations.some((candidate) => {
                      if (candidate.id === registration.id) return false;
                      const candidatePairKey = suggestionPairKey(registration.id, candidate.id);
                      return suggestionCanCreateBout(
                        suggestionByPair.get(candidatePairKey),
                        activePairKeys.has(candidatePairKey)
                      );
                    });
                  const activeAssignments = activeAssignmentCounts.get(registration.id) ?? 0;

                  return (
                    <article key={registration.id} className={`flex min-h-full flex-col p-4 ${selected ? 'bg-red-50 ring-2 ring-inset ring-[#C0001E]' : 'bg-white'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-zinc-950">{participantName(registration)}</p>
                          <p className="mt-1 text-xs text-zinc-600">
                            {formatKg(registration.weigh_in_weight)} · {registration.age_at_event ?? '—'} años · {registration.gender_division ?? 'división pendiente'}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {registration.experience_level ?? 'nivel pendiente'} · {registration.team_name ?? 'equipo pendiente'}
                          </p>
                        </div>
                        {activeAssignments > 0 && (
                          <span className="shrink-0 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase text-white">
                            {activeAssignments} {activeAssignments === 1 ? 'combate' : 'combates'}
                          </span>
                        )}
                      </div>

                      <EligibilityStatus
                        status={registration.eligibility_status}
                        reasons={registration.eligibility_reasons}
                      />

                      <div className="mt-auto pt-4">
                        {!selectedRegistrationId && registration.eligibility_status !== 'eligible' ? (
                          <Link
                            href={`/events/${eventId}/manage/participants`}
                            className="flex min-h-11 w-full items-center justify-center border border-zinc-300 px-3 py-2 text-center text-xs font-bold uppercase text-zinc-700"
                          >
                            Completar información
                          </Link>
                        ) : !selectedRegistrationId ? (
                          <button
                            type="button"
                            disabled={!canStartPairing}
                            onClick={() => selectRegistrationForPairing(registration.id)}
                            className="min-h-11 w-full bg-zinc-900 px-3 py-2 text-xs font-bold uppercase text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                          >
                            {canStartPairing ? 'Elegir para emparejar' : 'Sin rival compatible'}
                          </button>
                        ) : selected ? (
                          <button
                            type="button"
                            onClick={() => setSelectedRegistrationId(null)}
                            className="min-h-11 w-full border border-[#C0001E] px-3 py-2 text-xs font-bold uppercase text-[#C0001E]"
                          >
                            Seleccionado · cancelar
                          </button>
                        ) : canCreatePair && suggestion ? (
                          <button
                            type="button"
                            disabled={acting === pairKey}
                            onClick={() => confirmSuggestion(suggestion)}
                            className="min-h-11 w-full bg-[#C0001E] px-3 py-2 text-xs font-bold uppercase text-white disabled:bg-zinc-300"
                          >
                            {acting === pairKey ? 'Creando combate…' : `Crear combate · ${suggestion.totalScore}%`}
                          </button>
                        ) : (
                          <div>
                            <button
                              type="button"
                              disabled
                              className="min-h-11 w-full cursor-not-allowed bg-zinc-200 px-3 py-2 text-xs font-bold uppercase text-zinc-500"
                            >
                              {pairAlreadyCreated ? 'Combate creado' : 'No compatible'}
                            </button>
                            {suggestion && suggestion.hardFailures.length > 0 && (
                              <p className="mt-2 text-xs text-red-700">
                                {suggestion.hardFailures.slice(0, 2).map((item) => FAILURE_LABELS[item] ?? item).join(' · ')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link href={`/events/${eventId}/manage/participants`} className="inline-flex min-h-11 items-center justify-center border border-zinc-300 bg-white px-4 py-3 text-xs font-bold uppercase text-zinc-800">
            Completar datos de peleadores
          </Link>
          <button type="button" onClick={regenerate} disabled={acting === 'regenerate'} className="min-h-11 bg-zinc-900 px-4 py-3 text-xs font-bold uppercase text-white disabled:bg-zinc-300">
            {acting === 'regenerate' ? 'Calculando…' : 'Actualizar compatibilidad'}
          </button>
        </div>
      </section>

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
          {visibleMatches.length === 0 ? (
            <p className="border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">{t('events.engine.matchmaking.noProposals')}</p>
          ) : visibleMatches.map((match) => (
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
  const weightCategory = registration.registered_weight_class
    ?? registration.fighters?.weight_class
    ?? registration.manual_fighters?.weight_class
    ?? (registration.weigh_in_weight != null ? 'Categoría flexible por peso real' : t('events.engine.matchmaking.pendingWeight'));
  return (
    <div className="bg-zinc-50 p-4">
      <p className="font-bold text-zinc-900">{participantName(registration)}</p>
      <p className="mt-1 text-xs text-zinc-600">{weightCategory} · {formatKg(registration.weigh_in_weight)} real</p>
      <p className="mt-1 text-xs text-zinc-600">{registration.registered_discipline ?? t('events.engine.matchmaking.pendingDiscipline')} · {registration.ruleset ?? 'reglamento pendiente'}</p>
      <p className="mt-1 text-xs text-zinc-600">{registration.experience_level ?? 'nivel pendiente'} · habilidad {registration.skill_rating ?? '—'}/10 · {registration.gender_division ?? 'división pendiente'} · {registration.age_at_event ?? '—'} años</p>
      <p className="mt-1 text-xs text-zinc-600">{registration.team_name ?? t('events.engine.matchmaking.pendingTeam')} · {[registration.city, registration.state].filter(Boolean).join(', ') || 'ubicación pendiente'}</p>
      <p className="mt-1 text-xs text-zinc-500">
        <InlineCombatRecord wins={registration.record_wins} losses={registration.record_losses} draws={registration.record_draws} winLabel="G" lossLabel="P" drawLabel="E" />
      </p>
      <p className="mt-1 text-xs text-zinc-500">KO/TKO: {registration.ko_wins + registration.tko_wins} a favor · {registration.ko_losses + registration.tko_losses} en contra</p>
      <p className="mt-1 text-xs text-zinc-500">Rango aceptable: {formatRange(registration.acceptable_weight_min_kg, registration.acceptable_weight_max_kg)}</p>
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

function SearchResultCount({ query, count }: { query: string; count: number }) {
  if (!query.trim()) {
    return <p className="mt-1 text-xs text-zinc-500">Escribe un nombre para filtrar la lista.</p>;
  }
  return (
    <p className={`mt-1 text-xs ${count > 0 ? 'text-zinc-500' : 'font-medium text-amber-800'}`}>
      {count > 0
        ? `${count} ${count === 1 ? 'peleador encontrado' : 'peleadores encontrados'}`
        : 'No se encontraron peleadores con ese nombre.'}
    </p>
  );
}

function searchManualPairingCandidates(
  registrations: RegistrationWithFighter[],
  query: string
) {
  return searchByClosestName(registrations, query, participantName);
}

function manualPairingOptionLabel(
  registration: RegistrationWithFighter,
  activeAssignments: number
) {
  const details = [
    registration.registered_discipline,
    formatKg(registration.weigh_in_weight),
    registration.registered_weight_class,
    registration.gender_division,
    activeAssignments > 0
      ? `${activeAssignments} ${activeAssignments === 1 ? 'combate activo' : 'combates activos'}`
      : null,
  ].filter(Boolean);
  return `${participantName(registration)}${details.length > 0 ? ` · ${details.join(' · ')}` : ''}`;
}

function manualPairingBlockingReasons(
  registrationA: RegistrationWithFighter | null,
  registrationB: RegistrationWithFighter | null,
  suggestion: CompatibilityResult | undefined,
  pairAlreadyCreated: boolean
) {
  if (!registrationA || !registrationB) return [];
  const reasons: string[] = [];

  if (registrationA.id === registrationB.id) reasons.push('Selecciona dos peleadores diferentes.');
  if (registrationA.eligibility_status !== 'eligible' || registrationB.eligibility_status !== 'eligible') {
    reasons.push('Ambos peleadores deben estar marcados como elegibles.');
  }
  if (!['confirmed', 'waived'].includes(registrationA.payment_status)
    || !['confirmed', 'waived'].includes(registrationB.payment_status)) {
    reasons.push('Ambos peleadores deben tener el pago confirmado o exento.');
  }
  if (!registrationA.registered_discipline
    || !registrationB.registered_discipline
    || !disciplineMatches([registrationA.registered_discipline], registrationB.registered_discipline)) {
    reasons.push('Las disciplinas son diferentes.');
  }

  const genderA = canonicalGenderDivision(registrationA.gender_division);
  const genderB = canonicalGenderDivision(registrationB.gender_division);
  if (!genderA || !genderB) reasons.push('Ambos peleadores necesitan una división de género válida.');
  else if (genderA !== genderB) reasons.push('No se permiten combates entre divisiones de género diferentes.');

  const experienceA = registrationA.experience_level?.trim().toLocaleLowerCase('es-MX');
  const experienceB = registrationB.experience_level?.trim().toLocaleLowerCase('es-MX');
  if (!experienceA || !experienceB) reasons.push('Ambos peleadores necesitan una clase amateur o profesional.');
  else if (experienceA !== experienceB) reasons.push('No se permite mezclar clases amateur y profesional.');

  const rulesetA = registrationA.ruleset?.trim().toLocaleLowerCase('es-MX');
  const rulesetB = registrationB.ruleset?.trim().toLocaleLowerCase('es-MX');
  if (rulesetA && rulesetB && rulesetA !== rulesetB) {
    reasons.push('Los reglamentos son diferentes; corrígelos en Participantes.');
  }
  if (pairAlreadyCreated) reasons.push('Este combate ya existe y sigue activo.');

  for (const failure of suggestion?.hardFailures ?? []) {
    if (MANUAL_PAIRING_BLOCKERS.has(failure)) reasons.push(FAILURE_LABELS[failure] ?? failure);
  }

  return Array.from(new Set(reasons));
}

function canonicalGenderDivision(value: string | null) {
  const normalized = value?.trim().toLocaleLowerCase('es-MX');
  if (['masculino', 'masculina', 'hombre', 'varon', 'varón', 'male', 'm'].includes(normalized ?? '')) {
    return 'Masculino';
  }
  if (['femenino', 'femenina', 'mujer', 'female', 'f'].includes(normalized ?? '')) {
    return 'Femenino';
  }
  return null;
}

function suggestionPairKey(registrationAId: string, registrationBId: string) {
  return [registrationAId, registrationBId].sort().join(':');
}

function suggestionCanCreateBout(
  suggestion: CompatibilityResult | undefined,
  pairAlreadyCreated: boolean
) {
  return Boolean(
    suggestion
    && suggestion.eligible
    && !pairAlreadyCreated
    && ['active', 'locked', 'changes_requested'].includes(suggestion.status)
  );
}

function groupRegistrationsByWeightCategory(
  registrations: RegistrationWithFighter[]
): WeightCategoryGroup[] {
  const groups = new Map<string, WeightCategoryGroup>();

  for (const registration of registrations) {
    const discipline = registration.registered_discipline?.trim() || 'Sin disciplina';
    const rawWeightClass = registration.registered_weight_class?.trim();
    const weightClass = rawWeightClass && rawWeightClass.toLowerCase() !== 'multiple'
      ? rawWeightClass
      : registration.weigh_in_weight != null
        ? 'Categoría flexible por peso real'
        : 'Sin categoría';
    const age = registration.age_at_event;
    const ageGroup = age == null || ['Sin categoría', 'Categoría flexible por peso real'].includes(weightClass)
      ? null
      : getCombatWeightGroups(discipline).find((group) =>
        age >= group.minimumAge
        && (group.maximumAge == null || age <= group.maximumAge)
        && group.weights.some((category) => category.toLowerCase() === weightClass.toLowerCase())
      )?.group ?? null;
    const label = weightClass === 'Sin categoría'
      ? `${discipline} · Sin categoría asignada`
      : weightClass === 'Categoría flexible por peso real'
        ? `${discipline} · Categoría flexible por peso real`
      : [discipline, ageGroup, weightClass].filter(Boolean).join(' · ');
    const key = [discipline, ageGroup ?? '', weightClass].join('|').toLowerCase();
    const existing = groups.get(key);
    if (existing) existing.registrations.push(registration);
    else groups.set(key, { key, label, discipline, registrations: [registration] });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      registrations: group.registrations.sort((registrationA, registrationB) => {
        const weightA = registrationA.weigh_in_weight ?? Number.POSITIVE_INFINITY;
        const weightB = registrationB.weigh_in_weight ?? Number.POSITIVE_INFINITY;
        if (weightA !== weightB) return weightA - weightB;
        return participantName(registrationA).localeCompare(participantName(registrationB), 'es');
      }),
    }))
    .sort((groupA, groupB) => {
      const unassignedA = groupA.label.includes('Sin categoría') || groupA.label.includes('Categoría flexible');
      const unassignedB = groupB.label.includes('Sin categoría') || groupB.label.includes('Categoría flexible');
      if (unassignedA !== unassignedB) return unassignedA ? 1 : -1;
      return groupA.label.localeCompare(groupB.label, 'es', { numeric: true });
    });
}
