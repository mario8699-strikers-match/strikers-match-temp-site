'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventManageFrame } from '@/components/EventManageFrame';
import { authService } from '@/services/authService';
import { getBoutsForEvent, getMatsForEvent } from '@/services/boutService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import type { Bout, Event, EventMat, Profile } from '@/types';

type PrintView = 'full' | 'mats' | 'fighters';

export default function EventPrintCenterPage() {
  const { t } = useTranslation('events');
  const { id: eventId } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [bouts, setBouts] = useState<Bout[]>([]);
  const [mats, setMats] = useState<EventMat[]>([]);
  const [view, setView] = useState<PrintView>('full');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
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
        const operatorAllowed = await canUseEventFeature(eventId, 'print', nextProfile, nextEvent);
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

  const orderedBouts = useMemo(() => [...bouts].sort(compareBouts), [bouts]);

  if (loading || profile === undefined) {
    return <Frame><p className="text-sm text-zinc-500">{t('events.engine.loading.print')}</p></Frame>;
  }

  if (!canManage) {
    return (
      <Frame>
        <h1 className="text-3xl font-black uppercase text-zinc-900">{t('events.engine.print.title')}</h1>
        <p className="mt-3 text-sm text-zinc-600">{t('events.engine.permission.print')}</p>
        <Link href={`/events/${eventId}`} className="mt-6 inline-block min-h-11 border border-zinc-300 px-4 py-3 text-sm font-bold text-zinc-800">
          {t('events.engine.nav.backToEvent')}
        </Link>
      </Frame>
    );
  }

  return (
    <Frame>
      <style>{PRINT_STYLES}</style>
      <header className="no-print flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">{t('events.engine.brand')}</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-zinc-900 sm:text-5xl">{t('events.engine.print.title')}</h1>
          <p className="mt-2 text-sm text-zinc-600">{event?.event_name}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
          <Link href={`/events/${eventId}/manage/settings`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.settings')}</Link>
          <Link href={`/events/${eventId}/manage/matchmaking`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.matchmaking')}</Link>
          <Link href={`/events/${eventId}/manage/bouts`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.bouts')}</Link>
          <Link href={`/events/${eventId}/manage/live`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.live')}</Link>
          <span aria-disabled="true" className="flex min-h-11 cursor-not-allowed items-center justify-center whitespace-nowrap border border-zinc-200 bg-zinc-100 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-400">{t('events.engine.nav.streaming')}</span>
          <Link href={`/events/${eventId}`} className="flex min-h-11 items-center justify-center whitespace-nowrap border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase text-zinc-800">{t('events.engine.nav.event')}</Link>
          <button type="button" onClick={() => window.print()} disabled={orderedBouts.length === 0}
            className="min-h-11 bg-zinc-900 px-4 py-3 text-xs font-bold uppercase text-white disabled:bg-zinc-300">{t('events.engine.print.print')}</button>
        </div>
      </header>

      <section className="no-print border border-zinc-200 p-4">
        <h2 className="text-xl font-black uppercase text-zinc-900">{t('events.engine.print.format')}</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <PrintTab label={t('events.engine.print.fullSheet')} active={view === 'full'} onClick={() => setView('full')} />
          <PrintTab label={t('events.engine.print.areaSheets')} active={view === 'mats'} onClick={() => setView('mats')} />
          <PrintTab label={t('events.engine.print.fighterCards')} active={view === 'fighters'} onClick={() => setView('fighters')} />
        </div>
        {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {orderedBouts.length === 0 && <p className="mt-4 border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{t('events.engine.print.noBouts')}</p>}
      </section>

      <section className="print-surface border border-zinc-200 bg-white p-4 sm:p-6">
        {view === 'full' && <FullBoutSheet event={event} bouts={orderedBouts} mats={mats} />}
        {view === 'mats' && <MatSheets event={event} bouts={orderedBouts} mats={mats} />}
        {view === 'fighters' && <FighterCards event={event} bouts={orderedBouts} mats={mats} />}
      </section>
    </Frame>
  );
}

function FullBoutSheet({ event, bouts, mats }: { event: Event | null; bouts: Bout[]; mats: EventMat[] }) {
  const { t } = useTranslation('events');
  return (
    <div>
      <PrintHeader event={event} title={t('events.engine.print.fullSheetTitle')} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              {[
                t('events.engine.print.combat'),
                t('events.engine.print.area'),
                t('events.engine.print.division'),
                t('events.engine.print.weight'),
                t('events.engine.print.fighterA'),
                t('events.engine.print.fighterB'),
                t('events.engine.print.status'),
              ].map((label) => (
                <th key={label} className="border border-zinc-300 px-2 py-2 font-black uppercase">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bouts.map((bout) => (
              <tr key={bout.id}>
                <td className="border border-zinc-300 px-2 py-2 font-bold">{bout.bout_number ?? ''}</td>
                <td className="border border-zinc-300 px-2 py-2">{matLabel(bout, mats)}</td>
                <td className="border border-zinc-300 px-2 py-2">{bout.discipline ?? ''}</td>
                <td className="border border-zinc-300 px-2 py-2">{bout.weight_class ?? ''}</td>
                <td className="border border-zinc-300 px-2 py-2">{bout.fighter_a_snapshot.name}</td>
                <td className="border border-zinc-300 px-2 py-2">{bout.fighter_b_snapshot.name}</td>
                <td className="border border-zinc-300 px-2 py-2">{formatStatus(bout.status, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatSheets({ event, bouts, mats }: { event: Event | null; bouts: Bout[]; mats: EventMat[] }) {
  const { t } = useTranslation('events');
  const activeMats = mats.length > 0 ? mats : [{ id: 'unassigned', name: t('events.engine.bouts.noArea'), mat_number: 0 } as EventMat];
  return (
    <div>
      {activeMats.map((mat) => {
        const matBouts = bouts.filter((bout) => mat.id === 'unassigned' ? !bout.mat_id : bout.mat_id === mat.id);
        return (
          <section key={mat.id} className="print-page mb-8">
            <PrintHeader event={event} title={mat.id === 'unassigned' ? t('events.engine.print.areaSheetUnassigned') : t('events.engine.print.areaSheetTitle', { number: mat.mat_number, name: mat.name })} />
            {matBouts.length === 0 ? (
              <p className="border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{t('events.engine.print.noAssigned')}</p>
            ) : (
              <div className="space-y-3">
                {matBouts.map((bout) => (
                  <div key={bout.id} className="border border-zinc-300 p-3">
                    <p className="text-xs font-black uppercase">{t('events.engine.bouts.combatNumber', { number: bout.bout_number ?? '' })}</p>
                    <p className="mt-1 text-lg font-black">{bout.fighter_a_snapshot.name}</p>
                    <p className="text-xs font-bold uppercase text-zinc-500">VS</p>
                    <p className="text-lg font-black">{bout.fighter_b_snapshot.name}</p>
                    <p className="mt-1 text-xs text-zinc-600">{bout.discipline ?? ''} · {bout.weight_class ?? ''} · {formatStatus(bout.status, t)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FighterCards({ event, bouts, mats }: { event: Event | null; bouts: Bout[]; mats: EventMat[] }) {
  const { t } = useTranslation('events');
  return (
    <div>
      <PrintHeader event={event} title={t('events.engine.print.fighterCardsTitle')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
        {bouts.flatMap((bout) => [
          <FighterCard key={`${bout.id}-a`} bout={bout} fighterName={bout.fighter_a_snapshot.name} opponentName={bout.fighter_b_snapshot.name} mats={mats} />,
          <FighterCard key={`${bout.id}-b`} bout={bout} fighterName={bout.fighter_b_snapshot.name} opponentName={bout.fighter_a_snapshot.name} mats={mats} />,
        ])}
      </div>
    </div>
  );
}

function FighterCard({ bout, fighterName, opponentName, mats }: {
  bout: Bout;
  fighterName: string;
  opponentName: string;
  mats: EventMat[];
}) {
  const { t } = useTranslation('events');
  return (
    <article className="break-inside-avoid border border-zinc-300 p-4">
      <p className="text-xs font-black uppercase tracking-wide">Strikers Match</p>
      <h3 className="mt-3 text-xl font-black">{fighterName}</h3>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <PrintTerm label={t('events.engine.print.combat')} value={bout.bout_number?.toString() ?? ''} />
        <PrintTerm label={t('events.engine.print.area')} value={matLabel(bout, mats)} />
        <PrintTerm label={t('events.engine.print.division')} value={bout.discipline ?? ''} />
        <PrintTerm label={t('events.engine.print.weight')} value={bout.weight_class ?? ''} />
        <PrintTerm label={t('events.engine.print.opponent')} value={opponentName} wide />
      </dl>
    </article>
  );
}

function PrintTerm({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs font-bold uppercase text-zinc-500">{label}</dt>
      <dd className="font-bold text-zinc-900">{value || '-'}</dd>
    </div>
  );
}

function PrintHeader({ event, title }: { event: Event | null; title: string }) {
  return (
    <header className="mb-5 border-b border-zinc-300 pb-3">
      <p className="text-xs font-black uppercase tracking-wide">Strikers Match</p>
      <h2 className="mt-1 text-2xl font-black uppercase">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600">{event?.event_name ?? ''} {event?.event_date ? `· ${formatDate(event.event_date)}` : ''}</p>
    </header>
  );
}

function PrintTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`min-h-11 border px-4 py-3 text-xs font-bold uppercase ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-800'}`}>
      {label}
    </button>
  );
}

function compareBouts(left: Bout, right: Bout) {
  return (left.bout_number ?? Number.MAX_SAFE_INTEGER) - (right.bout_number ?? Number.MAX_SAFE_INTEGER)
    || new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
}

function matLabel(bout: Bout, mats: EventMat[]) {
  const mat = mats.find((item) => item.id === bout.mat_id);
  if (!mat) return '';
  return `${mat.mat_number}. ${mat.name}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStatus(value: string, t: (key: string) => string) {
  return t(`events.engine.status.${value}`) || value.replaceAll('_', ' ');
}

function Frame({ children }: { children: React.ReactNode }) {
  return <EventManageFrame>{children}</EventManageFrame>;
}

const PRINT_STYLES = `
@media print {
  @page { size: letter; margin: 0.5in; }
  body { background: white; }
  .no-print, nav, footer { display: none !important; }
  main { max-width: none !important; padding: 0 !important; }
  .print-surface { border: 0 !important; padding: 0 !important; }
  .print-page { break-after: page; }
  .print-page:last-child { break-after: auto; }
}
`;
