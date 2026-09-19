'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EventManageFrame } from '@/components/EventManageFrame';
import { InlineCombatRecord } from '@/components/CombatRecord';
import { EligibilityStatus } from '@/components/EligibilityStatus';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import { fighterService } from '@/services/fighterService';
import { manualFighterService } from '@/services/manualFighterService';
import {
  createManualEventParticipant,
  getEventParticipantHistory,
  registerPlatformParticipant,
  registerRosterParticipant,
  removeEventParticipant,
  updateEventParticipant,
  type EventParticipantHistoryItem,
  type EventParticipantPayload,
} from '@/services/eventParticipantService';
import { getMatchesForEvent, type MatchWithContext } from '@/services/matchService';
import { getEventRegistrations } from '@/services/registrationService';
import type { Event, EventApplication, EventRegistration, Fighter, ManualFighter, Profile, RegistrationWithFighter } from '@/types';

type SourceMode = 'platform' | 'roster' | 'event_only';
type ParticipantFilter = 'all' | 'needs_attention' | 'ready';
type PlatformFighter = Fighter & { profiles?: { full_name: string; city: string | null; state?: string | null; country?: string | null; date_of_birth?: string | null } };
type EventApplicationWithFighter = EventApplication & {
  fighters: {
    profiles: { full_name: string; city: string | null };
    weight_class: string | null;
    disciplines: string[];
    photo_url: string | null;
  };
};

const WEIGHT_CLASS_OPTIONS: string[][] = [
  ['', 'Seleccionar categoría…'],
  ['minimosca', 'Minimosca'],
  ['mosca', 'Mosca'],
  ['supermosca', 'Supermosca'],
  ['gallo', 'Gallo'],
  ['supergallo', 'Supergallo'],
  ['pluma', 'Pluma'],
  ['superpluma', 'Superpluma'],
  ['ligero', 'Ligero'],
  ['superligero', 'Superligero'],
  ['welter', 'Welter'],
  ['superwelter', 'Superwelter'],
  ['medio', 'Medio'],
  ['supermedio', 'Supermedio'],
  ['semipesado', 'Semipesado'],
  ['crucero', 'Crucero'],
  ['pesado', 'Pesado'],
];

const WEIGHT_CLASS_LABELS = Object.fromEntries(WEIGHT_CLASS_OPTIONS.slice(1));

interface ParticipantForm {
  full_name: string;
  nickname: string;
  photo_url: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  country: string;
  date_of_birth: string;
  gender_division: string;
  weight_class: string;
  exact_weight: string;
  requested_weight_kg: string;
  acceptable_weight_min_kg: string;
  acceptable_weight_max_kg: string;
  discipline: string;
  ruleset: string;
  bout_format: string;
  experience_level: 'amateur' | 'pro';
  skill_rating: string;
  record_wins: string;
  record_losses: string;
  record_draws: string;
  ko_wins: string;
  tko_wins: string;
  ko_losses: string;
  tko_losses: string;
  gym_name: string;
  special_restrictions: string;
  available_from: string;
  available_to: string;
  medical_clearance_date: string;
  last_fight_at: string;
  last_ko_loss_at: string;
  payment_status: EventRegistration['payment_status'];
  availability_confirmed: boolean;
  weight_confirmed: boolean;
  representative_confirmed: boolean;
  representative_confirmation_note: string;
  minor_consent_confirmed: boolean;
}

const EMPTY_FORM: ParticipantForm = {
  full_name: '', nickname: '', photo_url: '', phone: '', email: '', city: '', state: '', country: 'Mexico',
  date_of_birth: '', gender_division: '', weight_class: '', exact_weight: '', requested_weight_kg: '',
  acceptable_weight_min_kg: '', acceptable_weight_max_kg: '', discipline: '', ruleset: '', bout_format: '',
  experience_level: 'amateur', skill_rating: '', record_wins: '0', record_losses: '0', record_draws: '0',
  ko_wins: '0', tko_wins: '0', ko_losses: '0', tko_losses: '0', gym_name: '', special_restrictions: '',
  available_from: '', available_to: '', medical_clearance_date: '', last_fight_at: '', last_ko_loss_at: '',
  payment_status: 'waived', availability_confirmed: true, weight_confirmed: true,
  representative_confirmed: false, representative_confirmation_note: '', minor_consent_confirmed: false,
};

export default function EventParticipantsPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationWithFighter[]>([]);
  const [applications, setApplications] = useState<EventApplicationWithFighter[]>([]);
  const [platformFighters, setPlatformFighters] = useState<PlatformFighter[]>([]);
  const [rosterFighters, setRosterFighters] = useState<ManualFighter[]>([]);
  const [matches, setMatches] = useState<MatchWithContext[]>([]);
  const [source, setSource] = useState<SourceMode>('event_only');
  const [participantFilter, setParticipantFilter] = useState<ParticipantFilter>('all');
  const [selectedFighterId, setSelectedFighterId] = useState('');
  const [publishToRoster, setPublishToRoster] = useState(false);
  const [form, setForm] = useState<ParticipantForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, EventParticipantHistoryItem[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [registrationResult, matchResult, applicationResult] = await Promise.all([
      getEventRegistrations(eventId),
      getMatchesForEvent(eventId),
      eventService.getApplicationsForEvent(eventId),
    ]);
    if (registrationResult.error || matchResult.error || applicationResult.error) {
      setError(registrationResult.error ?? matchResult.error ?? applicationResult.error);
    }
    setRegistrations(registrationResult.data ?? []);
    setMatches(matchResult.data ?? []);
    setApplications((applicationResult.data ?? []) as EventApplicationWithFighter[]);
  }, [eventId]);

  useEffect(() => {
    let active = true;
    Promise.all([authService.getSession(), eventService.getById(eventId)]).then(async ([sessionResult, eventResult]) => {
      if (!active) return;
      const nextProfile = sessionResult.data?.profile ?? null;
      const nextEvent = eventResult.data ?? null;
      setProfile(nextProfile);
      setEvent(nextEvent);
      const allowed = await canUseEventFeature(eventId, 'matchmaking', nextProfile, nextEvent);
      setCanManage(allowed);
      if (allowed && nextProfile) {
        const [platformResult, rosterResult] = await Promise.all([
          fighterService.getAll(),
          manualFighterService.getByCreator(nextProfile.id),
        ]);
        setPlatformFighters((platformResult.data ?? []) as PlatformFighter[]);
        setRosterFighters(rosterResult.data ?? []);
        await reload();
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [eventId, reload]);

  useEffect(() => {
    if (!canManage) return;
    const channel = supabase
      .channel(`event-participants:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_registrations', filter: `event_id=eq.${eventId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_applications', filter: `event_id=eq.${eventId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [canManage, eventId, reload]);

  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const match of matches.filter((item) => item.match_status !== 'cancelled')) {
      for (const registrationId of [match.fighter_a_registration_id, match.fighter_b_registration_id]) {
        if (registrationId) counts.set(registrationId, (counts.get(registrationId) ?? 0) + 1);
      }
    }
    return counts;
  }, [matches]);

  const acceptedApplications = useMemo(
    () => applications.filter((application) => application.status === 'accepted'),
    [applications]
  );
  const acceptedWithoutRegistration = useMemo(() => {
    const registeredFighterIds = new Set(registrations.map((registration) => registration.fighter_id).filter(Boolean));
    return acceptedApplications.filter((application) => !registeredFighterIds.has(application.fighter_id));
  }, [acceptedApplications, registrations]);
  const participantMetrics = useMemo(() => ({
    accepted: acceptedApplications.length,
    pendingPayment: registrations.filter((registration) => registration.payment_status === 'pending').length,
    submittedPayment: registrations.filter((registration) => registration.payment_status === 'submitted').length,
    confirmedPayment: registrations.filter((registration) => ['confirmed', 'waived'].includes(registration.payment_status)).length,
    reviewRequired: registrations.filter((registration) => registration.eligibility_status === 'review_required').length,
    ready: registrations.filter((registration) => registration.eligibility_status === 'eligible').length,
  }), [acceptedApplications, registrations]);
  const visibleRegistrations = useMemo(() => registrations.filter((registration) => {
    if (participantFilter === 'ready') return registration.eligibility_status === 'eligible';
    if (participantFilter === 'needs_attention') {
      return registration.eligibility_status !== 'eligible'
        || !['confirmed', 'waived'].includes(registration.payment_status);
    }
    return true;
  }), [participantFilter, registrations]);

  const reset = () => {
    setForm(EMPTY_FORM);
    setSelectedFighterId('');
    setEditingId(null);
    setPublishToRoster(false);
  };

  const save = async () => {
    if (!form.representative_confirmed) {
      setError('Debes confirmar que tienes autorización del peleador o su representante.');
      return;
    }
    if (source === 'event_only' && !form.full_name.trim()) {
      setError('El nombre completo es obligatorio.');
      return;
    }
    if (source !== 'event_only' && !selectedFighterId && !editingId) {
      setError('Selecciona un peleador.');
      return;
    }
    setActing(true);
    setError(null);
    setMessage(null);
    const payload = toPayload(form);
    let result;
    if (editingId) {
      result = await updateEventParticipant(editingId, toRegistrationPatch(form));
    } else if (source === 'platform') {
      result = await registerPlatformParticipant(eventId, selectedFighterId, payload);
    } else if (source === 'roster') {
      result = await registerRosterParticipant(eventId, selectedFighterId, payload);
    } else {
      result = await createManualEventParticipant(eventId, payload, publishToRoster);
    }
    if (!editingId && source !== 'event_only' && !result.error && result.data) {
      result = await updateEventParticipant(result.data.id, toRegistrationPatch(form));
    }
    if (result.error) setError(result.error);
    else {
      setMessage(editingId ? 'Datos del evento actualizados.' : 'Peleador agregado al evento.');
      reset();
      await reload();
    }
    setActing(false);
  };

  const edit = (registration: RegistrationWithFighter) => {
    setEditingId(registration.id);
    setSource(registration.manual_fighter_id ? 'roster' : 'platform');
    setSelectedFighterId(registration.manual_fighter_id ?? registration.fighter_id ?? '');
    setForm(formFromRegistration(registration));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prepareAcceptedApplication = (application: EventApplicationWithFighter) => {
    const fighter = platformFighters.find((item) => item.id === application.fighter_id);
    if (!fighter) {
      setError('No se pudo cargar el perfil del peleador aceptado.');
      return;
    }
    setError(null);
    setMessage('Completa los datos pendientes y agrega al peleador como participante.');
    setEditingId(null);
    setPublishToRoster(false);
    setSource('platform');
    selectExistingParticipant(
      application.fighter_id,
      'platform',
      platformFighters,
      rosterFighters,
      setSelectedFighterId,
      (selectedForm) => setForm({
        ...selectedForm,
        discipline: application.fighter_discipline ?? selectedForm.discipline,
        weight_class: application.fighter_weight_class ?? selectedForm.weight_class,
        gym_name: application.corner_name ?? selectedForm.gym_name,
        availability_confirmed: application.confirm_availability || selectedForm.availability_confirmed,
        weight_confirmed: application.confirm_weight || selectedForm.weight_confirmed,
      })
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (registration: RegistrationWithFighter) => {
    if (!window.confirm(`¿Quitar a ${participantName(registration)} de este evento?`)) return;
    setActing(true);
    const result = await removeEventParticipant(registration.id);
    if (result.error) setError(result.error);
    else await reload();
    setActing(false);
  };

  const toggleHistory = async (registrationId: string) => {
    if (histories[registrationId]) {
      setHistories((current) => {
        const next = { ...current };
        delete next[registrationId];
        return next;
      });
      return;
    }
    setHistoryLoading(registrationId);
    const result = await getEventParticipantHistory(registrationId);
    if (result.error) setError(result.error);
    else setHistories((current) => ({ ...current, [registrationId]: result.data ?? [] }));
    setHistoryLoading(null);
  };

  if (loading || profile === undefined) return <Frame><p className="text-sm text-zinc-500">Cargando participantes…</p></Frame>;
  if (!canManage) return <Frame><h1 className="text-3xl font-black uppercase">Participantes</h1><p className="mt-3 text-sm text-zinc-600">No tienes permiso para administrar este evento.</p></Frame>;

  return (
    <Frame>
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">Strikers Match</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-zinc-900 sm:text-5xl">Participantes</h1>
          <p className="mt-2 text-sm text-zinc-600">{event?.event_name} · roster autorizado para matchmaking</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/events/${eventId}/manage/matchmaking`} className="flex min-h-11 items-center justify-center bg-zinc-900 px-4 text-xs font-bold uppercase text-white">Matchmaking</Link>
          <Link href={`/events/${eventId}/manage/settings`} className="flex min-h-11 items-center justify-center border border-zinc-300 px-4 text-xs font-bold uppercase text-zinc-800">Configuración</Link>
        </div>
      </header>

      {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Solicitudes aceptadas" value={participantMetrics.accepted} />
        <Metric label="Pago pendiente" value={participantMetrics.pendingPayment} />
        <Metric label="Pago enviado" value={participantMetrics.submittedPayment} />
        <Metric label="Pago confirmado" value={participantMetrics.confirmedPayment} />
        <Metric label="Requieren revisión" value={participantMetrics.reviewRequired} />
        <Metric label="Listos para matchmaking" value={participantMetrics.ready} />
      </section>

      <section className="border border-zinc-200 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-black uppercase">{editingId ? 'Editar datos para este evento' : 'Agregar peleador'}</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">Los datos de esta ficha son los que usa el motor. Fecha de nacimiento, contacto, médico y restricciones son privados para el equipo autorizado.</p>
          </div>
          {editingId && <button type="button" onClick={reset} className="min-h-11 border border-zinc-300 px-4 text-xs font-bold uppercase">Cancelar edición</button>}
        </div>

        {!editingId && (
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ModeButton active={source === 'platform'} onClick={() => { reset(); setSource('platform'); }} label="Perfil Strikers Match" />
            <ModeButton active={source === 'roster'} onClick={() => { reset(); setSource('roster'); }} label="Mi roster manual" />
            <ModeButton active={source === 'event_only'} onClick={() => { reset(); setSource('event_only'); }} label="Alta rápida del evento" />
          </div>
        )}

        {!editingId && source !== 'event_only' && (
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">Peleador</span>
            <select value={selectedFighterId} onChange={(input) => selectExistingParticipant(input.target.value, source, platformFighters, rosterFighters, setSelectedFighterId, setForm)} className="min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm">
              <option value="">Seleccionar…</option>
              {(source === 'platform' ? platformFighters : rosterFighters).map((fighter) => (
                <option key={fighter.id} value={fighter.id}>{source === 'platform' ? (fighter as PlatformFighter).profiles?.full_name : (fighter as ManualFighter).full_name} · {weightClassLabel(fighter.weight_class)}</option>
              ))}
            </select>
          </label>
        )}

        <ParticipantFields form={form} setForm={setForm} showIdentity={source === 'event_only' || Boolean(editingId)} />

        {!editingId && source === 'event_only' && (
          <label className="mt-4 flex items-start gap-3 border border-zinc-200 p-3 text-sm text-zinc-700">
            <input type="checkbox" checked={publishToRoster} onChange={(input) => setPublishToRoster(input.target.checked)} className="mt-1 h-4 w-4 accent-[#C0001E]" />
            Guardar también en mi roster reutilizable. Si no se marca, el perfil permanece privado y limitado a este evento.
          </label>
        )}
        <label className="mt-4 flex items-start gap-3 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <input type="checkbox" checked={form.representative_confirmed} onChange={(input) => setForm({ ...form, representative_confirmed: input.target.checked })} className="mt-1 h-4 w-4 accent-[#C0001E]" />
          Confirmo que tengo autorización del peleador o de su representante para registrarlo y gestionar su participación en este evento.
        </label>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={save} disabled={acting} className="min-h-11 bg-[#C0001E] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:bg-zinc-300">{acting ? 'Guardando…' : editingId ? 'Actualizar participante' : 'Agregar al evento'}</button>
        </div>
      </section>

      {acceptedWithoutRegistration.length > 0 && (
        <section className="border border-amber-200 bg-amber-50 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black uppercase text-amber-950">Solicitudes aceptadas sin registro</h2>
              <p className="mt-1 text-sm text-amber-900">Estas personas fueron aceptadas, pero todavía no aparecen en el roster de participantes.</p>
            </div>
            <span className="text-sm font-bold text-amber-900">{acceptedWithoutRegistration.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {acceptedWithoutRegistration.map((application) => (
              <article key={application.id} className="flex flex-col gap-3 border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-zinc-900">{application.fighters?.profiles?.full_name ?? '—'}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {application.fighter_discipline ?? 'Disciplina pendiente'} · {application.fighter_weight_class ?? weightClassLabel(application.fighters?.weight_class)}
                  </p>
                </div>
                <button type="button" onClick={() => prepareAcceptedApplication(application)} className="min-h-11 bg-[#C0001E] px-4 py-3 text-xs font-bold uppercase text-white">
                  Completar registro
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase">Roster del evento</h2>
            <span className="text-sm text-zinc-500">{registrations.length} participantes</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FilterButton active={participantFilter === 'all'} onClick={() => setParticipantFilter('all')} label="Todos" />
            <FilterButton active={participantFilter === 'needs_attention'} onClick={() => setParticipantFilter('needs_attention')} label="Necesitan atención" />
            <FilterButton active={participantFilter === 'ready'} onClick={() => setParticipantFilter('ready')} label="Listos" />
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {visibleRegistrations.length === 0 ? <p className="border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">{registrations.length === 0 ? 'Todavía no hay peleadores registrados.' : 'No hay participantes en este filtro.'}</p> : visibleRegistrations.map((registration) => {
            const history = histories[registration.id];
            const scheduledCount = assignmentCounts.get(registration.id) ?? 0;
            const alreadyMatched = scheduledCount > 0;
            return (
              <article key={registration.id} className="border border-zinc-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-zinc-900">{participantName(registration)}</h3>
                      <PaymentStatusBadge value={registration.payment_status} />
                      <span className="border border-zinc-200 px-2 py-1 text-[10px] font-bold uppercase text-zinc-600">{registration.registration_source}</span>
                      {alreadyMatched && <span className="bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase text-white">Ya emparejado</span>}
                    </div>
                    <EligibilityStatus status={registration.eligibility_status} reasons={registration.eligibility_reasons} showReasons />
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-600 sm:grid-cols-2 lg:grid-cols-3">
                      <Info label="Peso" value={`${weightClassLabel(registration.registered_weight_class)} · ${formatKg(registration.weigh_in_weight)} real`} />
                      <Info label="Peso solicitado / rango" value={`${formatKg(registration.requested_weight_kg)} · ${formatRange(registration.acceptable_weight_min_kg, registration.acceptable_weight_max_kg)}`} />
                      <Info label="Edad / división" value={`${registration.age_at_event ?? '—'} años · ${registration.gender_division ?? '—'}`} />
                      <Info label="Disciplina / reglamento" value={`${registration.registered_discipline ?? '—'} · ${registration.ruleset ?? '—'}`} />
                      <Info label="Experiencia / nivel" value={`${registration.experience_level ?? '—'} · ${registration.skill_rating ?? '—'}/10`} />
                      <Info label="Equipo / ubicación" value={`${registration.team_name ?? '—'} · ${[registration.city, registration.state].filter(Boolean).join(', ') || '—'}`} />
                      <div><span className="font-bold uppercase text-zinc-400">Récord</span><div className="mt-0.5"><InlineCombatRecord wins={registration.record_wins} losses={registration.record_losses} draws={registration.record_draws} winLabel="G" lossLabel="P" drawLabel="E" /></div></div>
                      <Info label="KO/TKO" value={`${registration.ko_wins + registration.tko_wins} a favor · ${registration.ko_losses + registration.tko_losses} en contra`} />
                      <Info label="Disponibilidad" value={`${registration.availability_confirmed ? 'Confirmada' : 'Pendiente'} · ${registration.available_from ?? 'ahora'}–${registration.available_to ?? 'abierta'}`} />
                      <Info label="Peleas programadas" value={`${scheduledCount} · ${alreadyMatched ? 'ya emparejado' : 'disponible'}`} />
                    </div>
                    {registration.special_restrictions.length > 0 && <p className="mt-3 border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><strong>Restricciones privadas:</strong> {registration.special_restrictions.join(' · ')}</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 lg:w-auto">
                    <button type="button" onClick={() => edit(registration)} className="min-h-11 border border-zinc-300 px-3 text-xs font-bold uppercase">{registration.eligibility_status === 'eligible' ? 'Editar' : 'Completar información'}</button>
                    <button type="button" onClick={() => toggleHistory(registration.id)} className="min-h-11 border border-zinc-300 px-3 text-xs font-bold uppercase">{historyLoading === registration.id ? '…' : history ? 'Cerrar' : 'Historial'}</button>
                    <button type="button" onClick={() => remove(registration)} disabled={acting || alreadyMatched} title={alreadyMatched ? 'Cancela primero su propuesta o combate activo.' : ''} className="min-h-11 border border-red-200 px-3 text-xs font-bold uppercase text-red-700 disabled:opacity-40">Quitar</button>
                  </div>
                </div>
                {history && <HistoryList items={history} />}
              </article>
            );
          })}
        </div>
      </section>
    </Frame>
  );
}

function ParticipantFields({ form, setForm, showIdentity }: { form: ParticipantForm; setForm: (form: ParticipantForm) => void; showIdentity: boolean }) {
  const change = <K extends keyof ParticipantForm>(key: K, value: ParticipantForm[K]) => setForm({ ...form, [key]: value });
  return (
    <div className="mt-5 space-y-5">
      {showIdentity && <FieldGroup title="Identidad y contacto privado">
        <TextField label="Nombre completo *" value={form.full_name} onChange={(value) => change('full_name', value)} />
        <TextField label="Apodo" value={form.nickname} onChange={(value) => change('nickname', value)} />
        <TextField label="Fecha de nacimiento" type="date" value={form.date_of_birth} onChange={(value) => change('date_of_birth', value)} />
        <TextField label="División de género" value={form.gender_division} onChange={(value) => change('gender_division', value)} placeholder="Masculina, femenina…" />
        <TextField label="Teléfono privado" value={form.phone} onChange={(value) => change('phone', value)} />
        <TextField label="Email privado" type="email" value={form.email} onChange={(value) => change('email', value)} />
        <TextField label="URL de foto" value={form.photo_url} onChange={(value) => change('photo_url', value)} />
      </FieldGroup>}
      <FieldGroup title="Datos de combate">
        <SelectField label="Categoría de peso" value={form.weight_class} onChange={(value) => change('weight_class', value)} options={weightClassOptions(form.weight_class)} />
        <TextField label="Peso real registrado (kg)" type="number" value={form.exact_weight} onChange={(value) => change('exact_weight', value)} />
        <TextField label="Peso solicitado (kg)" type="number" value={form.requested_weight_kg} onChange={(value) => change('requested_weight_kg', value)} />
        <TextField label="Peso mínimo aceptable (kg)" type="number" value={form.acceptable_weight_min_kg} onChange={(value) => change('acceptable_weight_min_kg', value)} />
        <TextField label="Peso máximo aceptable (kg)" type="number" value={form.acceptable_weight_max_kg} onChange={(value) => change('acceptable_weight_max_kg', value)} />
        <TextField label="Disciplina" value={form.discipline} onChange={(value) => change('discipline', value)} placeholder="Boxeo, MMA…" />
        <TextField label="Reglamento" value={form.ruleset} onChange={(value) => change('ruleset', value)} />
        <TextField label="Formato del combate" value={form.bout_format} onChange={(value) => change('bout_format', value)} placeholder="3 x 3 min" />
        <SelectField label="Amateur / profesional" value={form.experience_level} onChange={(value) => change('experience_level', value as 'amateur' | 'pro')} options={[['amateur', 'Amateur'], ['pro', 'Profesional']]} />
        <TextField label="Evaluación de nivel (1–10)" type="number" value={form.skill_rating} onChange={(value) => change('skill_rating', value)} />
      </FieldGroup>
      <FieldGroup title="Récord y experiencia">
        <TextField label="Victorias" type="number" value={form.record_wins} onChange={(value) => change('record_wins', value)} />
        <TextField label="Derrotas" type="number" value={form.record_losses} onChange={(value) => change('record_losses', value)} />
        <TextField label="Empates" type="number" value={form.record_draws} onChange={(value) => change('record_draws', value)} />
        <TextField label="Victorias por KO" type="number" value={form.ko_wins} onChange={(value) => change('ko_wins', value)} />
        <TextField label="Victorias por TKO" type="number" value={form.tko_wins} onChange={(value) => change('tko_wins', value)} />
        <TextField label="Derrotas por KO" type="number" value={form.ko_losses} onChange={(value) => change('ko_losses', value)} />
        <TextField label="Derrotas por TKO" type="number" value={form.tko_losses} onChange={(value) => change('tko_losses', value)} />
        <TextField label="Última pelea" type="date" value={form.last_fight_at} onChange={(value) => change('last_fight_at', value)} />
        <TextField label="Última derrota por KO" type="date" value={form.last_ko_loss_at} onChange={(value) => change('last_ko_loss_at', value)} />
      </FieldGroup>
      <FieldGroup title="Equipo, ubicación y disponibilidad">
        <TextField label="Gimnasio / equipo" value={form.gym_name} onChange={(value) => change('gym_name', value)} />
        <TextField label="Ciudad" value={form.city} onChange={(value) => change('city', value)} />
        <TextField label="Estado" value={form.state} onChange={(value) => change('state', value)} />
        <TextField label="País" value={form.country} onChange={(value) => change('country', value)} />
        <TextField label="Disponible desde" type="date" value={form.available_from} onChange={(value) => change('available_from', value)} />
        <TextField label="Disponible hasta" type="date" value={form.available_to} onChange={(value) => change('available_to', value)} />
        <TextField label="Vigencia médica (privado)" type="date" value={form.medical_clearance_date} onChange={(value) => change('medical_clearance_date', value)} />
        <SelectField label="Pago" value={form.payment_status} onChange={(value) => change('payment_status', value as EventRegistration['payment_status'])} options={[['waived', 'Exento'], ['confirmed', 'Confirmado'], ['submitted', 'Enviado'], ['pending', 'Pendiente']]} />
      </FieldGroup>
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">Restricciones especiales (privadas, separadas por coma)</span>
        <textarea rows={2} value={form.special_restrictions} onChange={(input) => change('special_restrictions', input.target.value)} className="w-full border border-zinc-300 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">Nota de autorización</span>
        <input value={form.representative_confirmation_note} onChange={(input) => change('representative_confirmation_note', input.target.value)} className="min-h-11 w-full border border-zinc-300 px-3 text-sm" />
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <CheckField label="Peso confirmado" checked={form.weight_confirmed} onChange={(value) => change('weight_confirmed', value)} />
        <CheckField label="Disponibilidad confirmada" checked={form.availability_confirmed} onChange={(value) => change('availability_confirmed', value)} />
        <CheckField label="Consentimiento de menor verificado" checked={form.minor_consent_confirmed} onChange={(value) => change('minor_consent_confirmed', value)} />
      </div>
    </div>
  );
}

function toPayload(form: ParticipantForm): EventParticipantPayload {
  return {
    full_name: clean(form.full_name), nickname: clean(form.nickname), photo_url: clean(form.photo_url), phone: clean(form.phone), email: clean(form.email),
    city: clean(form.city), state: clean(form.state), country: clean(form.country), date_of_birth: clean(form.date_of_birth), gender_division: clean(form.gender_division),
    weight_class: clean(form.weight_class), exact_weight: numberValue(form.exact_weight), requested_weight_kg: numberValue(form.requested_weight_kg),
    acceptable_weight_min_kg: numberValue(form.acceptable_weight_min_kg), acceptable_weight_max_kg: numberValue(form.acceptable_weight_max_kg),
    discipline: clean(form.discipline), ruleset: clean(form.ruleset), preferred_rulesets: form.ruleset ? [form.ruleset.trim()] : [], bout_format: clean(form.bout_format),
    experience_level: form.experience_level, skill_rating: numberValue(form.skill_rating), record_wins: numberValue(form.record_wins), record_losses: numberValue(form.record_losses), record_draws: numberValue(form.record_draws),
    ko_wins: numberValue(form.ko_wins), tko_wins: numberValue(form.tko_wins), ko_losses: numberValue(form.ko_losses), tko_losses: numberValue(form.tko_losses), gym_name: clean(form.gym_name),
    special_restrictions: commaList(form.special_restrictions), available_from: clean(form.available_from), available_to: clean(form.available_to), medical_clearance_date: clean(form.medical_clearance_date),
    last_fight_at: clean(form.last_fight_at), last_ko_loss_at: clean(form.last_ko_loss_at), is_available: form.availability_confirmed,
    payment_status: form.payment_status, availability_confirmed: form.availability_confirmed, weight_confirmed: form.weight_confirmed,
    representative_confirmed: form.representative_confirmed, representative_confirmation_note: clean(form.representative_confirmation_note), minor_consent_confirmed: form.minor_consent_confirmed,
  };
}

function toRegistrationPatch(form: ParticipantForm): Partial<EventRegistration> {
  return {
    display_name: clean(form.full_name) ?? null, nickname: clean(form.nickname) ?? null, photo_url: clean(form.photo_url) ?? null,
    city: clean(form.city) ?? null, state: clean(form.state) ?? null, country: clean(form.country) ?? null,
    date_of_birth: clean(form.date_of_birth) ?? null, gender_division: clean(form.gender_division) ?? null,
    registered_weight_class: clean(form.weight_class) ?? null, weigh_in_weight: numberValue(form.exact_weight) ?? null,
    requested_weight_kg: numberValue(form.requested_weight_kg) ?? null, acceptable_weight_min_kg: numberValue(form.acceptable_weight_min_kg) ?? null,
    acceptable_weight_max_kg: numberValue(form.acceptable_weight_max_kg) ?? null, registered_discipline: clean(form.discipline) ?? null,
    ruleset: clean(form.ruleset) ?? null, bout_format: clean(form.bout_format) ?? null, experience_level: form.experience_level,
    skill_rating: numberValue(form.skill_rating) ?? null, record_wins: numberValue(form.record_wins) ?? 0, record_losses: numberValue(form.record_losses) ?? 0,
    record_draws: numberValue(form.record_draws) ?? 0, ko_wins: numberValue(form.ko_wins) ?? 0, tko_wins: numberValue(form.tko_wins) ?? 0,
    ko_losses: numberValue(form.ko_losses) ?? 0, tko_losses: numberValue(form.tko_losses) ?? 0, team_name: clean(form.gym_name) ?? null,
    special_restrictions: commaList(form.special_restrictions), available_from: clean(form.available_from) ?? null, available_to: clean(form.available_to) ?? null,
    medical_clearance_date: clean(form.medical_clearance_date) ?? null, last_fight_at: clean(form.last_fight_at) ?? null,
    last_ko_loss_at: clean(form.last_ko_loss_at) ?? null, payment_status: form.payment_status,
    availability_confirmed: form.availability_confirmed, weight_confirmed: form.weight_confirmed,
    representative_confirmation_note: clean(form.representative_confirmation_note) ?? null,
    representative_confirmed_at: form.representative_confirmed ? new Date().toISOString() : null,
    minor_consent_verified_at: form.minor_consent_confirmed ? new Date().toISOString() : null,
  };
}

function formFromRegistration(registration: RegistrationWithFighter): ParticipantForm {
  return {
    ...EMPTY_FORM,
    full_name: participantName(registration), nickname: registration.nickname ?? '', photo_url: registration.photo_url ?? '', city: registration.city ?? '', state: registration.state ?? '', country: registration.country ?? 'Mexico',
    date_of_birth: registration.date_of_birth ?? '', gender_division: registration.gender_division ?? '', weight_class: registration.registered_weight_class ?? '', exact_weight: stringValue(registration.weigh_in_weight),
    requested_weight_kg: stringValue(registration.requested_weight_kg), acceptable_weight_min_kg: stringValue(registration.acceptable_weight_min_kg), acceptable_weight_max_kg: stringValue(registration.acceptable_weight_max_kg),
    discipline: registration.registered_discipline ?? '', ruleset: registration.ruleset ?? '', bout_format: registration.bout_format ?? '', experience_level: registration.experience_level ?? 'amateur', skill_rating: stringValue(registration.skill_rating),
    record_wins: stringValue(registration.record_wins, '0'), record_losses: stringValue(registration.record_losses, '0'), record_draws: stringValue(registration.record_draws, '0'),
    ko_wins: String(registration.ko_wins), tko_wins: String(registration.tko_wins), ko_losses: String(registration.ko_losses), tko_losses: String(registration.tko_losses),
    gym_name: registration.team_name ?? '', special_restrictions: registration.special_restrictions.join(', '), available_from: registration.available_from ?? '', available_to: registration.available_to ?? '',
    medical_clearance_date: registration.medical_clearance_date ?? '', last_fight_at: registration.last_fight_at ?? '', last_ko_loss_at: registration.last_ko_loss_at ?? '', payment_status: registration.payment_status, availability_confirmed: registration.availability_confirmed, weight_confirmed: registration.weight_confirmed,
    representative_confirmed: Boolean(registration.representative_confirmed_at), representative_confirmation_note: registration.representative_confirmation_note ?? '', minor_consent_confirmed: Boolean(registration.minor_consent_verified_at),
  };
}

function selectExistingParticipant(
  fighterId: string,
  source: SourceMode,
  platformFighters: PlatformFighter[],
  rosterFighters: ManualFighter[],
  setSelectedFighterId: (value: string) => void,
  setForm: (value: ParticipantForm) => void
) {
  setSelectedFighterId(fighterId);
  if (!fighterId) { setForm(EMPTY_FORM); return; }
  if (source === 'platform') {
    const fighter = platformFighters.find((item) => item.id === fighterId);
    if (!fighter) return;
    setForm({
      ...EMPTY_FORM,
      full_name: fighter.profiles?.full_name ?? '', nickname: fighter.nickname ?? '', photo_url: fighter.photo_url ?? '',
      city: fighter.profiles?.city ?? '', state: fighter.state ?? fighter.profiles?.state ?? '', country: fighter.profiles?.country ?? 'Mexico',
      date_of_birth: fighter.profiles?.date_of_birth ?? '', gender_division: fighter.gender_division ?? '', weight_class: fighter.weight_class ?? '', exact_weight: stringValue(fighter.exact_weight),
      requested_weight_kg: stringValue(fighter.requested_weight_kg), acceptable_weight_min_kg: stringValue(fighter.acceptable_weight_min_kg), acceptable_weight_max_kg: stringValue(fighter.acceptable_weight_max_kg),
      discipline: fighter.disciplines?.[0] ?? '', ruleset: fighter.preferred_rulesets?.[0] ?? '', experience_level: fighter.experience_level ?? 'amateur', skill_rating: stringValue(fighter.skill_rating),
      record_wins: String(fighter.record_wins ?? 0), record_losses: String(fighter.record_losses ?? 0), record_draws: String(fighter.record_draws ?? 0), ko_wins: String(fighter.ko_wins ?? 0), tko_wins: String(fighter.tko_wins ?? 0), ko_losses: String(fighter.ko_losses ?? 0), tko_losses: String(fighter.tko_losses ?? 0),
      gym_name: fighter.gym_name ?? '', special_restrictions: fighter.special_restrictions?.join(', ') ?? '', available_from: fighter.available_from ?? '', available_to: fighter.available_to ?? '', medical_clearance_date: fighter.medical_clearance_date ?? '', last_fight_at: fighter.last_fight_at ?? '', last_ko_loss_at: fighter.last_ko_loss_at ?? '',
    });
  } else {
    const fighter = rosterFighters.find((item) => item.id === fighterId);
    if (!fighter) return;
    setForm({
      ...EMPTY_FORM,
      full_name: fighter.full_name, nickname: fighter.nickname ?? '', photo_url: fighter.photo_url ?? '', phone: fighter.phone ?? '', email: fighter.email ?? '', city: fighter.city ?? '', state: fighter.state ?? '', country: fighter.country ?? 'Mexico',
      date_of_birth: fighter.date_of_birth ?? '', gender_division: fighter.gender_division ?? '', weight_class: fighter.weight_class ?? '', exact_weight: stringValue(fighter.exact_weight), requested_weight_kg: stringValue(fighter.requested_weight_kg), acceptable_weight_min_kg: stringValue(fighter.acceptable_weight_min_kg), acceptable_weight_max_kg: stringValue(fighter.acceptable_weight_max_kg),
      discipline: fighter.discipline ?? '', ruleset: fighter.preferred_rulesets?.[0] ?? '', experience_level: fighter.experience_level ?? 'amateur', skill_rating: stringValue(fighter.skill_rating), record_wins: String(fighter.record_wins ?? 0), record_losses: String(fighter.record_losses ?? 0), record_draws: String(fighter.record_draws ?? 0), ko_wins: String(fighter.ko_wins ?? 0), tko_wins: String(fighter.tko_wins ?? 0), ko_losses: String(fighter.ko_losses ?? 0), tko_losses: String(fighter.tko_losses ?? 0),
      gym_name: fighter.gym_name ?? '', special_restrictions: fighter.special_restrictions?.join(', ') ?? '', available_from: fighter.available_from ?? '', available_to: fighter.available_to ?? '', medical_clearance_date: fighter.medical_clearance_date ?? '', last_fight_at: fighter.last_fight_at ?? '', last_ko_loss_at: fighter.last_ko_loss_at ?? '',
    });
  }
}

function participantName(registration: RegistrationWithFighter) { return registration.display_name ?? registration.fighters?.profiles?.full_name ?? registration.manual_fighters?.full_name ?? '—'; }
function clean(value: string) { return value.trim() || undefined; }
function numberValue(value: string) { return value === '' ? undefined : Number(value); }
function stringValue(value: number | null, fallback = '') { return value == null ? fallback : String(value); }
function commaList(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
function formatKg(value: number | null) { return value == null ? '—' : `${value} kg`; }
function formatRange(minimum: number | null, maximum: number | null) { return minimum == null && maximum == null ? '—' : `${minimum ?? '—'}–${maximum ?? '—'} kg`; }
function weightClassLabel(value: string | null) { return value ? (WEIGHT_CLASS_LABELS[value] ?? value) : 'peso pendiente'; }
function weightClassOptions(current: string) {
  if (!current || WEIGHT_CLASS_LABELS[current]) return WEIGHT_CLASS_OPTIONS;
  return [WEIGHT_CLASS_OPTIONS[0], [current, `${current} (valor actual)`], ...WEIGHT_CLASS_OPTIONS.slice(1)];
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) { return <fieldset><legend className="mb-3 text-xs font-black uppercase tracking-widest text-[#C0001E]">{title}</legend><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div></fieldset>; }
function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label><span className="mb-1 block text-xs font-bold uppercase text-zinc-600">{label}</span><input type={type} min={type === 'number' ? 0 : undefined} value={value} placeholder={placeholder} onChange={(input) => onChange(input.target.value)} className="min-h-11 w-full border border-zinc-300 px-3 text-sm" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label><span className="mb-1 block text-xs font-bold uppercase text-zinc-600">{label}</span><select value={value} onChange={(input) => onChange(input.target.value)} className="min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm">{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>; }
function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-11 items-center gap-3 border border-zinc-300 p-3 text-sm"><input type="checkbox" checked={checked} onChange={(input) => onChange(input.target.checked)} className="h-4 w-4 accent-[#C0001E]" />{label}</label>; }
function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={`min-h-11 border px-4 py-3 text-xs font-bold uppercase ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-700'}`}>{label}</button>; }
function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={`min-h-11 border px-3 py-2 text-[11px] font-bold uppercase ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700'}`}>{label}</button>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="bg-white p-4"><p className="text-2xl font-black text-zinc-900">{value}</p><p className="mt-1 text-[11px] font-bold uppercase leading-tight text-zinc-500">{label}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <p><span className="font-bold uppercase text-zinc-400">{label}</span><br />{value}</p>; }
function PaymentStatusBadge({ value }: { value: EventRegistration['payment_status'] }) { const label = value === 'confirmed' ? 'Pago confirmado' : value === 'waived' ? 'Pago exento' : value === 'submitted' ? 'Pago enviado' : 'Pago pendiente'; const colors = ['confirmed', 'waived'].includes(value) ? 'bg-emerald-50 text-emerald-800' : value === 'submitted' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'; return <span className={`px-2 py-1 text-[10px] font-bold uppercase ${colors}`}>{label}</span>; }
function HistoryList({ items }: { items: EventParticipantHistoryItem[] }) { return <div className="mt-4 border-t border-zinc-200 pt-4"><h4 className="text-xs font-black uppercase tracking-widest">Rivales e historial previo</h4>{items.length === 0 ? <p className="mt-2 text-xs text-zinc-500">Sin combates oficiales previos registrados.</p> : <div className="mt-2 space-y-2">{items.map((item) => <p key={item.bout_id} className="border-l-2 border-zinc-300 pl-3 text-xs text-zinc-600"><strong>{item.opponent_name}</strong> · {item.event_name} · {item.event_date ?? 'fecha pendiente'} · {item.bout_status}{item.result ? ` · ${item.result}` : ''}</p>)}</div>}</div>; }
function Frame({ children }: { children: React.ReactNode }) { return <EventManageFrame>{children}</EventManageFrame>; }
