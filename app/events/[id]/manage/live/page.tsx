'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventManageFrame } from '@/components/EventManageFrame';
import { authService } from '@/services/authService';
import { getBoutsForEvent, getMatsForEvent, updateBoutOperation } from '@/services/boutService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import type { Bout, Event, EventMat, Profile } from '@/types';

const ACTIVE_STATUSES: Bout['status'][] = ['confirmed', 'ready', 'in_progress'];

export default function LiveEventPage() {
  const { t } = useTranslation('events');
  const { id: eventId } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [bouts, setBouts] = useState<Bout[]>([]);
  const [mats, setMats] = useState<EventMat[]>([]);
  const [selectedMatId, setSelectedMatId] = useState<string>('all');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [boutResult, matResult] = await Promise.all([
      getBoutsForEvent(eventId),
      getMatsForEvent(eventId),
    ]);
    if (boutResult.error || matResult.error) setError(boutResult.error ?? matResult.error);
    setBouts(boutResult.data ?? []);
    setMats(matResult.data ?? []);
  }, [eventId]);

  useEffect(() => {
    let active = true;
    Promise.all([authService.getSession(), eventService.getById(eventId)])
      .then(async ([sessionResult, eventResult]) => {
        if (!active) return;
        const nextProfile = sessionResult.data?.profile ?? null;
        const nextEvent = eventResult.data ?? null;
        setProfile(nextProfile);
        setEvent(nextEvent);
        const operatorAllowed = await canUseEventFeature(eventId, 'operation', nextProfile, nextEvent);
        setCanManage(operatorAllowed);
        if (operatorAllowed) {
          await reload();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [eventId, reload]);

  const visibleMats = useMemo(() => {
    const configured = mats.filter((mat) => mat.is_active);
    if (configured.length > 0) return configured;
    return [{ id: 'unassigned', event_id: eventId, name: t('events.engine.bouts.noArea'), mat_number: 0, is_active: true, created_at: '', updated_at: '' }];
  }, [eventId, mats, t]);

  const activeBouts = useMemo(() => bouts
    .filter((bout) => ACTIVE_STATUSES.includes(bout.status))
    .sort(compareLiveBouts), [bouts]);

  const updateBout = async (boutId: string, operation: Parameters<typeof updateBoutOperation>[1]) => {
    setActing(boutId);
    setError(null);
    const result = await updateBoutOperation(boutId, operation);
    if (result.error) setError(result.error);
    else if (result.data) setBouts((current) => current.map((bout) => bout.id === boutId ? result.data as Bout : bout));
    setActing(null);
  };

  if (loading || profile === undefined) {
    return <Frame><p className="text-sm text-zinc-500">{t('events.engine.loading.live')}</p></Frame>;
  }

  if (!canManage) {
    return (
      <Frame>
        <h1 className="text-3xl font-black uppercase text-zinc-900">{t('events.engine.live.title')}</h1>
        <p className="mt-3 text-sm text-zinc-600">{t('events.engine.permission.operate')}</p>
        <Link href={`/events/${eventId}`} className="mt-6 inline-block min-h-11 border border-zinc-300 px-4 py-3 text-sm font-bold text-zinc-800">
          {t('events.engine.nav.backToEvent')}
        </Link>
      </Frame>
    );
  }

  const selectedMats = selectedMatId === 'all'
    ? visibleMats
    : visibleMats.filter((mat) => mat.id === selectedMatId);

  return (
    <Frame>
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">{t('events.engine.brand')}</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-zinc-900 sm:text-5xl">{t('events.engine.live.title')}</h1>
          <p className="mt-2 text-sm text-zinc-600">{event?.event_name}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
          <Link href={`/events/${eventId}/manage/settings`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.settings')}</Link>
          <Link href={`/events/${eventId}/manage/matchmaking`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.matchmaking')}</Link>
          <Link href={`/events/${eventId}/manage/bouts`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.bouts')}</Link>
          <Link href={`/events/${eventId}/manage/print`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.print')}</Link>
          <Link href={`/events/${eventId}/manage/streaming`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.streaming')}</Link>
          <Link href={`/events/${eventId}`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.event')}</Link>
        </div>
      </header>

      {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <section className="border border-zinc-200 p-4">
        <h2 className="text-xl font-black uppercase text-zinc-900">{t('events.engine.live.areas')}</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <MatButton label={t('events.engine.live.all')} active={selectedMatId === 'all'} onClick={() => setSelectedMatId('all')} />
          {visibleMats.map((mat) => (
            <MatButton key={mat.id} label={mat.id === 'unassigned' ? mat.name : `${mat.mat_number}. ${mat.name}`} active={selectedMatId === mat.id} onClick={() => setSelectedMatId(mat.id)} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {selectedMats.map((mat) => (
          <MatQueue
            key={mat.id}
            mat={mat}
            bouts={activeBouts.filter((bout) => mat.id === 'unassigned' ? !bout.mat_id : bout.mat_id === mat.id)}
            busyId={acting}
            updateBout={updateBout}
          />
        ))}
      </section>
    </Frame>
  );
}

function MatQueue({ mat, bouts, busyId, updateBout }: {
  mat: EventMat;
  bouts: Bout[];
  busyId: string | null;
  updateBout: (boutId: string, operation: Parameters<typeof updateBoutOperation>[1]) => Promise<void>;
}) {
  const { t } = useTranslation('events');
  const current = bouts.find((bout) => bout.status === 'in_progress') ?? bouts.find((bout) => bout.status === 'ready') ?? bouts[0] ?? null;
  const next = current ? bouts.filter((bout) => bout.id !== current.id).slice(0, 3) : [];

  return (
    <article className="border border-zinc-200 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-black uppercase text-zinc-900">{mat.id === 'unassigned' ? mat.name : t('events.engine.live.areaNumber', { number: mat.mat_number })}</h2>
        <span className="text-sm text-zinc-500">{t('events.engine.live.activeCount', { count: bouts.length })}</span>
      </div>
      {!current ? (
        <p className="mt-4 border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">{t('events.engine.live.noActive')}</p>
      ) : (
        <div className="mt-4">
          <LiveBoutCard bout={current} primary busy={busyId === current.id} updateBout={updateBout} />
          <div className="mt-5">
            <h3 className="text-sm font-black uppercase tracking-wide text-zinc-700">{t('events.engine.live.next')}</h3>
            <div className="mt-3 space-y-3">
              {next.length === 0 ? (
                <p className="border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">{t('events.engine.live.noNext')}</p>
              ) : next.map((bout) => (
                <LiveBoutCard key={bout.id} bout={bout} busy={busyId === bout.id} updateBout={updateBout} />
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function LiveBoutCard({ bout, busy, updateBout, primary = false }: {
  bout: Bout;
  busy: boolean;
  primary?: boolean;
  updateBout: (boutId: string, operation: Parameters<typeof updateBoutOperation>[1]) => Promise<void>;
}) {
  const { t } = useTranslation('events');
  const [winner, setWinner] = useState('');
  const [method, setMethod] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState('');
  const [showResult, setShowResult] = useState(false);

  return (
    <div className={`border p-4 ${primary ? 'border-zinc-900' : 'border-zinc-200'}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-[#C0001E]">{t('events.engine.bouts.combatNumber', { number: bout.bout_number ?? t('events.engine.bouts.unassignedNumber') })} · {formatStatus(bout.status, t)}</p>
      <h3 className="mt-2 text-xl font-black text-zinc-900">{bout.fighter_a_snapshot.name}</h3>
      <p className="text-xs font-bold uppercase text-zinc-500">VS</p>
      <h3 className="text-xl font-black text-zinc-900">{bout.fighter_b_snapshot.name}</h3>
      <p className="mt-2 text-xs text-zinc-500">{bout.discipline ?? t('events.engine.bouts.pendingDiscipline')} · {bout.weight_class ?? t('events.engine.bouts.pendingWeight')}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {bout.status === 'confirmed' && <Action label={t('events.engine.bouts.ready')} disabled={busy} onClick={() => updateBout(bout.id, { status: 'ready' })} />}
        {bout.status === 'ready' && <Action label={t('events.engine.bouts.start')} disabled={busy} primary onClick={() => updateBout(bout.id, { status: 'in_progress' })} />}
        {bout.status === 'in_progress' && <Action label={t('events.engine.bouts.complete')} disabled={busy} primary onClick={() => setShowResult((value) => !value)} />}
        {!['completed', 'cancelled', 'no_show'].includes(bout.status) && <Action label={t('events.engine.bouts.absent')} disabled={busy} onClick={() => updateBout(bout.id, { status: 'no_show', reason: t('events.engine.bouts.absent') })} />}
        {!['completed', 'cancelled', 'no_show'].includes(bout.status) && <Action label={t('events.engine.bouts.cancel')} disabled={busy} onClick={() => updateBout(bout.id, { status: 'cancelled', reason: t('events.engine.bouts.cancel') })} />}
      </div>

      {showResult && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-4">
          <select value={winner} onChange={(eventValue) => setWinner(eventValue.target.value)} className="min-h-11 border border-zinc-300 bg-white px-3 py-2 text-sm">
            <option value="">{t('events.engine.bouts.winnerShort')}</option>
            <option value={bout.fighter_a_id}>{bout.fighter_a_snapshot.name}</option>
            <option value={bout.fighter_b_id}>{bout.fighter_b_snapshot.name}</option>
          </select>
          <input value={method} onChange={(eventValue) => setMethod(eventValue.target.value)} placeholder={t('events.engine.bouts.method')} className="min-h-11 border border-zinc-300 px-3 py-2 text-sm" />
          <input type="number" min={0} value={elapsedSeconds} onChange={(eventValue) => setElapsedSeconds(eventValue.target.value)} placeholder={t('events.engine.bouts.seconds')} className="min-h-11 border border-zinc-300 px-3 py-2 text-sm" />
          <button type="button" disabled={!winner || busy}
            onClick={() => updateBout(bout.id, { status: 'completed', winnerId: winner, method, elapsedSeconds: elapsedSeconds ? Number(elapsedSeconds) : undefined })}
            className="min-h-11 bg-[#C0001E] px-4 py-3 text-xs font-bold uppercase text-white disabled:bg-zinc-300">
            {t('events.engine.bouts.save')}
          </button>
        </div>
      )}
    </div>
  );
}

function Action({ label, onClick, disabled, primary = false }: { label: string; onClick: () => void; disabled: boolean; primary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`min-h-11 px-4 py-3 text-xs font-bold uppercase disabled:bg-zinc-300 disabled:text-white ${primary ? 'bg-zinc-900 text-white' : 'border border-zinc-300 bg-white text-zinc-800'}`}>{label}</button>;
}

function MatButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`min-h-11 border px-4 py-3 text-xs font-bold uppercase ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-800'}`}>
      {label}
    </button>
  );
}

function compareLiveBouts(left: Bout, right: Bout) {
  const statusRank = (status: Bout['status']) => status === 'in_progress' ? 0 : status === 'ready' ? 1 : 2;
  return statusRank(left.status) - statusRank(right.status)
    || (left.mat_order ?? Number.MAX_SAFE_INTEGER) - (right.mat_order ?? Number.MAX_SAFE_INTEGER)
    || (left.bout_number ?? Number.MAX_SAFE_INTEGER) - (right.bout_number ?? Number.MAX_SAFE_INTEGER)
    || new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
}

function formatStatus(value: string, t: (key: string) => string) {
  return t(`events.engine.status.${value}`) || value.replaceAll('_', ' ');
}

function Frame({ children }: { children: React.ReactNode }) {
  return <EventManageFrame>{children}</EventManageFrame>;
}
