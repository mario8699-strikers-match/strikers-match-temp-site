'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { EventManageFrame } from '@/components/EventManageFrame';
import { InlineCombatRecord } from '@/components/CombatRecord';
import { EligibilityStatus } from '@/components/EligibilityStatus';
import { GenderDivisionCheckboxes } from '@/components/GenderDivisionCheckboxes';
import {
  DISCIPLINE_OPTIONS,
  GENERIC_WEIGHT_CLASS_OPTIONS,
  calculateAgeOnDate,
  getCombatWeightGroups,
  getCombatWeightGroupsForAge,
  inferCombatWeightCategory,
  restrictWeightGroupsToEvent,
  sanitizeWeightClasses,
} from '@/lib/combatWeightCategories';
import { supabase } from '@/lib/supabaseClient';
import { disciplineMatches, normalizeDisciplineList, sortDisciplines } from '@/lib/disciplines';
import { searchByClosestName } from '@/lib/personNameSearch';
import { deleteFile, uploadFile } from '@/lib/storageClient';
import { authService } from '@/services/authService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import { fighterService } from '@/services/fighterService';
import { manualFighterService } from '@/services/manualFighterService';
import {
  confirmAcceptedManualEventParticipantPayments,
  confirmManualEventParticipantPayment,
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
import { getEventPaymentSettings } from '@/services/paymentService';
import { getEventRegistrations } from '@/services/registrationService';
import type { Event, EventApplication, EventPaymentSettings, EventRegistration, Fighter, ManualFighter, Profile, RegistrationWithFighter } from '@/types';

type SourceMode = 'platform' | 'roster' | 'event_only';
type ParticipantFilter = 'all' | 'needs_attention' | 'ready';
type PlatformFighter = Fighter & { profiles?: { full_name: string; city: string | null; state?: string | null; country?: string | null; date_of_birth?: string | null } };
type EventApplicationWithFighter = EventApplication & {
  fighters: {
    profiles: { full_name: string; city: string | null; date_of_birth: string | null };
    weight_class: string | null;
    disciplines: string[];
    photo_url: string | null;
  };
};

const WEIGHT_CLASS_LABELS = Object.fromEntries(GENERIC_WEIGHT_CLASS_OPTIONS.slice(1));
const ACCEPTED_PHOTO_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

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
  approval_status: EventRegistration['approval_status'];
  payment_status: EventRegistration['payment_status'];
  availability_confirmed: boolean;
  weight_confirmed: boolean;
  representative_confirmed: boolean;
  representative_confirmation_note: string;
  minor_consent_confirmed: boolean;
}

const EMPTY_FORM: ParticipantForm = {
  full_name: '', nickname: '', photo_url: '', phone: '', email: '', city: '', state: '', country: '',
  date_of_birth: '', gender_division: '', weight_class: '', exact_weight: '', requested_weight_kg: '',
  acceptable_weight_min_kg: '', acceptable_weight_max_kg: '', discipline: '', ruleset: '', bout_format: '',
  experience_level: 'amateur', skill_rating: '', record_wins: '0', record_losses: '0', record_draws: '0',
  ko_wins: '0', tko_wins: '0', ko_losses: '0', tko_losses: '0', gym_name: '', special_restrictions: '',
  available_from: '', available_to: '', medical_clearance_date: '', last_fight_at: '', last_ko_loss_at: '',
  approval_status: 'accepted', payment_status: 'waived', availability_confirmed: true, weight_confirmed: true,
  representative_confirmed: false, representative_confirmation_note: '', minor_consent_confirmed: false,
};

export default function EventParticipantsPage() {
  const { t } = useTranslation('events');
  const { id: eventId } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<EventPaymentSettings | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationWithFighter[]>([]);
  const [applications, setApplications] = useState<EventApplicationWithFighter[]>([]);
  const [platformFighters, setPlatformFighters] = useState<PlatformFighter[]>([]);
  const [rosterFighters, setRosterFighters] = useState<ManualFighter[]>([]);
  const [matches, setMatches] = useState<MatchWithContext[]>([]);
  const [source, setSource] = useState<SourceMode>('event_only');
  const [participantFilter, setParticipantFilter] = useState<ParticipantFilter>('all');
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [selectedFighterId, setSelectedFighterId] = useState('');
  const [fighterSearch, setFighterSearch] = useState('');
  const [publishToRoster, setPublishToRoster] = useState(false);
  const [form, setForm] = useState<ParticipantForm>(EMPTY_FORM);
  const [participantPhotoFile, setParticipantPhotoFile] = useState<File | null>(null);
  const [participantPhotoPreview, setParticipantPhotoPreview] = useState<string | null>(null);
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
    Promise.all([authService.getSession(), eventService.getById(eventId), getEventPaymentSettings(eventId)]).then(async ([sessionResult, eventResult, paymentSettingsResult]) => {
      if (!active) return;
      const nextProfile = sessionResult.data?.profile ?? null;
      const nextEvent = eventResult.data ?? null;
      setProfile(nextProfile);
      setEvent(nextEvent);
      setPaymentSettings(paymentSettingsResult.data ?? null);
      setForm({
        ...EMPTY_FORM,
        payment_status: nextEvent?.signup_fee && nextEvent.signup_fee > 0 ? 'pending' : 'waived',
      });
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

  useEffect(() => () => {
    if (participantPhotoPreview) URL.revokeObjectURL(participantPhotoPreview);
  }, [participantPhotoPreview]);

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
  const disciplineOptions = useMemo(() => sortDisciplines([
    ...(event?.disciplines_needed ?? []),
    ...registrations.map((registration) => registration.registered_discipline ?? ''),
  ]), [event?.disciplines_needed, registrations]);
  const visibleRegistrations = useMemo(() => registrations.filter((registration) => {
    if (disciplineFilter !== 'all'
      && !disciplineMatches([registration.registered_discipline], disciplineFilter)) return false;
    if (participantFilter === 'ready') return registration.eligibility_status === 'eligible';
    if (participantFilter === 'needs_attention') {
      return registration.eligibility_status !== 'eligible'
        || !['confirmed', 'waived'].includes(registration.payment_status);
    }
    return true;
  }), [disciplineFilter, participantFilter, registrations]);
  const acceptedAwaitingPayment = useMemo(
    () => registrations.filter((registration) =>
      registration.approval_status === 'accepted'
      && !['confirmed', 'waived'].includes(registration.payment_status)
    ),
    [registrations]
  );
  const existingFighterCandidates = useMemo<Array<PlatformFighter | ManualFighter>>(() => {
    const candidates: Array<PlatformFighter | ManualFighter> = source === 'platform'
      ? platformFighters
      : source === 'roster'
        ? rosterFighters
        : [];
    return searchByClosestName(
      candidates,
      fighterSearch,
      (fighter) => existingFighterName(fighter, source, t('events.engine.participantsPage.unnamedProfile'))
    );
  }, [fighterSearch, platformFighters, rosterFighters, source, t]);

  const reset = () => {
    setForm({
      ...EMPTY_FORM,
      payment_status: event?.signup_fee && event.signup_fee > 0 ? 'pending' : 'waived',
    });
    setSelectedFighterId('');
    setFighterSearch('');
    setEditingId(null);
    setPublishToRoster(false);
    setParticipantPhotoFile(null);
    setParticipantPhotoPreview(null);
  };

  const selectParticipantPhoto = (file: File | null) => {
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.split(',').includes(file.type)) {
      setError(t('events.engine.participantsPage.errors.photoType'));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(t('events.engine.participantsPage.errors.photoSize'));
      return;
    }
    if (participantPhotoPreview) URL.revokeObjectURL(participantPhotoPreview);
    setParticipantPhotoFile(file);
    setParticipantPhotoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const save = async () => {
    if (!form.representative_confirmed) {
      setError(t('events.engine.participantsPage.authorizationRequired'));
      return;
    }
    if (source === 'event_only' && !form.full_name.trim()) {
      setError(t('events.engine.participantsPage.errors.nameRequired'));
      return;
    }
    if (source !== 'event_only' && !selectedFighterId && !editingId) {
      setError(t('events.engine.participantsPage.errors.selectFighter'));
      return;
    }
    setActing(true);
    setError(null);
    setMessage(null);
    let uploadedPhoto: { url: string; key: string } | null = null;
    if (participantPhotoFile) {
      const uploadResult = await uploadFile(participantPhotoFile, 'fighter-photos');
      if (uploadResult.error || !uploadResult.data) {
        setActing(false);
        setError(t('events.engine.participantsPage.errors.photoUpload', { error: uploadResult.error ?? t('events.engine.participantsPage.errors.tryAgain') }));
        return;
      }
      uploadedPhoto = uploadResult.data;
    }
    const formToSave = uploadedPhoto ? { ...form, photo_url: uploadedPhoto.url } : form;
    const payload = toPayload(formToSave);
    let result;
    if (editingId) {
      result = await updateEventParticipant(editingId, toRegistrationPatch(formToSave));
    } else if (source === 'platform') {
      result = await registerPlatformParticipant(eventId, selectedFighterId, payload);
    } else if (source === 'roster') {
      result = await registerRosterParticipant(eventId, selectedFighterId, payload);
    } else {
      result = await createManualEventParticipant(eventId, payload, publishToRoster);
    }
    if (!editingId && source !== 'event_only' && !result.error && result.data) {
      result = await updateEventParticipant(result.data.id, toRegistrationPatch(formToSave));
    }
    if (result.error) {
      if (uploadedPhoto) await deleteFile(uploadedPhoto.key);
      setError(result.error);
    }
    else {
      setMessage(editingId
        ? t('events.engine.participantsPage.participantUpdated')
        : t('events.engine.participantsPage.fighterAdded'));
      reset();
      await reload();
    }
    setActing(false);
  };

  const edit = (registration: RegistrationWithFighter) => {
    setParticipantPhotoFile(null);
    setParticipantPhotoPreview(null);
    setEditingId(registration.id);
    setSource(registration.manual_fighter_id ? 'roster' : 'platform');
    setSelectedFighterId(registration.manual_fighter_id ?? registration.fighter_id ?? '');
    setForm(formFromRegistration(registration));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prepareAcceptedApplication = (application: EventApplicationWithFighter) => {
    const fighter = platformFighters.find((item) => item.id === application.fighter_id);
    if (!fighter) {
      setError(t('events.engine.participantsPage.errors.acceptedProfileLoad'));
      return;
    }
    setError(null);
    setMessage(t('events.engine.participantsPage.completeAcceptedParticipant'));
    setEditingId(null);
    setPublishToRoster(false);
    setParticipantPhotoFile(null);
    setParticipantPhotoPreview(null);
    setSource('platform');
    setFighterSearch(fighter.profiles?.full_name ?? '');
    selectExistingParticipant(
      application.fighter_id,
      'platform',
      platformFighters,
      rosterFighters,
      setSelectedFighterId,
      event?.signup_fee && event.signup_fee > 0 ? 'pending' : 'waived',
      event?.event_date ?? null,
      event?.disciplines_needed ?? [],
      event?.weight_classes_needed ?? [],
      (selectedForm) => setForm({
        ...selectedForm,
        date_of_birth: application.fighters?.profiles?.date_of_birth ?? selectedForm.date_of_birth,
        discipline: application.fighter_discipline ?? selectedForm.discipline,
        weight_class: inferCombatWeightCategory(
          application.fighter_discipline ?? selectedForm.discipline,
          calculateAgeOnDate(
            application.fighters?.profiles?.date_of_birth ?? selectedForm.date_of_birth,
            event?.event_date ?? null
          ),
          numberValue(selectedForm.exact_weight),
          event?.weight_classes_needed ?? []
        ) ?? (selectedForm.weight_class || application.fighter_weight_class || ''),
        gym_name: application.corner_name ?? selectedForm.gym_name,
        availability_confirmed: application.confirm_availability || selectedForm.availability_confirmed,
        weight_confirmed: application.confirm_weight || selectedForm.weight_confirmed,
      })
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (registration: RegistrationWithFighter) => {
    if (!window.confirm(t('events.engine.participantsPage.removeConfirm', { name: participantName(registration) }))) return;
    setActing(true);
    const result = await removeEventParticipant(registration.id);
    if (result.error) setError(result.error);
    else await reload();
    setActing(false);
  };

  const quickUpdate = async (
    registration: RegistrationWithFighter,
    patch: Partial<EventRegistration>,
    successMessage: string
  ) => {
    setActing(true);
    setError(null);
    setMessage(null);
    const result = await updateEventParticipant(registration.id, patch);
    if (result.error) setError(result.error);
    else {
      setMessage(successMessage);
      await reload();
    }
    setActing(false);
  };

  const confirmManualPayment = async (registration: RegistrationWithFighter) => {
    if (!window.confirm(t('events.engine.participantsPage.paymentConfirm', { name: participantName(registration) }))) return;
    setActing(true);
    setError(null);
    setMessage(null);
    const result = await confirmManualEventParticipantPayment(registration.id);
    if (result.error) setError(result.error);
    else {
      setMessage(t('events.engine.participantsPage.paymentConfirmed', { name: participantName(registration) }));
      await reload();
    }
    setActing(false);
  };

  const confirmAllAcceptedManualPayments = async () => {
    if (acceptedAwaitingPayment.length === 0) return;
    if (!window.confirm(t('events.engine.participantsPage.confirmAllPaymentsPrompt', { count: acceptedAwaitingPayment.length }))) return;
    setActing(true);
    setError(null);
    setMessage(null);
    const result = await confirmAcceptedManualEventParticipantPayments(eventId);
    if (result.error) setError(result.error);
    else {
      const confirmedCount = result.data?.length ?? 0;
      setMessage(t('events.engine.participantsPage.paymentsConfirmed', { count: confirmedCount }));
      await reload();
    }
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

  if (loading || profile === undefined) return <Frame><p className="text-sm text-zinc-500">{t('events.engine.participantsPage.loading')}</p></Frame>;
  if (!canManage) return <Frame><h1 className="text-3xl font-black uppercase">{t('events.engine.participantsPage.title')}</h1><p className="mt-3 text-sm text-zinc-600">{t('events.engine.participantsPage.noPermission')}</p></Frame>;

  return (
    <Frame>
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">Strikers Match</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-zinc-900 sm:text-5xl">{t('events.engine.participantsPage.title')}</h1>
          <p className="mt-2 text-sm text-zinc-600">{event?.event_name} · {t('events.engine.participantsPage.authorizedRoster')}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/events/${eventId}/manage/matchmaking`} className="flex min-h-11 items-center justify-center bg-zinc-900 px-4 text-xs font-bold uppercase text-white">{t('events.engine.matchmaking.title')}</Link>
          <Link href={`/events/${eventId}/manage/settings`} className="flex min-h-11 items-center justify-center border border-zinc-300 px-4 text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.settings')}</Link>
        </div>
      </header>

      {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section className="grid grid-cols-2 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label={t('events.engine.participantsPage.metrics.accepted')} value={participantMetrics.accepted} />
        <Metric label={t('events.engine.participantsPage.metrics.pendingPayment')} value={participantMetrics.pendingPayment} />
        <Metric label={t('events.engine.participantsPage.metrics.submittedPayment')} value={participantMetrics.submittedPayment} />
        <Metric label={t('events.engine.participantsPage.metrics.confirmedPayment')} value={participantMetrics.confirmedPayment} />
        <Metric label={t('events.engine.participantsPage.metrics.reviewRequired')} value={participantMetrics.reviewRequired} />
        <Metric label={t('events.engine.participantsPage.metrics.ready')} value={participantMetrics.ready} />
      </section>

      {acceptedAwaitingPayment.length > 0 && paymentSettings?.payment_method !== 'stripe' && (
        <section className="flex flex-col gap-3 border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-emerald-950">{t('events.engine.participantsPage.awaitingPayment', { count: acceptedAwaitingPayment.length })}</p>
            <p className="mt-1 text-xs text-emerald-800">{t('events.engine.participantsPage.awaitingPaymentHelp')}</p>
          </div>
          <button
            type="button"
            onClick={() => void confirmAllAcceptedManualPayments()}
            disabled={acting}
            className="min-h-11 shrink-0 bg-emerald-700 px-4 text-xs font-bold uppercase text-white disabled:opacity-40"
          >
            {t('events.engine.participantsPage.confirmAll', { count: acceptedAwaitingPayment.length })}
          </button>
        </section>
      )}

      <section className="border border-zinc-200 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-black uppercase">{editingId ? t('events.engine.participantsPage.editEventData') : t('events.engine.participantsPage.addFighter')}</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">{t('events.engine.participantsPage.formPrivacyHelp')}</p>
          </div>
          {editingId && <button type="button" onClick={reset} className="min-h-11 border border-zinc-300 px-4 text-xs font-bold uppercase">{t('events.engine.participantsPage.cancelEdit')}</button>}
        </div>

        {!editingId && (
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <ModeButton active={source === 'platform'} onClick={() => { reset(); setSource('platform'); }} label={t('events.engine.participantsPage.platformProfile')} />
            <ModeButton active={source === 'roster'} onClick={() => { reset(); setSource('roster'); }} label={t('events.engine.participantsPage.manualRoster')} />
            <ModeButton active={source === 'event_only'} onClick={() => { reset(); setSource('event_only'); }} label={t('events.engine.participantsPage.quickEventEntry')} />
          </div>
        )}

        {!editingId && source !== 'event_only' && (
          <div className="mt-4">
            <label htmlFor="participant-fighter-search" className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.participantsPage.searchFighter')}</span>
              <input
                id="participant-fighter-search"
                type="search"
                value={fighterSearch}
                onChange={(input) => {
                  setFighterSearch(input.target.value);
                  setSelectedFighterId('');
                  setError(null);
                }}
                placeholder={source === 'platform'
                  ? t('events.engine.participantsPage.searchPlatformPlaceholder')
                  : t('events.engine.participantsPage.searchRosterPlaceholder')}
                autoComplete="off"
                className="min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
              />
            </label>
            <select
              aria-label={t('events.engine.participantsPage.searchResults')}
              value={selectedFighterId}
              onChange={(input) => {
                const nextId = input.target.value;
                const selected = existingFighterCandidates.find((fighter) => fighter.id === nextId);
                if (selected) setFighterSearch(existingFighterName(selected, source, t('events.engine.participantsPage.unnamedProfile')));
                setParticipantPhotoFile(null);
                setParticipantPhotoPreview(null);
                selectExistingParticipant(nextId, source, platformFighters, rosterFighters, setSelectedFighterId, event?.signup_fee && event.signup_fee > 0 ? 'pending' : 'waived', event?.event_date ?? null, event?.disciplines_needed ?? [], event?.weight_classes_needed ?? [], setForm);
              }}
              disabled={!fighterSearch.trim() || existingFighterCandidates.length === 0}
              className="mt-2 min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            >
              <option value="">{fighterSearch.trim() ? t('events.engine.participantsPage.selectSearchResult') : t('events.engine.participantsPage.typeNameFirst')}</option>
              {existingFighterCandidates.map((fighter) => (
                <option key={fighter.id} value={fighter.id}>{existingFighterName(fighter, source, t('events.engine.participantsPage.unnamedProfile'))} · {weightClassLabel(fighter.weight_class)}</option>
              ))}
            </select>
            <ExistingFighterSearchResultCount query={fighterSearch} count={existingFighterCandidates.length} />
          </div>
        )}

        <ParticipantFields
          form={form}
          setForm={setForm}
          showIdentity={source === 'event_only' || Boolean(editingId)}
          eventDate={event?.event_date ?? null}
          eventWeightClasses={event?.weight_classes_needed ?? []}
          photoFile={participantPhotoFile}
          photoPreview={participantPhotoPreview}
          onSelectPhoto={selectParticipantPhoto}
        />

        {!editingId && source === 'event_only' && (
          <label className="mt-4 flex items-start gap-3 border border-zinc-200 p-3 text-sm text-zinc-700">
            <input type="checkbox" checked={publishToRoster} onChange={(input) => setPublishToRoster(input.target.checked)} className="mt-1 h-4 w-4 accent-[#C0001E]" />
            {t('events.engine.participantsPage.saveToRosterHelp')}
          </label>
        )}
        <label className="mt-4 flex items-start gap-3 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <input type="checkbox" checked={form.representative_confirmed} onChange={(input) => setForm({ ...form, representative_confirmed: input.target.checked })} className="mt-1 h-4 w-4 accent-[#C0001E]" />
          {t('events.engine.participantsPage.authorizationConfirmation')}
        </label>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={save} disabled={acting} className="min-h-11 bg-[#C0001E] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:bg-zinc-300">{acting ? t('events.engine.participantsPage.saving') : editingId ? t('events.engine.participantsPage.updateParticipant') : t('events.engine.participantsPage.addToEvent')}</button>
        </div>
      </section>

      {acceptedWithoutRegistration.length > 0 && (
        <section className="border border-amber-200 bg-amber-50 p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black uppercase text-amber-950">{t('events.engine.participantsPage.acceptedWithoutRegistration')}</h2>
              <p className="mt-1 text-sm text-amber-900">{t('events.engine.participantsPage.acceptedWithoutRegistrationHelp')}</p>
            </div>
            <span className="text-sm font-bold text-amber-900">{acceptedWithoutRegistration.length}</span>
          </div>
          <div className="mt-4 space-y-2">
            {acceptedWithoutRegistration.map((application) => (
              <article key={application.id} className="flex flex-col gap-3 border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-zinc-900">{application.fighters?.profiles?.full_name ?? '—'}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {application.fighter_discipline ?? t('events.engine.matchmaking.pendingDiscipline')} · {application.fighter_weight_class ?? weightClassLabel(application.fighters?.weight_class)}
                  </p>
                </div>
                <button type="button" onClick={() => prepareAcceptedApplication(application)} className="min-h-11 bg-[#C0001E] px-4 py-3 text-xs font-bold uppercase text-white">
                  {t('events.engine.participantsPage.completeRegistration')}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase">{t('events.engine.participantsPage.eventRoster')}</h2>
            <span className="text-sm text-zinc-500">{t('events.engine.participantsPage.participantCount', { count: registrations.length })}</span>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <label>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.participantsPage.fields.discipline')}</span>
              <select
                value={disciplineFilter}
                onChange={(input) => setDisciplineFilter(input.target.value)}
                className="min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-900 sm:min-w-64"
              >
                <option value="all">{t('events.engine.participantsPage.allDisciplines', { count: registrations.length })}</option>
                {disciplineOptions.map((discipline) => (
                  <option key={discipline} value={discipline}>{discipline}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <FilterButton active={participantFilter === 'all'} onClick={() => setParticipantFilter('all')} label={t('events.engine.participantsPage.filters.all')} />
              <FilterButton active={participantFilter === 'needs_attention'} onClick={() => setParticipantFilter('needs_attention')} label={t('events.engine.participantsPage.filters.needsAttention')} />
              <FilterButton active={participantFilter === 'ready'} onClick={() => setParticipantFilter('ready')} label={t('events.engine.participantsPage.filters.ready')} />
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {visibleRegistrations.length === 0 ? <p className="border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">{registrations.length === 0 ? t('events.engine.participantsPage.noRegisteredFighters') : t('events.engine.participantsPage.noFilteredParticipants')}</p> : visibleRegistrations.map((registration) => {
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
                      <ApprovalStatusBadge value={registration.approval_status} />
                      <span className="border border-zinc-200 px-2 py-1 text-[10px] font-bold uppercase text-zinc-600">{registration.registration_source}</span>
                      {alreadyMatched && <span className="bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase text-white">{t('events.engine.participantsPage.alreadyMatched')}</span>}
                    </div>
                    <EligibilityStatus status={registration.eligibility_status} reasons={registration.eligibility_reasons} showReasons />
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-600 sm:grid-cols-2 lg:grid-cols-3">
                      <Info label={t('events.engine.participantsPage.info.weight')} value={`${weightClassLabel(registration.registered_weight_class)} · ${formatKg(registration.weigh_in_weight)} ${t('events.engine.participantsPage.actual')}`} />
                      <Info label={t('events.engine.participantsPage.info.requestedRange')} value={`${formatKg(registration.requested_weight_kg)} · ${formatRange(registration.acceptable_weight_min_kg, registration.acceptable_weight_max_kg)}`} />
                      <Info label={t('events.engine.participantsPage.info.ageDivision')} value={`${t('events.engine.matchmaking.ageYears', { age: registration.age_at_event ?? '—' })} · ${registration.gender_division ?? '—'}`} />
                      <Info label={t('events.engine.participantsPage.info.disciplineRuleset')} value={`${registration.registered_discipline ?? '—'} · ${registration.ruleset ?? '—'}`} />
                      <Info label={t('events.engine.participantsPage.info.experienceLevel')} value={`${registration.experience_level ?? '—'} · ${registration.skill_rating ?? '—'}/10`} />
                      <Info label={t('events.engine.participantsPage.info.teamLocation')} value={`${registration.team_name ?? '—'} · ${[registration.city, registration.state].filter(Boolean).join(', ') || '—'}`} />
                      <div><span className="font-bold uppercase text-zinc-400">{t('events.engine.participantsPage.info.record')}</span><div className="mt-0.5"><InlineCombatRecord wins={registration.record_wins} losses={registration.record_losses} draws={registration.record_draws} winLabel="W" lossLabel="L" drawLabel="D" /></div></div>
                      <Info label="KO/TKO" value={t('events.engine.matchmaking.knockoutRecord', { wins: registration.ko_wins + registration.tko_wins, losses: registration.ko_losses + registration.tko_losses })} />
                      <Info label={t('events.engine.matchmaking.availability')} value={`${registration.availability_confirmed ? t('events.engine.matchmaking.confirmed') : t('events.engine.matchmaking.pending')} · ${registration.available_from ?? t('events.engine.matchmaking.now')}–${registration.available_to ?? t('events.engine.matchmaking.openEnded')}`} />
                      <Info label={t('events.engine.participantsPage.info.scheduledBouts')} value={`${scheduledCount} · ${alreadyMatched ? t('events.engine.participantsPage.alreadyMatched') : t('events.engine.participantsPage.available')}`} />
                    </div>
                    {registration.special_restrictions.length > 0 && <p className="mt-3 border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><strong>{t('events.engine.participantsPage.privateRestrictions')}:</strong> {registration.special_restrictions.join(' · ')}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                    {registration.approval_status !== 'accepted' && (
                      <button
                        type="button"
                        onClick={() => quickUpdate(
                          registration,
                          { approval_status: 'accepted' },
                          t('events.engine.participantsPage.approvedMessage', { name: participantName(registration) })
                        )}
                        disabled={acting}
                        className="min-h-11 border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold uppercase text-emerald-900 disabled:opacity-40"
                      >
                        {t('events.engine.participantsPage.approve')}
                      </button>
                    )}
                    {!['confirmed', 'waived'].includes(registration.payment_status) && paymentSettings?.payment_method !== 'stripe' && (
                      <button
                        type="button"
                        onClick={() => void confirmManualPayment(registration)}
                        disabled={acting}
                        className="min-h-11 bg-emerald-700 px-3 text-xs font-bold uppercase text-white disabled:opacity-40"
                      >
                        {t('events.engine.participantsPage.markPaid')}
                      </button>
                    )}
                    {!['confirmed', 'waived'].includes(registration.payment_status) && paymentSettings?.payment_method === 'stripe' && (
                      <span className="inline-flex min-h-11 items-center border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-900">
                        {t('events.engine.participantsPage.stripeAutomatic')}
                      </span>
                    )}
                    <button type="button" onClick={() => edit(registration)} className="min-h-11 border border-zinc-300 px-3 text-xs font-bold uppercase">{registration.eligibility_status === 'eligible' ? t('events.engine.participantsPage.edit') : t('events.engine.participantsPage.completeInformation')}</button>
                    <button type="button" onClick={() => toggleHistory(registration.id)} className="min-h-11 border border-zinc-300 px-3 text-xs font-bold uppercase">{historyLoading === registration.id ? '…' : history ? t('events.engine.participantsPage.close') : t('events.engine.participantsPage.history')}</button>
                    <button type="button" onClick={() => remove(registration)} disabled={acting || alreadyMatched} title={alreadyMatched ? t('events.engine.participantsPage.removeBlocked') : ''} className="min-h-11 border border-red-200 px-3 text-xs font-bold uppercase text-red-700 disabled:opacity-40">{t('events.engine.participantsPage.remove')}</button>
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

function ParticipantFields({
  form,
  setForm,
  showIdentity,
  eventDate,
  eventWeightClasses,
  photoFile,
  photoPreview,
  onSelectPhoto,
}: {
  form: ParticipantForm;
  setForm: (form: ParticipantForm) => void;
  showIdentity: boolean;
  eventDate: string | null;
  eventWeightClasses: string[];
  photoFile: File | null;
  photoPreview: string | null;
  onSelectPhoto: (file: File | null) => void;
}) {
  const { t } = useTranslation('events');
  const change = <K extends keyof ParticipantForm>(key: K, value: ParticipantForm[K]) => setForm({ ...form, [key]: value });
  const changeAndInferWeightCategory = <K extends 'discipline' | 'date_of_birth' | 'exact_weight'>(key: K, value: ParticipantForm[K]) => {
    const next = { ...form, [key]: value };
    const inferredCategory = inferCombatWeightCategory(
      next.discipline,
      calculateAgeOnDate(next.date_of_birth, eventDate),
      numberValue(next.exact_weight),
      eventWeightClasses
    );
    setForm(next.discipline === 'Boxeo'
      ? { ...next, weight_class: inferredCategory ?? '' }
      : inferredCategory ? { ...next, weight_class: inferredCategory } : next);
  };
  return (
    <div className="mt-5 space-y-5">
      {showIdentity && <FieldGroup title={t('events.engine.participantsPage.groups.identity')}>
        <TextField label={t('events.engine.participantsPage.fields.fullName')} value={form.full_name} onChange={(value) => change('full_name', value)} />
        <TextField label={t('events.engine.participantsPage.fields.nickname')} value={form.nickname} onChange={(value) => change('nickname', value)} />
        <TextField label={t('events.engine.participantsPage.fields.privatePhone')} value={form.phone} onChange={(value) => change('phone', value)} />
        <TextField label={t('events.engine.participantsPage.fields.privateEmail')} type="email" value={form.email} onChange={(value) => change('email', value)} />
        <label>
          <span className="mb-1 block text-xs font-bold uppercase text-zinc-600">{t('events.engine.participantsPage.fields.fighterPhoto')}</span>
          <span className="flex items-center gap-3">
            <span className="relative block h-16 w-16 shrink-0 overflow-hidden border border-zinc-300 bg-zinc-100">
              {photoPreview || form.photo_url ? (
                <Image
                  src={photoPreview ?? form.photo_url}
                  alt={t('events.engine.participantsPage.fields.fighterPhoto')}
                  fill
                  className="object-cover"
                  unoptimized={Boolean(photoPreview)}
                />
              ) : (
                <span className="flex h-full items-center justify-center text-center text-[10px] uppercase text-zinc-400">{t('events.engine.participantsPage.noPhoto')}</span>
              )}
            </span>
            <span>
              <span className="inline-flex min-h-11 cursor-pointer items-center border border-zinc-900 bg-zinc-900 px-3 text-xs font-bold uppercase tracking-wide text-white">
                {photoFile || form.photo_url ? t('events.engine.participantsPage.changePhoto') : t('events.engine.participantsPage.selectPhoto')}
                <input
                  type="file"
                  accept={ACCEPTED_PHOTO_TYPES}
                  className="sr-only"
                  onChange={(input) => onSelectPhoto(input.target.files?.[0] ?? null)}
                />
              </span>
              <span className="mt-1 block text-[11px] text-zinc-500">{t('events.engine.participantsPage.photoHelp')}</span>
            </span>
          </span>
        </label>
      </FieldGroup>}
      <FieldGroup title={t('events.engine.participantsPage.groups.combatData')}>
        <SelectField label={t('events.engine.participantsPage.fields.discipline')} value={form.discipline} onChange={(value) => changeAndInferWeightCategory('discipline', value)} options={disciplineOptions(form.discipline, t)} />
        <TextField label={t('events.engine.participantsPage.fields.dateOfBirth')} type="date" value={form.date_of_birth} onChange={(value) => changeAndInferWeightCategory('date_of_birth', value)} />
        <GenderDivisionCheckboxes value={form.gender_division} onChange={(value) => change('gender_division', value)} />
        <WeightCategoryField
          discipline={form.discipline}
          dateOfBirth={form.date_of_birth}
          eventDate={eventDate}
          eventWeightClasses={eventWeightClasses}
          exactWeight={form.exact_weight}
          value={form.weight_class}
          onChange={(value) => change('weight_class', value)}
          t={t}
        />
        <TextField label={t('events.engine.participantsPage.fields.actualWeight')} type="number" value={form.exact_weight} onChange={(value) => changeAndInferWeightCategory('exact_weight', value)} />
        <p className="text-xs text-zinc-500">{t('events.engine.participantsPage.weightSyncHelp')}</p>
        <TextField label={t('events.engine.participantsPage.fields.requestedWeight')} type="number" value={form.requested_weight_kg} onChange={(value) => change('requested_weight_kg', value)} />
        <TextField label={t('events.engine.participantsPage.fields.minimumWeight')} type="number" value={form.acceptable_weight_min_kg} onChange={(value) => change('acceptable_weight_min_kg', value)} />
        <TextField label={t('events.engine.participantsPage.fields.maximumWeight')} type="number" value={form.acceptable_weight_max_kg} onChange={(value) => change('acceptable_weight_max_kg', value)} />
        <TextField label={t('events.engine.participantsPage.fields.ruleset')} value={form.ruleset} onChange={(value) => change('ruleset', value)} />
        <TextField label={t('events.engine.participantsPage.fields.boutFormat')} value={form.bout_format} onChange={(value) => change('bout_format', value)} placeholder="3 x 3 min" />
        <SelectField label={t('events.engine.participantsPage.fields.competitionClass')} value={form.experience_level} onChange={(value) => change('experience_level', value as 'amateur' | 'pro')} options={[['amateur', t('events.engine.participantsPage.amateur')], ['pro', t('events.engine.participantsPage.professional')]]} />
        <TextField label={t('events.engine.participantsPage.fields.skillRating')} type="number" value={form.skill_rating} onChange={(value) => change('skill_rating', value)} />
      </FieldGroup>
      <FieldGroup title={t('events.engine.participantsPage.groups.recordExperience')}>
        <TextField label={t('events.engine.participantsPage.fields.wins')} type="number" value={form.record_wins} onChange={(value) => change('record_wins', value)} />
        <TextField label={t('events.engine.participantsPage.fields.losses')} type="number" value={form.record_losses} onChange={(value) => change('record_losses', value)} />
        <TextField label={t('events.engine.participantsPage.fields.draws')} type="number" value={form.record_draws} onChange={(value) => change('record_draws', value)} />
        <TextField label={t('events.engine.participantsPage.fields.koWins')} type="number" value={form.ko_wins} onChange={(value) => change('ko_wins', value)} />
        <TextField label={t('events.engine.participantsPage.fields.tkoWins')} type="number" value={form.tko_wins} onChange={(value) => change('tko_wins', value)} />
        <TextField label={t('events.engine.participantsPage.fields.koLosses')} type="number" value={form.ko_losses} onChange={(value) => change('ko_losses', value)} />
        <TextField label={t('events.engine.participantsPage.fields.tkoLosses')} type="number" value={form.tko_losses} onChange={(value) => change('tko_losses', value)} />
        <TextField label={t('events.engine.participantsPage.fields.lastFight')} type="date" value={form.last_fight_at} onChange={(value) => change('last_fight_at', value)} />
        <TextField label={t('events.engine.participantsPage.fields.lastKoLoss')} type="date" value={form.last_ko_loss_at} onChange={(value) => change('last_ko_loss_at', value)} />
      </FieldGroup>
      <FieldGroup title={t('events.engine.participantsPage.groups.teamLocation')}>
        <TextField label={t('events.engine.participantsPage.fields.gymTeam')} value={form.gym_name} onChange={(value) => change('gym_name', value)} />
        <TextField label={t('events.engine.participantsPage.fields.city')} value={form.city} onChange={(value) => change('city', value)} />
        <TextField label={t('events.engine.participantsPage.fields.state')} value={form.state} onChange={(value) => change('state', value)} />
        <TextField label={t('events.engine.participantsPage.fields.country')} value={form.country} onChange={(value) => change('country', value)} />
        <TextField label={t('events.engine.participantsPage.fields.availableFrom')} type="date" value={form.available_from} onChange={(value) => change('available_from', value)} />
        <TextField label={t('events.engine.participantsPage.fields.availableTo')} type="date" value={form.available_to} onChange={(value) => change('available_to', value)} />
        <TextField label={t('events.engine.participantsPage.fields.medicalClearance')} type="date" value={form.medical_clearance_date} onChange={(value) => change('medical_clearance_date', value)} />
        <SelectField label={t('events.engine.participantsPage.fields.participation')} value={form.approval_status} onChange={(value) => change('approval_status', value as EventRegistration['approval_status'])} options={[['accepted', t('events.engine.participantsPage.status.accepted')], ['pending', t('events.engine.participantsPage.status.pending')], ['declined', t('events.engine.participantsPage.status.declined')], ['withdrawn', t('events.engine.participantsPage.status.withdrawn')]]} />
        <ReadOnlyField label={t('events.engine.participantsPage.fields.payment')} value={paymentStatusLabel(form.payment_status, t)} />
      </FieldGroup>
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.participantsPage.fields.specialRestrictions')}</span>
        <textarea rows={2} value={form.special_restrictions} onChange={(input) => change('special_restrictions', input.target.value)} className="w-full border border-zinc-300 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.participantsPage.fields.authorizationNote')}</span>
        <input value={form.representative_confirmation_note} onChange={(input) => change('representative_confirmation_note', input.target.value)} className="min-h-11 w-full border border-zinc-300 px-3 text-sm" />
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <CheckField label={t('events.engine.participantsPage.fields.weightConfirmed')} checked={form.weight_confirmed} onChange={(value) => change('weight_confirmed', value)} />
        <CheckField label={t('events.engine.participantsPage.fields.availabilityConfirmed')} checked={form.availability_confirmed} onChange={(value) => change('availability_confirmed', value)} />
        <CheckField label={t('events.engine.participantsPage.fields.minorConsent')} checked={form.minor_consent_confirmed} onChange={(value) => change('minor_consent_confirmed', value)} />
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
    last_ko_loss_at: clean(form.last_ko_loss_at) ?? null, approval_status: form.approval_status,
    availability_confirmed: form.availability_confirmed, weight_confirmed: form.weight_confirmed,
    representative_confirmation_note: clean(form.representative_confirmation_note) ?? null,
    representative_confirmed_at: form.representative_confirmed ? new Date().toISOString() : null,
    minor_consent_verified_at: form.minor_consent_confirmed ? new Date().toISOString() : null,
  };
}

function formFromRegistration(registration: RegistrationWithFighter): ParticipantForm {
  return {
    ...EMPTY_FORM,
    full_name: participantName(registration), nickname: registration.nickname ?? '', photo_url: registration.photo_url ?? '', city: registration.city ?? '', state: registration.state ?? '', country: registration.country ?? '',
    date_of_birth: registration.date_of_birth ?? '', gender_division: registration.gender_division ?? '', weight_class: registration.registered_weight_class ?? '', exact_weight: stringValue(registration.weigh_in_weight),
    requested_weight_kg: stringValue(registration.requested_weight_kg), acceptable_weight_min_kg: stringValue(registration.acceptable_weight_min_kg), acceptable_weight_max_kg: stringValue(registration.acceptable_weight_max_kg),
    discipline: registration.registered_discipline ?? '', ruleset: registration.ruleset ?? '', bout_format: registration.bout_format ?? '', experience_level: registration.experience_level ?? 'amateur', skill_rating: stringValue(registration.skill_rating),
    record_wins: stringValue(registration.record_wins, '0'), record_losses: stringValue(registration.record_losses, '0'), record_draws: stringValue(registration.record_draws, '0'),
    ko_wins: String(registration.ko_wins), tko_wins: String(registration.tko_wins), ko_losses: String(registration.ko_losses), tko_losses: String(registration.tko_losses),
    gym_name: registration.team_name ?? '', special_restrictions: registration.special_restrictions.join(', '), available_from: registration.available_from ?? '', available_to: registration.available_to ?? '',
    medical_clearance_date: registration.medical_clearance_date ?? '', last_fight_at: registration.last_fight_at ?? '', last_ko_loss_at: registration.last_ko_loss_at ?? '', payment_status: registration.payment_status, availability_confirmed: registration.availability_confirmed, weight_confirmed: registration.weight_confirmed,
    approval_status: registration.approval_status,
    representative_confirmed: Boolean(registration.representative_confirmed_at), representative_confirmation_note: registration.representative_confirmation_note ?? '', minor_consent_confirmed: Boolean(registration.minor_consent_verified_at),
  };
}

function selectExistingParticipant(
  fighterId: string,
  source: SourceMode,
  platformFighters: PlatformFighter[],
  rosterFighters: ManualFighter[],
  setSelectedFighterId: (value: string) => void,
  defaultPaymentStatus: EventRegistration['payment_status'],
  eventDate: string | null,
  eventDisciplines: string[],
  eventWeightClasses: string[],
  setForm: (value: ParticipantForm) => void
) {
  setSelectedFighterId(fighterId);
  if (!fighterId) { setForm({ ...EMPTY_FORM, payment_status: defaultPaymentStatus }); return; }
  if (source === 'platform') {
    const fighter = platformFighters.find((item) => item.id === fighterId);
    if (!fighter) return;
    const discipline = fighter.disciplines?.find((item) => eventDisciplines.length === 0 || disciplineMatches(eventDisciplines, item))
      ?? fighter.disciplines?.[0]
      ?? '';
    const weightClass = inferCombatWeightCategory(
      discipline,
      calculateAgeOnDate(fighter.profiles?.date_of_birth ?? '', eventDate) ?? fighter.age ?? null,
      fighter.exact_weight,
      eventWeightClasses
    ) ?? fighter.weight_class ?? '';
    setForm({
      ...EMPTY_FORM,
      payment_status: defaultPaymentStatus,
      full_name: fighter.profiles?.full_name ?? '', nickname: fighter.nickname ?? '', photo_url: fighter.photo_url ?? '',
      city: fighter.profiles?.city ?? '', state: fighter.state ?? fighter.profiles?.state ?? '', country: fighter.profiles?.country ?? '',
      date_of_birth: fighter.profiles?.date_of_birth ?? '', gender_division: fighter.gender_division ?? '', weight_class: weightClass, exact_weight: stringValue(fighter.exact_weight),
      requested_weight_kg: stringValue(fighter.requested_weight_kg), acceptable_weight_min_kg: stringValue(fighter.acceptable_weight_min_kg), acceptable_weight_max_kg: stringValue(fighter.acceptable_weight_max_kg),
      discipline, ruleset: fighter.preferred_rulesets?.[0] ?? '', experience_level: fighter.experience_level ?? 'amateur', skill_rating: stringValue(fighter.skill_rating),
      record_wins: String(fighter.record_wins ?? 0), record_losses: String(fighter.record_losses ?? 0), record_draws: String(fighter.record_draws ?? 0), ko_wins: String(fighter.ko_wins ?? 0), tko_wins: String(fighter.tko_wins ?? 0), ko_losses: String(fighter.ko_losses ?? 0), tko_losses: String(fighter.tko_losses ?? 0),
      gym_name: fighter.gym_name ?? '', special_restrictions: fighter.special_restrictions?.join(', ') ?? '', available_from: fighter.available_from ?? '', available_to: fighter.available_to ?? '', medical_clearance_date: fighter.medical_clearance_date ?? '', last_fight_at: fighter.last_fight_at ?? '', last_ko_loss_at: fighter.last_ko_loss_at ?? '',
    });
  } else {
    const fighter = rosterFighters.find((item) => item.id === fighterId);
    if (!fighter) return;
    const fighterDisciplines = normalizeDisciplineList(fighter.disciplines, fighter.discipline);
    const discipline = fighterDisciplines.find((item) => eventDisciplines.length === 0 || disciplineMatches(eventDisciplines, item))
      ?? fighterDisciplines[0]
      ?? '';
    const weightClass = inferCombatWeightCategory(
      discipline,
      calculateAgeOnDate(fighter.date_of_birth ?? '', eventDate),
      fighter.exact_weight,
      eventWeightClasses
    ) ?? fighter.weight_class ?? '';
    setForm({
      ...EMPTY_FORM,
      payment_status: defaultPaymentStatus,
      full_name: fighter.full_name, nickname: fighter.nickname ?? '', photo_url: fighter.photo_url ?? '', phone: fighter.phone ?? '', email: fighter.email ?? '', city: fighter.city ?? '', state: fighter.state ?? '', country: fighter.country ?? '',
      date_of_birth: fighter.date_of_birth ?? '', gender_division: fighter.gender_division ?? '', weight_class: weightClass, exact_weight: stringValue(fighter.exact_weight), requested_weight_kg: stringValue(fighter.requested_weight_kg), acceptable_weight_min_kg: stringValue(fighter.acceptable_weight_min_kg), acceptable_weight_max_kg: stringValue(fighter.acceptable_weight_max_kg),
      discipline, ruleset: fighter.preferred_rulesets?.[0] ?? '', experience_level: fighter.experience_level ?? 'amateur', skill_rating: stringValue(fighter.skill_rating), record_wins: String(fighter.record_wins ?? 0), record_losses: String(fighter.record_losses ?? 0), record_draws: String(fighter.record_draws ?? 0), ko_wins: String(fighter.ko_wins ?? 0), tko_wins: String(fighter.tko_wins ?? 0), ko_losses: String(fighter.ko_losses ?? 0), tko_losses: String(fighter.tko_losses ?? 0),
      gym_name: fighter.gym_name ?? '', special_restrictions: fighter.special_restrictions?.join(', ') ?? '', available_from: fighter.available_from ?? '', available_to: fighter.available_to ?? '', medical_clearance_date: fighter.medical_clearance_date ?? '', last_fight_at: fighter.last_fight_at ?? '', last_ko_loss_at: fighter.last_ko_loss_at ?? '',
    });
  }
}

function participantName(registration: RegistrationWithFighter) { return registration.display_name ?? registration.fighters?.profiles?.full_name ?? registration.manual_fighters?.full_name ?? '—'; }
function existingFighterName(fighter: PlatformFighter | ManualFighter, source: SourceMode, unnamedProfile: string) {
  return source === 'platform'
    ? (fighter as PlatformFighter).profiles?.full_name ?? unnamedProfile
    : (fighter as ManualFighter).full_name;
}
function ExistingFighterSearchResultCount({ query, count }: { query: string; count: number }) {
  const { t } = useTranslation('events');
  if (!query.trim()) return <p className="mt-1 text-xs text-zinc-500">{t('events.engine.matchmaking.typeNameToFilter')}</p>;
  return (
    <p className={`mt-1 text-xs ${count > 0 ? 'text-zinc-500' : 'font-medium text-amber-800'}`}>
      {count > 0
        ? t('events.engine.matchmaking.searchResultCount', { count })
        : t('events.engine.matchmaking.noSearchResults')}
    </p>
  );
}
function clean(value: string) { return value.trim() || undefined; }
function numberValue(value: string) { return value === '' ? undefined : Number(value); }
function stringValue(value: number | null, fallback = '') { return value == null ? fallback : String(value); }
function commaList(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
function formatKg(value: number | null) { return value == null ? '—' : `${value} kg`; }
function formatRange(minimum: number | null, maximum: number | null) { return minimum == null && maximum == null ? '—' : `${minimum ?? '—'}–${maximum ?? '—'} kg`; }
function weightClassLabel(value: string | null) { return value ? (WEIGHT_CLASS_LABELS[value] ?? value) : 'peso pendiente'; }
function weightClassOptions(current: string) {
  if (!current || WEIGHT_CLASS_LABELS[current]) return GENERIC_WEIGHT_CLASS_OPTIONS;
  return [GENERIC_WEIGHT_CLASS_OPTIONS[0], [current, `${current} (valor actual)`], ...GENERIC_WEIGHT_CLASS_OPTIONS.slice(1)];
}
function disciplineOptions(current: string, t: TFunction<'events'>) {
  const options = [['', t('events.engine.participantsPage.selectDiscipline')], ...DISCIPLINE_OPTIONS.map((discipline) => [discipline, discipline])];
  if (!current || DISCIPLINE_OPTIONS.includes(current)) return options;
  return [options[0], [current, t('events.engine.participantsPage.currentValue', { value: current })], ...options.slice(1)];
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) { return <fieldset><legend className="mb-3 text-xs font-black uppercase tracking-widest text-[#C0001E]">{title}</legend><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div></fieldset>; }
function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label><span className="mb-1 block text-xs font-bold uppercase text-zinc-600">{label}</span><input type={type} min={type === 'number' ? 0 : undefined} value={value} placeholder={placeholder} onChange={(input) => onChange(input.target.value)} className="min-h-11 w-full border border-zinc-300 px-3 text-sm" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label><span className="mb-1 block text-xs font-bold uppercase text-zinc-600">{label}</span><select value={value} onChange={(input) => onChange(input.target.value)} className="min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm">{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>; }
function ReadOnlyField({ label, value }: { label: string; value: string }) { return <div><span className="mb-1 block text-xs font-bold uppercase text-zinc-600">{label}</span><div className="flex min-h-11 items-center border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600">{value}</div></div>; }
function WeightCategoryField({ discipline, dateOfBirth, eventDate, eventWeightClasses, exactWeight, value, onChange, t }: { discipline: string; dateOfBirth: string; eventDate: string | null; eventWeightClasses: string[]; exactWeight: string; value: string; onChange: (value: string) => void; t: TFunction<'events'> }) {
  const ageAtEvent = calculateAgeOnDate(dateOfBirth, eventDate);
  const inferredCategory = inferCombatWeightCategory(discipline, ageAtEvent, numberValue(exactWeight), eventWeightClasses);
  const allGroups = getCombatWeightGroups(discipline);
  const configuredWeightClasses = sanitizeWeightClasses(eventWeightClasses);
  if (allGroups.length === 0) {
    const configuredOptions = configuredWeightClasses.length > 0
      ? [['', t('events.engine.participantsPage.selectCategory')], ...configuredWeightClasses.map((weightClass) => [weightClass, WEIGHT_CLASS_LABELS[weightClass] ?? weightClass])]
      : weightClassOptions(value);
    const options = value && !configuredOptions.some(([key]) => key === value)
      ? [configuredOptions[0], [value, t('events.engine.participantsPage.currentValue', { value })], ...configuredOptions.slice(1)]
      : configuredOptions;
    return <SelectField label={t('events.engine.participantsPage.fields.weightCategory')} value={value} onChange={onChange} options={options} />;
  }

  const ageGroups = getCombatWeightGroupsForAge(discipline, ageAtEvent);
  const visibleGroups = restrictWeightGroupsToEvent(ageGroups, configuredWeightClasses);
  const visibleWeights = new Set(visibleGroups.flatMap((group) => group.weights));
  const preservesCurrentValue = Boolean(value) && !visibleWeights.has(value);

  return (
    <label>
      <span className="mb-1 block text-xs font-bold uppercase text-zinc-600">{t('events.engine.participantsPage.ageWeightCategory')}</span>
      <select value={value} onChange={(input) => onChange(input.target.value)} className="min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm">
        <option value="">{t('events.engine.participantsPage.selectCategory')}</option>
        {preservesCurrentValue && <option value={value}>{t('events.engine.participantsPage.currentValue', { value })}</option>}
        {visibleGroups.map((group) => (
          <optgroup key={group.group} label={group.group}>
            {group.weights.map((weight) => <option key={`${group.group}:${weight}`} value={weight}>{weight}</option>)}
          </optgroup>
        ))}
      </select>
      <span className="mt-1 block text-xs text-zinc-500">
        {inferredCategory
          ? t('events.engine.participantsPage.categoryInferred', { category: inferredCategory })
          : ageAtEvent == null
          ? t('events.engine.participantsPage.addBirthDateHelp')
          : t('events.engine.participantsPage.eventAgeGroups', { age: ageAtEvent, groups: visibleGroups.map((group) => group.group).join(', ') })}
      </span>
    </label>
  );
}
function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-11 items-center gap-3 border border-zinc-300 p-3 text-sm"><input type="checkbox" checked={checked} onChange={(input) => onChange(input.target.checked)} className="h-4 w-4 accent-[#C0001E]" />{label}</label>; }
function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={`min-h-11 border px-4 py-3 text-xs font-bold uppercase ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-700'}`}>{label}</button>; }
function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={`min-h-11 border px-3 py-2 text-[11px] font-bold uppercase ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700'}`}>{label}</button>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="bg-white p-4"><p className="text-2xl font-black text-zinc-900">{value}</p><p className="mt-1 text-[11px] font-bold uppercase leading-tight text-zinc-500">{label}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <p><span className="font-bold uppercase text-zinc-400">{label}</span><br />{value}</p>; }
function paymentStatusLabel(value: EventRegistration['payment_status'], t: TFunction<'events'>) { return t(`events.engine.participantsPage.paymentStatus.${value}`); }
function PaymentStatusBadge({ value }: { value: EventRegistration['payment_status'] }) { const { t } = useTranslation('events'); const label = t(`events.engine.participantsPage.paymentBadge.${value}`); const colors = ['confirmed', 'waived'].includes(value) ? 'bg-emerald-50 text-emerald-800' : value === 'submitted' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'; return <span className={`px-2 py-1 text-[10px] font-bold uppercase ${colors}`}>{label}</span>; }
function ApprovalStatusBadge({ value }: { value: EventRegistration['approval_status'] }) { const { t } = useTranslation('events'); const label = t(`events.engine.participantsPage.approvalBadge.${value}`); const colors = value === 'accepted' ? 'bg-emerald-50 text-emerald-800' : value === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'; return <span className={`px-2 py-1 text-[10px] font-bold uppercase ${colors}`}>{label}</span>; }
function HistoryList({ items }: { items: EventParticipantHistoryItem[] }) { const { t } = useTranslation('events'); return <div className="mt-4 border-t border-zinc-200 pt-4"><h4 className="text-xs font-black uppercase tracking-widest">{t('events.engine.participantsPage.previousHistory')}</h4>{items.length === 0 ? <p className="mt-2 text-xs text-zinc-500">{t('events.engine.participantsPage.noPreviousBouts')}</p> : <div className="mt-2 space-y-2">{items.map((item) => <p key={item.bout_id} className="border-l-2 border-zinc-300 pl-3 text-xs text-zinc-600"><strong>{item.opponent_name}</strong> · {item.event_name} · {item.event_date ?? t('events.engine.participantsPage.datePending')} · {item.bout_status}{item.result ? ` · ${item.result}` : ''}</p>)}</div>}</div>; }
function Frame({ children }: { children: React.ReactNode }) { return <EventManageFrame>{children}</EventManageFrame>; }
