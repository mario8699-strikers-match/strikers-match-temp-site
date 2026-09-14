'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventManageFrame } from '@/components/EventManageFrame';
import { authService } from '@/services/authService';
import { getBoutsForEvent, getMatsForEvent } from '@/services/boutService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import type { Bout, Event, EventMat, Profile } from '@/types';

type PrintView = 'full' | 'mats' | 'fighters' | 'officials';

export default function EventPrintCenterPage() {
  const { t } = useTranslation('events');
  const { id: eventId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [bouts, setBouts] = useState<Bout[]>([]);
  const [mats, setMats] = useState<EventMat[]>([]);
  const [view, setView] = useState<PrintView>(() => searchParams.get('view') === 'officials' ? 'officials' : 'full');
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
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <PrintTab label={t('events.engine.print.fullSheet')} active={view === 'full'} onClick={() => setView('full')} />
          <PrintTab label={t('events.engine.print.areaSheets')} active={view === 'mats'} onClick={() => setView('mats')} />
          <PrintTab label={t('events.engine.print.fighterCards')} active={view === 'fighters'} onClick={() => setView('fighters')} />
          <PrintTab label={t('events.engine.print.officialsCards')} active={view === 'officials'} onClick={() => setView('officials')} />
        </div>
        {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {orderedBouts.length === 0 && <p className="mt-4 border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{t('events.engine.print.noBouts')}</p>}
      </section>

      <section className="print-surface border border-zinc-200 bg-white p-4 sm:p-6">
        {view === 'full' && <FullBoutSheet event={event} bouts={orderedBouts} mats={mats} />}
        {view === 'mats' && <MatSheets event={event} bouts={orderedBouts} mats={mats} />}
        {view === 'fighters' && <FighterCards event={event} bouts={orderedBouts} mats={mats} />}
        {view === 'officials' && <OfficialsSheets event={event} bouts={orderedBouts} mats={mats} />}
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

function OfficialsSheets({ event, bouts, mats }: { event: Event | null; bouts: Bout[]; mats: EventMat[] }) {
  const { t } = useTranslation('events');
  const activeBouts = bouts.filter((bout) => !['cancelled', 'no_show'].includes(bout.status));
  const groups = new Map<string, Bout[]>();

  for (const bout of activeBouts) {
    const label = officialsDivisionLabel(bout, t('events.engine.print.unassignedDivision'));
    groups.set(label, [...(groups.get(label) ?? []), bout]);
  }

  return (
    <div>
      <PrintHeader event={event} title={t('events.engine.print.officialsCardsTitle')} />
      <p className="mb-6 text-sm text-zinc-600">{t('events.engine.print.officialsDescription')}</p>
      {groups.size === 0 ? (
        <p className="border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">{t('events.engine.print.noOfficialsBouts')}</p>
      ) : (
        Array.from(groups.entries()).map(([division, divisionBouts]) => (
          <section key={division} className="print-page mb-10">
            <div className="border-b-4 border-zinc-950 bg-zinc-100 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#C0001E]">{t('events.engine.print.officialDivision')}</p>
              <h3 className="mt-1 text-xl font-black uppercase leading-tight text-zinc-950 sm:text-2xl">{division}</h3>
            </div>
            <div className="mt-5 space-y-6">
              {divisionBouts.map((bout) => <OfficialsBracket key={bout.id} bout={bout} mats={mats} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function OfficialsBracket({ bout, mats }: { bout: Bout; mats: EventMat[] }) {
  const { t } = useTranslation('events');
  const winner = officialsWinner(bout);
  const resultDetail = [bout.method, bout.elapsed_seconds !== null ? formatElapsed(bout.elapsed_seconds) : null]
    .filter(Boolean)
    .join(' · ');
  const placement = [
    bout.bout_number ? t('events.engine.bouts.combatNumber', { number: bout.bout_number }) : null,
    matLabel(bout, mats) || null,
    bout.scheduled_time ? formatBoutTime(bout.scheduled_time) : null,
  ].filter(Boolean).join(' · ');

  return (
    <article className="break-inside-avoid border border-zinc-300 bg-white p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200 pb-3">
        <div>
          <p className="text-sm font-black uppercase text-zinc-950">{placement || t('events.engine.print.pendingPlacement')}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{[bout.ruleset, bout.bout_format].filter(Boolean).join(' · ') || t('events.engine.print.pendingRules')}</p>
        </div>
        <span className="border border-zinc-300 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-600">{formatStatus(bout.status, t)}</span>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,0.9fr)] items-stretch">
        <div className="space-y-3">
          <OfficialFighterBox fighter={bout.fighter_a_snapshot} corner={t('events.engine.print.redCorner')} color="#C0001E" />
          <OfficialFighterBox fighter={bout.fighter_b_snapshot} corner={t('events.engine.print.blueCorner')} color="#1D4ED8" />
        </div>
        <div className="relative min-h-40" aria-hidden="true">
          <span className="absolute left-0 top-1/4 w-1/2 border-t-2 border-zinc-700" />
          <span className="absolute bottom-1/4 left-0 w-1/2 border-t-2 border-zinc-700" />
          <span className="absolute left-1/2 top-1/4 h-1/2 border-l-2 border-zinc-700" />
          <span className="absolute left-1/2 top-1/2 w-1/2 border-t-2 border-zinc-700" />
        </div>
        <div className={`flex min-h-20 self-center border-2 p-3 ${winner ? 'border-emerald-700 bg-emerald-50' : 'border-dashed border-zinc-400 bg-zinc-50'}`}>
          <div className="my-auto min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest ${winner ? 'text-emerald-800' : 'text-zinc-500'}`}>{t('events.engine.print.winner')}</p>
            <p className="mt-1 break-words text-sm font-black uppercase leading-tight text-zinc-950 sm:text-base">{winner?.name ?? t('events.engine.print.pendingResult')}</p>
            {resultDetail && <p className="mt-1 text-[10px] font-bold uppercase text-zinc-600">{resultDetail}</p>}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-zinc-200 pt-3 text-xs text-zinc-600">
        <p><span className="font-black uppercase">{t('events.engine.print.judge')}:</span> ____________________</p>
        <p><span className="font-black uppercase">{t('events.engine.print.referee')}:</span> ____________________</p>
      </div>
    </article>
  );
}

function OfficialFighterBox({ fighter, corner, color }: { fighter: Bout['fighter_a_snapshot']; corner: string; color: string }) {
  return (
    <div className="min-h-20 border border-zinc-300 border-l-[6px] p-3" style={{ borderLeftColor: color }}>
      <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color }}>{corner}</p>
      <p className="mt-1 break-words text-sm font-black uppercase leading-tight text-zinc-950 sm:text-base">{fighter.name}</p>
      <p className="mt-1 text-[10px] uppercase leading-snug text-zinc-500">{[fighter.team, fighter.city || fighter.state].filter(Boolean).join(' · ') || '—'}</p>
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

function officialsDivisionLabel(bout: Bout, fallback: string) {
  const values = [
    bout.age_class,
    bout.experience_level,
    bout.fighter_a_snapshot.gender_division ?? bout.fighter_b_snapshot.gender_division,
    bout.discipline,
    bout.weight_class,
    bout.belt_level,
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(values)).join(' · ') || fallback;
}

function officialsWinner(bout: Bout): Bout['fighter_a_snapshot'] | null {
  if (bout.winner_registration_id === bout.fighter_a_registration_id || (bout.winner_id && bout.winner_id === bout.fighter_a_id)) {
    return bout.fighter_a_snapshot;
  }
  if (bout.winner_registration_id === bout.fighter_b_registration_id || (bout.winner_id && bout.winner_id === bout.fighter_b_id)) {
    return bout.fighter_b_snapshot;
  }
  return null;
}

function formatBoutTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
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
