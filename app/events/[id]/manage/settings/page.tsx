'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventManageFrame } from '@/components/EventManageFrame';
import { authService } from '@/services/authService';
import {
  addEventStaffByEmail,
  canManageEventStaff,
  getEventStaff,
  removeEventStaff,
} from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import {
  DEFAULT_DIVISION_INPUT,
  DEFAULT_EVENT_SETTINGS,
  createEventDivision,
  deleteEventDivision,
  getEventDivisions,
  getEventMatchmakingSettings,
  saveEventMatchmakingSettings,
  updateEventDivision,
  type EventDivisionInput,
  type EventSettingsInput,
} from '@/services/eventSettingsService';
import type { Event, EventDivision, EventStaff, EventStaffRole, Profile } from '@/types';

type NullableNumberKey =
  | 'minimum_weight_kg'
  | 'maximum_weight_kg'
  | 'minimum_age'
  | 'maximum_age';

const REQUIRED_DIVISION_FIELDS: Array<keyof EventDivisionInput> = ['name', 'discipline', 'ruleset'];

export default function EventSettingsPage() {
  const { t } = useTranslation('events');
  const { id: eventId } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [settings, setSettings] = useState<EventSettingsInput>(DEFAULT_EVENT_SETTINGS);
  const [divisions, setDivisions] = useState<EventDivision[]>([]);
  const [staff, setStaff] = useState<EventStaff[]>([]);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<EventStaffRole>('manager');
  const [canManage, setCanManage] = useState(false);
  const [canEditStaff, setCanEditStaff] = useState(false);
  const [divisionForm, setDivisionForm] = useState<EventDivisionInput>(DEFAULT_DIVISION_INPUT);
  const [editingDivisionId, setEditingDivisionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [settingsResult, divisionsResult, staffResult] = await Promise.all([
      getEventMatchmakingSettings(eventId),
      getEventDivisions(eventId),
      getEventStaff(eventId),
    ]);
    if (settingsResult.error || divisionsResult.error || staffResult.error) {
      setError(translateError(settingsResult.error ?? divisionsResult.error ?? staffResult.error, t));
    }
    if (settingsResult.data) setSettings(toSettingsInput(settingsResult.data));
    setDivisions(divisionsResult.data ?? []);
    setStaff(staffResult.data ?? []);
  }, [eventId, t]);

  useEffect(() => {
    let active = true;
    Promise.all([authService.getSession(), eventService.getById(eventId)])
      .then(async ([sessionResult, eventResult]) => {
        if (!active) return;
        const nextProfile = sessionResult.data?.profile ?? null;
        const nextEvent = eventResult.data ?? null;
        setProfile(nextProfile);
        setEvent(nextEvent);
        const staffEditAllowed = await canManageEventStaff(eventId, nextProfile, nextEvent);
        setCanManage(staffEditAllowed);
        setCanEditStaff(staffEditAllowed);
        if (staffEditAllowed) {
          await reload();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [eventId, reload]);

  const saveSettings = async () => {
    setActing('settings');
    setError(null);
    setMessage(null);
    const result = await saveEventMatchmakingSettings(eventId, settings);
    if (result.error) setError(result.error);
    else setMessage(t('events.engine.settings.saved'));
    setActing(null);
  };

  const saveDivision = async () => {
    const missingField = REQUIRED_DIVISION_FIELDS.find((field) => !String(divisionForm[field] ?? '').trim());
    if (missingField) {
      setError(t('events.engine.settings.requiredDivisionFields'));
      return;
    }

    setActing('division');
    setError(null);
    setMessage(null);
    const payload = normalizeDivisionInput({
      ...divisionForm,
      sort_order: divisionForm.sort_order || divisions.length + 1,
    });
    const result = editingDivisionId
      ? await updateEventDivision(editingDivisionId, payload)
      : await createEventDivision(eventId, payload);

    if (result.error) setError(result.error);
    else {
      setMessage(editingDivisionId ? t('events.engine.settings.divisionUpdated') : t('events.engine.settings.divisionCreated'));
      setDivisionForm(DEFAULT_DIVISION_INPUT);
      setEditingDivisionId(null);
      await reload();
    }
    setActing(null);
  };

  const editDivision = (division: EventDivision) => {
    setEditingDivisionId(division.id);
    setDivisionForm(toDivisionInput(division));
    setMessage(null);
    setError(null);
  };

  const removeDivision = async (division: EventDivision) => {
    const confirmed = window.confirm(t('events.engine.settings.deleteDivisionConfirm', { name: division.name }));
    if (!confirmed) return;
    setActing(division.id);
    setError(null);
    setMessage(null);
    const result = await deleteEventDivision(division.id);
    if (result.error) setError(result.error);
    else {
      setMessage(t('events.engine.settings.divisionDeleted'));
      if (editingDivisionId === division.id) {
        setEditingDivisionId(null);
        setDivisionForm(DEFAULT_DIVISION_INPUT);
      }
      await reload();
    }
    setActing(null);
  };

  const addStaff = async () => {
    const email = staffEmail.trim();
    if (!email) return;
    setActing('staff');
    setError(null);
    setMessage(null);
    const result = await addEventStaffByEmail(eventId, email, staffRole);
    if (result.error) setError(translateError(result.error, t));
    else {
      setMessage(t('events.engine.settings.staffAdded'));
      setStaffEmail('');
      await reload();
    }
    setActing(null);
  };

  const deactivateStaff = async (staffMember: EventStaff) => {
    const label = staffMember.profiles?.email ?? staffMember.profiles?.full_name ?? t('events.engine.settings.fallbackStaffUser');
    const confirmed = window.confirm(t('events.engine.settings.removeStaffConfirm', { label }));
    if (!confirmed) return;
    setActing(staffMember.id);
    setError(null);
    setMessage(null);
    const result = await removeEventStaff(staffMember.id);
    if (result.error) setError(translateError(result.error, t));
    else {
      setMessage(t('events.engine.settings.staffRemoved'));
      await reload();
    }
    setActing(null);
  };

  if (loading || profile === undefined) {
    return <Frame><p className="text-sm text-zinc-500">{t('events.engine.loading.settings')}</p></Frame>;
  }

  if (!canManage) {
    return (
      <Frame>
        <h1 className="text-3xl font-black uppercase text-zinc-900">{t('events.engine.settings.title')}</h1>
        <p className="mt-3 text-sm text-zinc-600">{t('events.engine.permission.manageEvent')}</p>
        <Link href={`/events/${eventId}`} className="mt-6 inline-block min-h-11 border border-zinc-300 px-4 py-3 text-sm font-bold text-zinc-800">
          {t('events.engine.nav.backToEvent')}
        </Link>
      </Frame>
    );
  }

  return (
    <Frame>
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">{t('events.engine.brand')}</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-zinc-900 sm:text-5xl">{t('events.engine.settings.title')}</h1>
          <p className="mt-2 text-sm text-zinc-600">{event?.event_name}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
          <Link href={`/events/${eventId}/manage/matchmaking`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.matchmaking')}</Link>
          <Link href={`/events/${eventId}/manage/bouts`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.bouts')}</Link>
          <Link href={`/events/${eventId}/manage/print`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.print')}</Link>
          <Link href={`/events/${eventId}/manage/live`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.live')}</Link>
          <Link href={`/events/${eventId}/manage/streaming`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.streaming')}</Link>
          <Link href={`/events/${eventId}`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.event')}</Link>
        </div>
      </header>

      {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section className="border border-zinc-200 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-black uppercase text-zinc-900">{t('events.engine.settings.eventStaff')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('events.engine.settings.eventStaffHelp')}</p>
            <p className="mt-1 text-sm text-zinc-500">{t('events.engine.settings.eventStaffRolesHelp')}</p>
          </div>
          <span className="text-sm text-zinc-500">{t('events.engine.settings.assigned', { count: staff.length })}</span>
        </div>

        {canEditStaff && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px_auto]">
            <TextField label={t('events.engine.settings.staffEmail')} value={staffEmail} onChange={setStaffEmail} type="email" />
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.settings.staffRole')}</span>
              <select
                value={staffRole}
                onChange={(eventValue) => setStaffRole(eventValue.target.value as EventStaffRole)}
                className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
              >
                <option value="manager">{t('events.engine.settings.roleManager')}</option>
                <option value="operator">{t('events.engine.settings.roleOperator')}</option>
                <option value="producer">{t('events.engine.settings.roleProducer')}</option>
              </select>
            </label>
            <button
              type="button"
              onClick={addStaff}
              disabled={!staffEmail.trim() || acting === 'staff'}
              className="min-h-11 self-end bg-zinc-900 px-4 py-3 text-xs font-bold uppercase text-white disabled:bg-zinc-300"
            >
              {acting === 'staff' ? t('events.engine.settings.adding') : t('events.engine.settings.add')}
            </button>
            <p className="text-xs text-zinc-500 sm:col-span-3">
              {t('events.engine.settings.eventStaffAccountHelp')}
            </p>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {staff.length === 0 ? (
            <p className="border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">{t('events.engine.settings.noStaff')}</p>
          ) : staff.map((staffMember) => (
            <article key={staffMember.id} className="flex flex-col gap-3 border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-zinc-900">{staffMember.profiles?.full_name ?? staffMember.profiles?.email ?? t('events.engine.settings.user')}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {staffMember.profiles?.email ?? t('events.engine.settings.noEmail')} · {staffMember.profiles?.role ?? t('events.engine.settings.fallbackProfileRole')} · {staffRoleLabel(staffMember.staff_role, t)}
                </p>
              </div>
              {canEditStaff && (
                <button
                  type="button"
                  onClick={() => deactivateStaff(staffMember)}
                  disabled={acting === staffMember.id}
                  className="min-h-11 border border-red-200 px-4 py-3 text-xs font-bold uppercase text-red-700 disabled:text-zinc-400"
                >
                  {acting === staffMember.id ? t('events.engine.settings.removing') : t('events.engine.settings.remove')}
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="border border-zinc-200 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black uppercase text-zinc-900">{t('events.engine.settings.compatibilityRules')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('events.engine.settings.compatibilityRulesHelp')}</p>
          </div>
          <button type="button" onClick={saveSettings} disabled={acting === 'settings'}
            className="min-h-11 bg-zinc-900 px-4 py-3 text-xs font-bold uppercase text-white disabled:bg-zinc-300">
            {acting === 'settings' ? t('events.engine.settings.saving') : t('events.engine.settings.saveRules')}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label={t('events.engine.settings.weightTolerance')} value={settings.weight_tolerance_kg} min={0}
            onChange={(value) => setSettings({ ...settings, weight_tolerance_kg: value })} />
          <NumberField label={t('events.engine.settings.ageTolerance')} value={settings.age_tolerance_years} min={0}
            onChange={(value) => setSettings({ ...settings, age_tolerance_years: value })} />
          <NumberField label={t('events.engine.settings.experienceTolerance')} value={settings.experience_tolerance_fights} min={0}
            onChange={(value) => setSettings({ ...settings, experience_tolerance_fights: value })} />
          <NumberField label={t('events.engine.settings.recentOpponentDays')} value={settings.recent_opponent_lookback_days} min={0}
            onChange={(value) => setSettings({ ...settings, recent_opponent_lookback_days: value })} />
          <NumberField label={t('events.engine.settings.maxBoutsPerFighter')} value={settings.max_bouts_per_fighter} min={1}
            onChange={(value) => setSettings({ ...settings, max_bouts_per_fighter: Math.max(1, value) })} />
          <NumberField label={t('events.engine.settings.minimumRestMinutes')} value={settings.minimum_rest_minutes} min={0}
            onChange={(value) => setSettings({ ...settings, minimum_rest_minutes: value })} />
          <NumberField label={t('events.engine.settings.rulesVersion')} value={settings.rules_version} min={1}
            onChange={(value) => setSettings({ ...settings, rules_version: Math.max(1, value) })} />
          <TextField label={t('events.engine.settings.registrationCloses')} type="datetime-local" value={toDateTimeLocal(settings.registration_closes_at)}
            onChange={(value) => setSettings({ ...settings, registration_closes_at: value ? new Date(value).toISOString() : null })} />
          <label className="flex min-h-11 items-center gap-3 border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800">
            <input type="checkbox" checked={settings.allow_same_team}
              onChange={(eventValue) => setSettings({ ...settings, allow_same_team: eventValue.target.checked })}
              className="h-4 w-4 accent-[#C0001E]" />
            {t('events.engine.settings.allowSameTeam')}
          </label>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="border border-zinc-200 p-4 sm:p-5">
          <h2 className="text-xl font-black uppercase text-zinc-900">{editingDivisionId ? t('events.engine.settings.editDivision') : t('events.engine.settings.newDivision')}</h2>
          <div className="mt-5 grid grid-cols-1 gap-3">
            <TextField label={t('events.engine.settings.name')} value={divisionForm.name} onChange={(value) => setDivisionForm({ ...divisionForm, name: value })} />
            <TextField label={t('events.engine.settings.discipline')} value={divisionForm.discipline} onChange={(value) => setDivisionForm({ ...divisionForm, discipline: value })} />
            <TextField label={t('events.engine.settings.ruleset')} value={divisionForm.ruleset} onChange={(value) => setDivisionForm({ ...divisionForm, ruleset: value })} />
            <TextField label={t('events.engine.settings.format')} value={divisionForm.bout_format ?? ''} onChange={(value) => setDivisionForm({ ...divisionForm, bout_format: value })} />
            <TextField label={t('events.engine.settings.weightClass')} value={divisionForm.weight_class ?? ''} onChange={(value) => setDivisionForm({ ...divisionForm, weight_class: value })} />
            <div className="grid grid-cols-2 gap-3">
              <NullableNumberField label={t('events.engine.settings.minimumWeight')} value={divisionForm.minimum_weight_kg} onChange={(value) => setNullableNumber('minimum_weight_kg', value, setDivisionForm)} />
              <NullableNumberField label={t('events.engine.settings.maximumWeight')} value={divisionForm.maximum_weight_kg} onChange={(value) => setNullableNumber('maximum_weight_kg', value, setDivisionForm)} />
            </div>
            <TextField label={t('events.engine.settings.ageClass')} value={divisionForm.age_class ?? ''} onChange={(value) => setDivisionForm({ ...divisionForm, age_class: value })} />
            <div className="grid grid-cols-2 gap-3">
              <NullableNumberField label={t('events.engine.settings.minimumAge')} value={divisionForm.minimum_age} onChange={(value) => setNullableNumber('minimum_age', value, setDivisionForm)} />
              <NullableNumberField label={t('events.engine.settings.maximumAge')} value={divisionForm.maximum_age} onChange={(value) => setNullableNumber('maximum_age', value, setDivisionForm)} />
            </div>
            <TextField label={t('events.engine.settings.genderDivision')} value={divisionForm.gender_division ?? ''} onChange={(value) => setDivisionForm({ ...divisionForm, gender_division: value })} />
            <TextField label={t('events.engine.settings.beltRank')} value={divisionForm.belt_level ?? ''} onChange={(value) => setDivisionForm({ ...divisionForm, belt_level: value })} />
            <TextField label={t('events.engine.settings.experience')} value={divisionForm.experience_level ?? ''} onChange={(value) => setDivisionForm({ ...divisionForm, experience_level: value })} />
            <NumberField label={t('events.engine.settings.order')} value={divisionForm.sort_order} min={0} onChange={(value) => setDivisionForm({ ...divisionForm, sort_order: value })} />
            <label className="flex min-h-11 items-center gap-3 border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800">
              <input type="checkbox" checked={divisionForm.is_active}
                onChange={(eventValue) => setDivisionForm({ ...divisionForm, is_active: eventValue.target.checked })}
                className="h-4 w-4 accent-[#C0001E]" />
              {t('events.engine.settings.activeDivision')}
            </label>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={saveDivision} disabled={acting === 'division'}
              className="min-h-11 bg-[#C0001E] px-4 py-3 text-xs font-bold uppercase text-white disabled:bg-zinc-300">
              {acting === 'division' ? t('events.engine.settings.saving') : editingDivisionId ? t('events.engine.settings.saveDivision') : t('events.engine.settings.createDivision')}
            </button>
            <button type="button" onClick={() => { setEditingDivisionId(null); setDivisionForm(DEFAULT_DIVISION_INPUT); }}
              className="min-h-11 border border-zinc-300 px-4 py-3 text-xs font-bold uppercase text-zinc-800">
              {t('events.engine.settings.clear')}
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-black uppercase text-zinc-900">{t('events.engine.settings.divisions')}</h2>
            <span className="text-sm text-zinc-500">{t('events.engine.settings.divisionsCount', { count: divisions.length })}</span>
          </div>
          <div className="mt-4 space-y-3">
            {divisions.length === 0 ? (
              <p className="border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">{t('events.engine.settings.noDivisions')}</p>
            ) : divisions.map((division) => (
              <article key={division.id} className="border border-zinc-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#C0001E]">{t('events.engine.settings.orderLabel', { order: division.sort_order })}</p>
                    <h3 className="mt-1 text-lg font-black text-zinc-900">{division.name}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{division.discipline} · {division.ruleset} · {division.weight_class ?? t('events.engine.settings.openWeight')}</p>
                    <p className="mt-1 text-xs text-zinc-500">{division.age_class ?? t('events.engine.settings.openAge')} · {division.belt_level ?? t('events.engine.settings.openRank')} · {division.is_active ? t('events.engine.settings.active') : t('events.engine.settings.inactive')}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button type="button" onClick={() => editDivision(division)}
                      className="min-h-11 border border-zinc-300 px-4 py-3 text-xs font-bold uppercase text-zinc-800">{t('events.engine.settings.edit')}</button>
                    <button type="button" onClick={() => removeDivision(division)} disabled={acting === division.id}
                      className="min-h-11 border border-red-200 px-4 py-3 text-xs font-bold uppercase text-red-700 disabled:text-zinc-400">{t('events.engine.settings.delete')}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Frame>
  );
}

function toSettingsInput(settings: EventSettingsInput): EventSettingsInput {
  return {
    weight_tolerance_kg: settings.weight_tolerance_kg,
    age_tolerance_years: settings.age_tolerance_years,
    experience_tolerance_fights: settings.experience_tolerance_fights,
    allow_same_team: settings.allow_same_team,
    recent_opponent_lookback_days: settings.recent_opponent_lookback_days,
    max_bouts_per_fighter: settings.max_bouts_per_fighter,
    minimum_rest_minutes: settings.minimum_rest_minutes,
    rules_version: settings.rules_version,
    registration_closes_at: settings.registration_closes_at,
  };
}

function staffRoleLabel(role: EventStaffRole, t: ReturnType<typeof useTranslation<'events'>>['t']) {
  if (role === 'manager') return t('events.engine.settings.roleManager');
  if (role === 'operator') return t('events.engine.settings.roleOperator');
  return t('events.engine.settings.roleProducer');
}

function translateError(error: string | null | undefined, t: ReturnType<typeof useTranslation<'events'>>['t']) {
  if (!error) return null;
  return error.startsWith('events.') ? t(error) : error;
}

function toDivisionInput(division: EventDivision): EventDivisionInput {
  return {
    name: division.name,
    discipline: division.discipline,
    ruleset: division.ruleset,
    bout_format: division.bout_format ?? '',
    weight_class: division.weight_class ?? '',
    minimum_weight_kg: division.minimum_weight_kg,
    maximum_weight_kg: division.maximum_weight_kg,
    age_class: division.age_class ?? '',
    minimum_age: division.minimum_age,
    maximum_age: division.maximum_age,
    gender_division: division.gender_division ?? '',
    belt_level: division.belt_level ?? '',
    experience_level: division.experience_level ?? '',
    is_active: division.is_active,
    sort_order: division.sort_order,
  };
}

function normalizeDivisionInput(division: EventDivisionInput): EventDivisionInput {
  return {
    ...division,
    bout_format: division.bout_format || null,
    weight_class: division.weight_class || null,
    age_class: division.age_class || null,
    gender_division: division.gender_division || null,
    belt_level: division.belt_level || null,
    experience_level: division.experience_level || null,
  };
}

function setNullableNumber(
  key: NullableNumberKey,
  value: number | null,
  setDivisionForm: React.Dispatch<React.SetStateAction<EventDivisionInput>>
) {
  setDivisionForm((current) => ({ ...current, [key]: value }));
}

function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function NumberField({ label, value, min, onChange }: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{label}</span>
      <input type="number" min={min} value={value}
        onChange={(eventValue) => onChange(Number(eventValue.target.value || min))}
        className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900" />
    </label>
  );
}

function NullableNumberField({ label, value, onChange }: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{label}</span>
      <input type="number" value={value ?? ''}
        onChange={(eventValue) => onChange(eventValue.target.value === '' ? null : Number(eventValue.target.value))}
        className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900" />
    </label>
  );
}

function TextField({ label, value, onChange, type = 'text' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{label}</span>
      <input type={type} value={value} onChange={(eventValue) => onChange(eventValue.target.value)}
        className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900" />
    </label>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <EventManageFrame>{children}</EventManageFrame>;
}
