'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoutMethodText, InlineCombatRecord } from '@/components/CombatRecord';
import { EventManageFrame } from '@/components/EventManageFrame';
import { authService } from '@/services/authService';
import {
  createEventMat,
  generateBoutOrder,
  getBoutsForEvent,
  getMatsForEvent,
  replaceBoutFighter,
  updateBoutOperation,
} from '@/services/boutService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import { getEventRegistrations } from '@/services/registrationService';
import type { Bout, Event, EventMat, Profile, RegistrationWithFighter } from '@/types';

export default function BoutManagementPage() {
  const { t } = useTranslation('events');
  const { id: eventId } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [bouts, setBouts] = useState<Bout[]>([]);
  const [mats, setMats] = useState<EventMat[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationWithFighter[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matName, setMatName] = useState('');
  const [showStatusHelp, setShowStatusHelp] = useState(false);

  const reload = useCallback(async () => {
    const [boutResult, matResult, registrationResult] = await Promise.all([
      getBoutsForEvent(eventId),
      getMatsForEvent(eventId),
      getEventRegistrations(eventId),
    ]);
    if (boutResult.error || matResult.error || registrationResult.error) setError(boutResult.error ?? matResult.error ?? registrationResult.error);
    setBouts(boutResult.data ?? []);
    setMats(matResult.data ?? []);
    setRegistrations(registrationResult.data ?? []);
  }, [eventId]);

  useEffect(() => {
    Promise.all([authService.getSession(), eventService.getById(eventId)]).then(async ([session, eventResult]) => {
      const nextProfile = session.data?.profile ?? null;
      const nextEvent = eventResult.data ?? null;
      setProfile(nextProfile);
      setEvent(nextEvent);
      const operatorAllowed = await canUseEventFeature(eventId, 'bouts', nextProfile, nextEvent);
      setCanManage(operatorAllowed);
      if (operatorAllowed) {
        await reload();
      }
      setLoading(false);
    });
  }, [eventId, reload]);

  const conflictMap = useMemo(() => buildBoutConflictMap(bouts), [bouts]);

  const addMat = async () => {
    const name = matName.trim();
    if (!name) return;
    setActing('mat');
    setError(null);
    const result = await createEventMat(eventId, name, mats.length + 1);
    if (result.error) setError(result.error);
    else if (result.data) {
      setMats((current) => [...current, result.data as EventMat].sort((a, b) => a.mat_number - b.mat_number));
      setMatName('');
    }
    setActing(null);
  };

  const orderBouts = async () => {
    setActing('order');
    setError(null);
    const result = await generateBoutOrder(eventId);
    if (result.error) setError(result.error);
    else setBouts(result.data ?? []);
    setActing(null);
  };

  const updateBout = async (boutId: string, operation: Parameters<typeof updateBoutOperation>[1]) => {
    setActing(boutId);
    setError(null);
    const result = await updateBoutOperation(boutId, operation);
    if (result.error) setError(result.error);
    else if (result.data) setBouts((current) => current.map((bout) => bout.id === boutId ? result.data as Bout : bout));
    setActing(null);
  };

  const replaceFighter = async (boutId: string, side: 'a' | 'b', registrationId: string, reason: string) => {
    setActing(boutId);
    setError(null);
    const result = await replaceBoutFighter(boutId, side, registrationId, reason);
    if (result.error) setError(result.error);
    else if (result.data) setBouts((current) => current.map((bout) => bout.id === boutId ? result.data as Bout : bout));
    setActing(null);
  };

  if (loading || profile === undefined) return <Frame><p className="text-sm text-zinc-500">{t('events.engine.loading.bouts')}</p></Frame>;
  if (!canManage) return <Frame><p className="text-sm text-zinc-700">{t('events.engine.permission.manageBouts')}</p></Frame>;

  return (
    <Frame>
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">{t('events.engine.brand')}</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-zinc-900 sm:text-5xl">{t('events.engine.bouts.title')}</h1>
          <p className="mt-2 text-sm text-zinc-600">{event?.event_name}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
          <Link href={`/events/${eventId}/manage/settings`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.settings')}</Link>
          <Link href={`/events/${eventId}/manage/matchmaking`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.matchmaking')}</Link>
          <Link href={`/events/${eventId}/manage/print`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.print')}</Link>
          <Link href={`/events/${eventId}/manage/live`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.live')}</Link>
          <Link href={`/events/${eventId}/manage/streaming`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.streaming')}</Link>
          <Link href={`/events/${eventId}`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.event')}</Link>
          <button type="button" onClick={orderBouts} disabled={acting === 'order' || bouts.length === 0}
            className="min-h-11 bg-zinc-900 px-4 py-3 text-xs font-bold uppercase text-white disabled:bg-zinc-300">
            {acting === 'order' ? t('events.engine.bouts.ordering') : t('events.engine.bouts.generateOrder')}
          </button>
        </div>
      </header>

      {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <section className="border border-zinc-200 p-4 sm:p-5">
        <h2 className="text-xl font-black uppercase text-zinc-900">{t('events.engine.bouts.areas')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {mats.map((mat) => <span key={mat.id} className="border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-bold">{mat.mat_number}. {mat.name}</span>)}
          {mats.length === 0 && <span className="text-sm text-zinc-500">{t('events.engine.bouts.noAreas')}</span>}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="mat-name">{t('events.engine.bouts.areaName')}</label>
          <input id="mat-name" value={matName} onChange={(eventValue) => setMatName(eventValue.target.value)} placeholder={t('events.engine.bouts.areaPlaceholder')}
            className="min-h-11 flex-1 border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
          <button type="button" onClick={addMat} disabled={!matName.trim() || acting === 'mat'}
            className="min-h-11 bg-[#C0001E] px-4 py-3 text-xs font-bold uppercase text-white disabled:bg-zinc-300">{t('events.engine.bouts.add')}</button>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase text-zinc-900">{t('events.engine.bouts.eventOrder')}</h2>
            <button
              type="button"
              onClick={() => setShowStatusHelp(true)}
              className="mt-2 min-h-11 border border-zinc-300 bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-zinc-800"
            >
              {t('events.engine.bouts.statusDefinitionsButton')}
            </button>
          </div>
          <span className="text-sm text-zinc-500">{t('events.engine.bouts.count', { count: bouts.length })}</span>
        </div>
        <div className="mt-4 space-y-3">
          {bouts.length === 0 ? (
            <p className="border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">{t('events.engine.bouts.empty')}</p>
          ) : bouts.map((bout) => (
            <BoutCard
              key={`${bout.id}:${bout.mat_order ?? ''}:${bout.scheduled_time ?? ''}`}
              bout={bout}
              mats={mats}
              registrations={registrations}
              warnings={conflictMap.get(bout.id) ?? []}
              busy={acting === bout.id}
              update={updateBout}
              replaceFighter={replaceFighter}
            />
          ))}
        </div>
      </section>
      {showStatusHelp && <StatusDefinitionsModal close={() => setShowStatusHelp(false)} />}
    </Frame>
  );
}

function BoutCard({ bout, mats, registrations, warnings, busy, update, replaceFighter }: {
  bout: Bout;
  mats: EventMat[];
  registrations: RegistrationWithFighter[];
  warnings: string[];
  busy: boolean;
  update: (id: string, operation: Parameters<typeof updateBoutOperation>[1]) => Promise<void>;
  replaceFighter: (id: string, side: 'a' | 'b', registrationId: string, reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('events');
  const [winner, setWinner] = useState('');
  const [method, setMethod] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState('');
  const [matOrder, setMatOrder] = useState(bout.mat_order?.toString() ?? '');
  const [scheduledTime, setScheduledTime] = useState(toDateTimeLocal(bout.scheduled_time));
  const [showResult, setShowResult] = useState(false);
  const [replacementSide, setReplacementSide] = useState<'a' | 'b'>('a');
  const [replacementRegistrationId, setReplacementRegistrationId] = useState('');
  const [replacementReason, setReplacementReason] = useState('');

  const savePlacement = () => {
    update(bout.id, {
      matOrder: matOrder ? Number(matOrder) : undefined,
      scheduledTime: scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
    });
  };

  return (
    <article className="border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-[#C0001E]">{t('events.engine.bouts.combatNumber', { number: bout.bout_number ?? t('events.engine.bouts.unassignedNumber') })}</p>
          <h3 className="mt-1 text-lg font-black text-zinc-900">{bout.fighter_a_snapshot.name} vs {bout.fighter_b_snapshot.name}</h3>
          <p className="mt-1 text-xs text-zinc-500">{bout.discipline ?? t('events.engine.bouts.pendingDiscipline')} · {bout.weight_class ?? t('events.engine.bouts.pendingWeight')} · {formatStatus(bout.status, t)}</p>
          {bout.method && (
            <p className="mt-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
              {t('events.engine.bouts.method')}: <BoutMethodText value={bout.method} />
            </p>
          )}
        </div>
        <select aria-label={t('events.engine.bouts.assignArea')} value={bout.mat_id ?? ''} disabled={busy}
          onChange={(eventValue) => update(bout.id, { matId: eventValue.target.value })}
          className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm sm:w-auto">
          <option value="">{t('events.engine.bouts.noArea')}</option>
          {mats.map((mat) => <option key={mat.id} value={mat.id}>{mat.mat_number}. {mat.name}</option>)}
        </select>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        <FighterInfoCard
          name={bout.fighter_a_snapshot.name}
          team={bout.fighter_a_snapshot.team ?? bout.fighter_a?.gym_name ?? null}
          fighter={bout.fighter_a}
          weightClass={bout.weight_class}
        />
        <div className="flex items-center justify-center border-y border-zinc-200 py-2 text-xs font-black uppercase tracking-widest text-zinc-700 sm:border-x sm:border-y-0 sm:px-4 sm:py-0">
          VS
        </div>
        <FighterInfoCard
          name={bout.fighter_b_snapshot.name}
          team={bout.fighter_b_snapshot.team ?? bout.fighter_b?.gym_name ?? null}
          fighter={bout.fighter_b}
          weightClass={bout.weight_class}
        />
      </div>
      {warnings.length > 0 && (
        <div className="mt-4 border border-amber-200 bg-amber-50 p-3">
          {warnings.map((warning) => <p key={warning} className="text-xs font-medium text-amber-900">{t(`events.engine.bouts.${warning}`)}</p>)}
        </div>
      )}
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-[120px_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.bouts.areaOrder')}</span>
          <input type="number" min={1} value={matOrder} onChange={(eventValue) => setMatOrder(eventValue.target.value)}
            className="min-h-11 w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{t('events.engine.bouts.scheduledTime')}</span>
          <input type="datetime-local" value={scheduledTime} onChange={(eventValue) => setScheduledTime(eventValue.target.value)}
            className="min-h-11 w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </label>
        <button type="button" disabled={busy} onClick={savePlacement}
          className="min-h-11 self-end border border-zinc-300 px-4 py-3 text-xs font-bold uppercase text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400">
          {t('events.engine.bouts.saveOrder')}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-200 pt-4 sm:flex sm:flex-wrap">
        {bout.status === 'approved' && <Action label={t('events.engine.bouts.confirm')} disabled={busy} onClick={() => update(bout.id, { status: 'confirmed' })} />}
        {['approved','confirmed'].includes(bout.status) && <Action label={t('events.engine.bouts.ready')} disabled={busy} onClick={() => update(bout.id, { status: 'ready' })} />}
        {bout.status === 'ready' && <Action label={t('events.engine.bouts.start')} disabled={busy} onClick={() => update(bout.id, { status: 'in_progress' })} primary />}
        {bout.status === 'in_progress' && <Action label={t('events.engine.bouts.complete')} disabled={busy} onClick={() => setShowResult(true)} primary />}
        {!['completed','cancelled','no_show'].includes(bout.status) && <Action label={t('events.engine.bouts.absent')} disabled={busy} onClick={() => update(bout.id, { status: 'no_show', reason: t('events.engine.bouts.absent') })} />}
        {!['completed','cancelled','no_show'].includes(bout.status) && <Action label={t('events.engine.bouts.cancel')} disabled={busy} onClick={() => update(bout.id, { status: 'cancelled', reason: t('events.engine.bouts.cancel') })} />}
      </div>
      {showResult && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-4">
          <select value={winner} onChange={(eventValue) => setWinner(eventValue.target.value)} className="min-h-11 border border-zinc-300 bg-white px-3 py-2 text-sm">
            <option value="">{t('events.engine.bouts.winner')}</option>
            <option value={bout.fighter_a_id}>{bout.fighter_a_snapshot.name}</option>
            <option value={bout.fighter_b_id}>{bout.fighter_b_snapshot.name}</option>
          </select>
          <input value={method} onChange={(eventValue) => setMethod(eventValue.target.value)} placeholder={t('events.engine.bouts.method')} className="min-h-11 border border-zinc-300 px-3 py-2 text-sm" />
          <input type="number" min={0} value={elapsedSeconds} onChange={(eventValue) => setElapsedSeconds(eventValue.target.value)} placeholder={t('events.engine.bouts.seconds')} className="min-h-11 border border-zinc-300 px-3 py-2 text-sm" />
          <button type="button" disabled={!winner || busy} onClick={() => update(bout.id, { status: 'completed', winnerId: winner, method, elapsedSeconds: elapsedSeconds ? Number(elapsedSeconds) : undefined })}
            className="min-h-11 bg-[#C0001E] px-4 py-3 text-xs font-bold uppercase text-white disabled:bg-zinc-300">{t('events.engine.bouts.saveResult')}</button>
        </div>
      )}
      {!['completed','cancelled','no_show'].includes(bout.status) && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-[120px_1fr_1fr_auto]">
          <select value={replacementSide} onChange={(eventValue) => setReplacementSide(eventValue.target.value as 'a' | 'b')}
            className="min-h-11 border border-zinc-300 bg-white px-3 py-2 text-sm">
            <option value="a">{t('events.engine.bouts.fighterA')}</option>
            <option value="b">{t('events.engine.bouts.fighterB')}</option>
          </select>
          <select value={replacementRegistrationId} onChange={(eventValue) => setReplacementRegistrationId(eventValue.target.value)}
            className="min-h-11 border border-zinc-300 bg-white px-3 py-2 text-sm">
            <option value="">{t('events.engine.bouts.replacement')}</option>
            {registrations
              .filter((registration) =>
                registration.payment_status === 'confirmed'
                && registration.eligibility_status === 'eligible'
                && registration.fighter_id !== bout.fighter_a_id
                && registration.fighter_id !== bout.fighter_b_id
              )
              .map((registration) => (
                <option key={registration.id} value={registration.id}>
                  {registration.fighters?.profiles?.full_name ?? t('events.engine.bouts.fighter')} · {registration.registered_weight_class ?? registration.fighters?.weight_class ?? t('events.engine.bouts.pendingWeight')}
                </option>
              ))}
          </select>
          <input value={replacementReason} onChange={(eventValue) => setReplacementReason(eventValue.target.value)} placeholder={t('events.engine.bouts.reason')}
            className="min-h-11 border border-zinc-300 px-3 py-2 text-sm" />
          <button type="button" disabled={!replacementRegistrationId || busy}
            onClick={() => replaceFighter(bout.id, replacementSide, replacementRegistrationId, replacementReason)}
            className="min-h-11 border border-zinc-300 px-4 py-3 text-xs font-bold uppercase text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400">
            {t('events.engine.bouts.replace')}
          </button>
        </div>
      )}
    </article>
  );
}

function FighterInfoCard({
  name,
  team,
  fighter,
  weightClass,
}: {
  name: string;
  team: string | null;
  fighter: Bout['fighter_a'];
  weightClass: string | null;
}) {
  const { t, i18n } = useTranslation('events');
  const displayName = fighter?.profiles?.full_name ?? name;
  const initials = getInitials(displayName);
  const wins = fighter?.record_wins ?? 0;
  const losses = fighter?.record_losses ?? 0;
  const draws = fighter?.record_draws ?? 0;
  const labels = i18n.language?.startsWith('es')
    ? { record: 'Récord', weight: 'Peso', team: 'Gimnasio' }
    : { record: 'Record', weight: 'Weight', team: 'Gym' };
  const recordLabel = safeTranslation(t, 'events.engine.bouts.record', labels.record);
  const weightLabel = safeTranslation(t, 'events.engine.bouts.weight', labels.weight);
  const teamLabel = safeTranslation(t, 'events.engine.bouts.team', labels.team);

  return (
    <div className="flex gap-3 bg-zinc-50 p-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden border border-zinc-300 bg-white">
        {fighter?.photo_url ? (
          <Image src={fighter.photo_url} alt={displayName} width={80} height={80} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-black text-zinc-700">{initials}</div>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-black uppercase leading-tight text-zinc-900">{displayName}</p>
        <p className="mt-1 text-xs text-zinc-600">
          {recordLabel}: <InlineCombatRecord wins={wins} losses={losses} draws={draws} winLabel="G" lossLabel="P" drawLabel="E" />
        </p>
        <p className="mt-1 text-xs text-zinc-600">{weightLabel}: {fighter?.exact_weight ?? weightClass ?? '—'}</p>
        <p className="mt-1 text-xs text-zinc-500">{teamLabel}: {team ?? '—'}</p>
      </div>
    </div>
  );
}

function Action({ label, onClick, disabled, primary = false }: { label: string; onClick: () => void; disabled: boolean; primary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`min-h-11 px-4 py-3 text-xs font-bold uppercase disabled:bg-zinc-300 disabled:text-white ${primary ? 'bg-zinc-900 text-white' : 'border border-zinc-300 bg-white text-zinc-800'}`}>{label}</button>;
}

function StatusDefinitionsModal({ close }: { close: () => void }) {
  const { t } = useTranslation('events');
  const statuses: Bout['status'][] = ['approved', 'confirmed', 'ready', 'in_progress', 'completed', 'cancelled', 'no_show'];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 px-4 py-4 sm:items-center sm:justify-center">
      <div role="dialog" aria-modal="true" aria-labelledby="bout-status-definitions-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <h2 id="bout-status-definitions-title" className="text-2xl font-black uppercase text-zinc-900">{t('events.engine.bouts.statusDefinitionsTitle')}</h2>
            <p className="mt-1 text-sm text-zinc-600">{t('events.engine.bouts.statusDefinitionsIntro')}</p>
          </div>
          <button type="button" onClick={close} className="min-h-11 border border-zinc-300 px-4 py-3 text-xs font-bold uppercase text-zinc-800">
            {t('events.engine.bouts.closeDefinitions')}
          </button>
        </div>
        <div className="mt-5 space-y-4">
          {statuses.map((status) => (
            <div key={status} className="border border-zinc-200 p-4">
              <p className="text-sm font-black uppercase text-zinc-900">{formatStatus(status, t)}</p>
              <p className="mt-1 text-sm text-zinc-600">{t(`events.engine.statusDefinitions.${status}`)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatStatus(value: string, t: (key: string) => string) {
  return t(`events.engine.status.${value}`) || value.replaceAll('_', ' ');
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'SM';
}

function safeTranslation(t: (key: string) => string, key: string, fallback: string) {
  const value = t(key);
  return value === key ? fallback : value;
}

function Frame({ children }: { children: React.ReactNode }) {
  return <EventManageFrame>{children}</EventManageFrame>;
}

function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function buildBoutConflictMap(bouts: Bout[]) {
  const conflictMap = new Map<string, string[]>();
  const activeBouts = bouts.filter((bout) => !['cancelled', 'no_show', 'completed'].includes(bout.status));
  const matOrders = new Map<string, string[]>();
  const fighterAssignments = new Map<string, string[]>();

  const addWarning = (boutId: string, warning: string) => {
    const warnings = conflictMap.get(boutId) ?? [];
    warnings.push(warning);
    conflictMap.set(boutId, warnings);
  };

  for (const bout of activeBouts) {
    if (bout.mat_id && bout.mat_order !== null) {
      const key = `${bout.mat_id}:${bout.mat_order}`;
      matOrders.set(key, [...(matOrders.get(key) ?? []), bout.id]);
    }
    fighterAssignments.set(bout.fighter_a_id, [...(fighterAssignments.get(bout.fighter_a_id) ?? []), bout.id]);
    fighterAssignments.set(bout.fighter_b_id, [...(fighterAssignments.get(bout.fighter_b_id) ?? []), bout.id]);
  }

  for (const boutIds of matOrders.values()) {
    if (boutIds.length > 1) {
      for (const boutId of boutIds) addWarning(boutId, 'sameAreaConflict');
    }
  }

  for (const boutIds of fighterAssignments.values()) {
    if (boutIds.length > 1) {
      for (const boutId of boutIds) addWarning(boutId, 'fighterConflict');
    }
  }

  return conflictMap;
}
