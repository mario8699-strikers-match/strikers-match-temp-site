'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { authService } from '@/services/authService';
import {
  getAdminAnalyticsEvents,
  getEventHealth,
  getPromoterEvents,
  type EventHealth,
} from '@/services/analyticsService';
import type { Profile } from '@/types';

type AnalyticsEvent = { id: string; event_name: string; event_date: string | null; status: string };
type Tone = 'zinc' | 'emerald' | 'amber' | 'red';
type ActionKey = 'confirmPayments' | 'matchFighters' | 'coverWeights' | 'reviewApplications' | 'noShowRisk';

export function AnalyticsBody() {
  const { t, i18n } = useTranslation('admin');
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [selected, setSelected] = useState('');
  const [health, setHealth] = useState<EventHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(async () => {
      const { data: session } = await authService.getSession();
      if (!active) return;

      const nextProfile = session?.profile ?? null;
      setProfile(nextProfile);
      if (!nextProfile) return;

      const canViewAnalytics = nextProfile.role === 'admin' || nextProfile.role === 'promoter' || nextProfile.role === 'manager';
      setAllowed(canViewAnalytics);
      if (!canViewAnalytics) return;

      const { data: nextEvents } = nextProfile.role === 'admin'
        ? await getAdminAnalyticsEvents()
        : await getPromoterEvents(nextProfile.id);

      if (!active) return;
      setEvents(nextEvents ?? []);
      if (nextEvents && nextEvents.length > 0) setSelected(nextEvents[0].id);
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected || !allowed) return;
    let cancelled = false;

    void Promise.resolve().then(async () => {
      setLoadingHealth(true);
      const { data } = await getEventHealth(selected);
      if (cancelled) return;
      setHealth(data);
      setLoadingHealth(false);
    });

    return () => { cancelled = true; };
  }, [selected, allowed]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selected) ?? null,
    [events, selected],
  );

  if (profile === undefined) {
    return <p className="text-sm text-zinc-500">{t('admin.analyticsPage.loading')}</p>;
  }

  if (!profile) {
    return (
      <EmptyState
        title={t('admin.analyticsPage.title')}
        body={t('admin.analyticsPage.loginRequired')}
        action={<a href="/login" className="underline">{t('admin.analyticsPage.login')}</a>}
      />
    );
  }

  if (allowed === false) {
    return (
      <EmptyState
        title={t('admin.analyticsPage.title')}
        body={t('admin.analyticsPage.permission')}
        tone="amber"
      />
    );
  }

  if (allowed === null) {
    return <p className="text-sm text-zinc-500">{t('admin.analyticsPage.checking')}</p>;
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title={t('admin.analyticsPage.title')}
        body={t('admin.analyticsPage.noEvents')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="border border-zinc-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">
              {t('admin.analyticsPage.eyebrow')}
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase text-zinc-900 sm:text-4xl">
              {t('admin.analyticsPage.title')}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
              {t('admin.analyticsPage.subtitle')}
            </p>
          </div>

          <label className="block w-full lg:w-[420px]">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-700">
              {t('admin.analyticsPage.event')}
            </span>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="min-h-12 w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.event_name}{event.event_date ? ` — ${formatDate(event.event_date, i18n.language)}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {loadingHealth || !health ? (
        <section className="border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
          {t('admin.analyticsPage.loadingMetrics')}
        </section>
      ) : (
        <HealthDashboard h={health} selectedEvent={selectedEvent} />
      )}
    </div>
  );
}

function HealthDashboard({ h, selectedEvent }: { h: EventHealth; selectedEvent: AnalyticsEvent | null }) {
  const { t } = useTranslation('admin');
  const [modal, setModal] = useState<ActionKey | null>(null);

  const paymentTotal = h.confirmed + h.submitted + h.pending;
  const paymentPct = percent(h.confirmed, paymentTotal);
  const pairedConfirmed = Math.max(0, h.confirmed - h.unmatchedConfirmed);
  const pairingPct = percent(pairedConfirmed, h.confirmed);
  const proposalPct = percent(h.matchesConfirmed, h.matchesProposed);
  const coveragePct = h.weightClassesNeeded.length > 0
    ? percent(h.weightClassesCovered.length, h.weightClassesNeeded.length)
    : 100;
  const reliabilityPct = h.confirmed > 0 ? percent(h.confirmed - h.noShowRisks, h.confirmed) : 100;
  const readinessScore = Math.round((paymentPct + pairingPct + coveragePct + reliabilityPct) / 4);
  const readinessTone: Tone = readinessScore >= 80 ? 'emerald' : readinessScore >= 55 ? 'amber' : 'red';

  const actionItems = buildActionItems(h, t);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
        <ReadinessCard score={readinessScore} tone={readinessTone} status={selectedEvent?.status ?? '—'} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label={t('admin.analyticsPage.kpis.applications')} value={h.totalApplications} detail={t('admin.analyticsPage.kpis.intent')} />
          <Kpi label={t('admin.analyticsPage.kpis.registered')} value={h.totalRegistered} detail={t('admin.analyticsPage.kpis.paymentFlow')} />
          <Kpi label={t('admin.analyticsPage.kpis.confirmedPaid')} value={h.confirmed} tone="emerald" detail={`${paymentPct}%`} />
          <Kpi label={t('admin.analyticsPage.kpis.unmatched')} value={h.unmatchedConfirmed} tone={h.unmatchedConfirmed > 0 ? 'amber' : 'emerald'} detail={`${pairingPct}% ${t('admin.analyticsPage.kpis.paired')}`} />
        </div>
      </section>

      <Panel title={t('admin.analyticsPage.sections.pipeline')}>
        <PipelineFlow
          steps={[
            { label: t('admin.analyticsPage.kpis.applications'), value: h.totalApplications, max: Math.max(h.totalApplications, h.totalRegistered, h.confirmed, pairedConfirmed, 1), tone: 'zinc' },
            { label: t('admin.analyticsPage.kpis.registered'), value: h.totalRegistered, max: Math.max(h.totalApplications, h.totalRegistered, h.confirmed, pairedConfirmed, 1), tone: 'amber' },
            { label: t('admin.analyticsPage.kpis.confirmedPaid'), value: h.confirmed, max: Math.max(h.totalApplications, h.totalRegistered, h.confirmed, pairedConfirmed, 1), tone: 'emerald' },
            { label: t('admin.analyticsPage.kpis.paired'), value: pairedConfirmed, max: Math.max(h.totalApplications, h.totalRegistered, h.confirmed, pairedConfirmed, 1), tone: h.unmatchedConfirmed > 0 ? 'amber' : 'emerald' },
          ]}
        />
      </Panel>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title={t('admin.analyticsPage.sections.eventFlow')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ProgressMetric
              label={t('admin.analyticsPage.metrics.paymentHealth')}
              value={paymentPct}
              helper={t('admin.analyticsPage.metrics.paymentHelper', { confirmed: h.confirmed, total: paymentTotal })}
              tone={paymentPct >= 80 ? 'emerald' : paymentPct >= 50 ? 'amber' : 'red'}
            />
            <ProgressMetric
              label={t('admin.analyticsPage.metrics.matchmakingHealth')}
              value={pairingPct}
              helper={t('admin.analyticsPage.metrics.matchmakingHelper', { paired: pairedConfirmed, confirmed: h.confirmed })}
              tone={h.unmatchedConfirmed > 0 ? 'amber' : 'emerald'}
            />
            <ProgressMetric
              label={t('admin.analyticsPage.metrics.categoryCoverage')}
              value={coveragePct}
              helper={h.weightClassesNeeded.length > 0
                ? t('admin.analyticsPage.metrics.categoryHelper', { covered: h.weightClassesCovered.length, total: h.weightClassesNeeded.length })
                : t('admin.analyticsPage.metrics.noCategories')}
              tone={coveragePct >= 80 ? 'emerald' : coveragePct >= 50 ? 'amber' : 'red'}
            />
          </div>
        </Panel>

        <Panel title={t('admin.analyticsPage.sections.needsAttention')}>
          {actionItems.length === 0 ? (
            <div className="border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-800">{t('admin.analyticsPage.actions.clearTitle')}</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-700">{t('admin.analyticsPage.actions.clearBody')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionItems.map((item) => (
                <ActionItem
                  key={item.key}
                  label={item.label}
                  value={item.value}
                  tone={item.tone}
                  onClick={item.key === 'matchFighters' ? () => setModal('matchFighters') : undefined}
                />
              ))}
            </div>
          )}
        </Panel>
      </section>

      {modal === 'matchFighters' && (
        <FighterListModal
          title={t('admin.analyticsPage.modals.unmatchedTitle')}
          body={t('admin.analyticsPage.modals.unmatchedBody')}
          fighters={h.unmatchedConfirmedFighters}
          onClose={() => setModal(null)}
        />
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title={t('admin.analyticsPage.sections.payments')}>
          <SegmentedBar
            segments={[
              { label: t('admin.analyticsPage.payments.confirmed'), value: h.confirmed, tone: 'emerald' },
              { label: t('admin.analyticsPage.payments.submitted'), value: h.submitted, tone: 'amber' },
              { label: t('admin.analyticsPage.payments.pending'), value: h.pending, tone: 'zinc' },
            ]}
            emptyText={t('admin.analyticsPage.payments.empty')}
          />
          <div className="mt-5 grid grid-cols-3 gap-3">
            <MiniStat label={t('admin.analyticsPage.payments.confirmed')} value={h.confirmed} tone="emerald" />
            <MiniStat label={t('admin.analyticsPage.payments.submitted')} value={h.submitted} tone="amber" />
            <MiniStat label={t('admin.analyticsPage.payments.pending')} value={h.pending} />
          </div>
        </Panel>

        <Panel title={t('admin.analyticsPage.sections.applications')}>
          <SegmentedBar
            segments={[
              { label: t('admin.analyticsPage.applications.accepted'), value: h.applicationsAccepted, tone: 'emerald' },
              { label: t('admin.analyticsPage.applications.pending'), value: h.applicationsPending, tone: 'amber' },
              { label: t('admin.analyticsPage.applications.declined'), value: h.applicationsDeclined, tone: 'red' },
            ]}
            emptyText={t('admin.analyticsPage.applications.empty')}
          />
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            {t('admin.analyticsPage.applications.help')}
          </p>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title={t('admin.analyticsPage.sections.matchmaking')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Kpi label={t('admin.analyticsPage.matches.active')} value={h.matchesProposed} />
            <Kpi label={t('admin.analyticsPage.matches.confirmed')} value={h.matchesConfirmed} tone="emerald" detail={`${proposalPct}%`} />
            <Kpi label={t('admin.analyticsPage.matches.unmatched')} value={h.unmatchedConfirmed} tone={h.unmatchedConfirmed > 0 ? 'amber' : 'emerald'} />
          </div>
        </Panel>

        <Panel title={t('admin.analyticsPage.sections.reliability')}>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label={t('admin.analyticsPage.reliability.high')} value={h.highReliabilityFighters} tone="emerald" />
            <MiniStat label={t('admin.analyticsPage.reliability.risk')} value={h.noShowRisks} tone={h.noShowRisks > 0 ? 'red' : 'emerald'} />
          </div>
          <ProgressMetric
            className="mt-4"
            label={t('admin.analyticsPage.reliability.score')}
            value={reliabilityPct}
            helper={t('admin.analyticsPage.reliability.helper')}
            tone={h.noShowRisks > 0 ? 'amber' : 'emerald'}
          />
        </Panel>
      </section>

      <Panel title={t('admin.analyticsPage.sections.weightCoverage')}>
        {h.weightClassesNeeded.length === 0 ? (
          <p className="text-sm text-zinc-500">{t('admin.analyticsPage.weight.noDefined')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t('admin.analyticsPage.weight.covered')}</p>
              <p className="mt-2 text-4xl font-black text-zinc-900">{h.weightClassesCovered.length}/{h.weightClassesNeeded.length}</p>
              <ProgressBar value={coveragePct} tone={coveragePct >= 80 ? 'emerald' : coveragePct >= 50 ? 'amber' : 'red'} className="mt-4" />
              {h.missingWeightClasses.length > 0 && (
                <p className="mt-3 text-xs leading-relaxed text-amber-700">
                  {t('admin.analyticsPage.weight.missing', { count: h.missingWeightClasses.length })}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {h.weightClassesNeeded.map((weight) => {
                const covered = h.weightClassesCovered.includes(weight);
                return (
                  <div
                    key={weight}
                    className={`border p-3 ${covered ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-zinc-200 bg-white text-zinc-700'}`}
                  >
                    <p className="truncate text-sm font-bold">{weight}</p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-wide opacity-70">
                      {covered ? t('admin.analyticsPage.weight.coveredStatus') : t('admin.analyticsPage.weight.missingStatus')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReadinessCard({ score, tone, status }: { score: number; tone: Tone; status: string }) {
  const { t } = useTranslation('admin');

  return (
    <section className={`border bg-white p-5 ${toneBorder(tone)}`}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
        {t('admin.analyticsPage.readiness.title')}
      </p>
      <div className="mt-4 grid grid-cols-[150px_minmax(0,1fr)] items-center gap-5">
        <ScoreGauge score={score} tone={tone} />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {t('admin.analyticsPage.readiness.eventStatus')}
          </p>
          <p className="mt-1 text-sm font-black uppercase text-zinc-900">{status}</p>
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {t('admin.analyticsPage.readiness.points')}
            </p>
            <p className={`mt-1 text-5xl font-black tabular-nums ${toneText(tone)}`}>{score}</p>
          </div>
        </div>
      </div>
      <ProgressBar value={score} tone={tone} className="mt-5" />
      <p className="mt-3 text-xs leading-relaxed text-zinc-600">
        {t('admin.analyticsPage.readiness.help')}
      </p>
    </section>
  );
}

function ScoreGauge({ score, tone }: { score: number; tone: Tone }) {
  const normalized = clamp(score);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalized / 100) * circumference;

  return (
    <div className="relative h-[150px] w-[150px]">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgb(244 244 245)" strokeWidth="14" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="14"
          strokeLinecap="butt"
          className={toneStroke(tone)}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className={`text-4xl font-black tabular-nums ${toneText(tone)}`}>{score}</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">/ 100</p>
      </div>
    </div>
  );
}

function PipelineFlow({
  steps,
}: {
  steps: { label: string; value: number; max: number; tone: Tone }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {steps.map((step, index) => (
        <div key={step.label} className="border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {String(index + 1).padStart(2, '0')}
          </p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-zinc-900">{step.label}</p>
              <p className={`mt-2 text-4xl font-black tabular-nums ${toneText(step.tone)}`}>{step.value}</p>
            </div>
            <p className="text-xs font-bold text-zinc-500">{percent(step.value, step.max)}%</p>
          </div>
          <ProgressBar value={percent(step.value, step.max)} tone={step.tone} className="mt-4" />
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-zinc-200 bg-white p-5">
      <h2 className="border-b border-zinc-200 pb-3 text-sm font-black uppercase tracking-widest text-zinc-900">
        {title}
      </h2>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  detail,
  tone = 'zinc',
}: {
  label: string;
  value: number;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <div className={`border bg-white p-4 ${toneBorder(tone)}`}>
      <div className={`mb-4 h-1 w-16 ${toneBg(tone)}`} />
      <p className={`text-4xl font-black tabular-nums ${tone === 'zinc' ? 'text-zinc-900' : toneText(tone)}`}>{value}</p>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      {detail && <p className="mt-2 text-xs text-zinc-500">{detail}</p>}
    </div>
  );
}

function MiniStat({ label, value, tone = 'zinc' }: { label: string; value: number; tone?: Tone }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 p-3">
      <p className={`text-2xl font-black tabular-nums ${tone === 'zinc' ? 'text-zinc-900' : toneText(tone)}`}>{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}

function ProgressMetric({
  label,
  value,
  helper,
  tone,
  className = '',
}: {
  label: string;
  value: number;
  helper: string;
  tone: Tone;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-wide text-zinc-900">{label}</p>
        <p className={`text-sm font-black tabular-nums ${toneText(tone)}`}>{value}%</p>
      </div>
      <ProgressBar value={value} tone={tone} className="mt-2" />
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">{helper}</p>
    </div>
  );
}

function ProgressBar({ value, tone, className = '' }: { value: number; tone: Tone; className?: string }) {
  return (
    <div className={`h-3 w-full bg-zinc-100 ${className}`}>
      <div className={`h-3 ${toneBg(tone)}`} style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

function SegmentedBar({
  segments,
  emptyText,
}: {
  segments: { label: string; value: number; tone: Tone }[];
  emptyText: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return <p className="text-sm text-zinc-500">{emptyText}</p>;

  return (
    <div>
      <div className="flex h-5 w-full bg-zinc-100">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={toneBg(segment.tone)}
            style={{ width: `${percent(segment.value, total)}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-xs text-zinc-600">
            <span className={`h-3 w-3 ${toneBg(segment.tone)}`} />
            <span>{segment.label}: <strong className="text-zinc-900">{segment.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionItem({ label, value, tone, onClick }: { label: string; value: number; tone: Tone; onClick?: () => void }) {
  const { t } = useTranslation('admin');
  const content = (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-zinc-900">{label}</p>
        <p className={`text-2xl font-black tabular-nums ${toneText(tone)}`}>{value}</p>
      </div>
      {onClick && <p className="mt-2 text-xs font-bold uppercase tracking-wide text-zinc-500">{t('admin.analyticsPage.actions.viewDetail')}</p>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`block w-full border p-3 text-left transition-colors hover:bg-zinc-50 ${toneBorder(tone)}`}>
        {content}
      </button>
    );
  }

  return (
    <div className={`border p-3 ${toneBorder(tone)}`}>
      {content}
    </div>
  );
}

function FighterListModal({
  title,
  body,
  fighters,
  onClose,
}: {
  title: string;
  body: string;
  fighters: EventHealth['unmatchedConfirmedFighters'];
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">
              {t('admin.analyticsPage.sections.needsAttention')}
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase text-zinc-900">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{body}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-900"
          >
            {t('admin.analyticsPage.modals.close')}
          </button>
        </div>

        {fighters.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">{t('admin.analyticsPage.modals.noUnmatched')}</p>
        ) : (
          <div className="mt-4 divide-y divide-zinc-200 border border-zinc-200">
            {fighters.map((fighter) => (
              <div key={fighter.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-base font-black uppercase text-zinc-900">{fighter.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                    <span className="border border-zinc-200 bg-zinc-50 px-2 py-1">
                      {t('admin.analyticsPage.modals.weight')}: {fighter.weight_class ?? '—'}
                    </span>
                    <span className="border border-zinc-200 bg-zinc-50 px-2 py-1">
                      {t('admin.analyticsPage.modals.city')}: {fighter.city ?? '—'}
                    </span>
                    <span className="border border-zinc-200 bg-zinc-50 px-2 py-1">
                      {t('admin.analyticsPage.modals.reliability')}: {fighter.reliability_score ?? '—'}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/fighters/${fighter.id}`}
                  className="min-h-11 border border-zinc-900 bg-zinc-900 px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-white"
                >
                  {t('admin.analyticsPage.modals.viewProfile')}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
  tone = 'zinc',
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <section className={`border bg-white p-5 ${toneBorder(tone)}`}>
      <h1 className="text-2xl font-black uppercase text-zinc-900">{title}</h1>
      <p className="mt-2 text-sm text-zinc-600">{body}</p>
      {action && <p className="mt-3 text-sm text-zinc-700">{action}</p>}
    </section>
  );
}

function buildActionItems(h: EventHealth, t: ReturnType<typeof useTranslation>['t']) {
  const items: { key: ActionKey; label: string; value: number; tone: Tone }[] = [];
  if (h.submitted > 0) items.push({ key: 'confirmPayments', label: t('admin.analyticsPage.actions.confirmPayments'), value: h.submitted, tone: 'amber' });
  if (h.unmatchedConfirmed > 0) items.push({ key: 'matchFighters', label: t('admin.analyticsPage.actions.matchFighters'), value: h.unmatchedConfirmed, tone: 'amber' });
  if (h.missingWeightClasses.length > 0) items.push({ key: 'coverWeights', label: t('admin.analyticsPage.actions.coverWeights'), value: h.missingWeightClasses.length, tone: 'amber' });
  if (h.applicationsPending > 0) items.push({ key: 'reviewApplications', label: t('admin.analyticsPage.actions.reviewApplications'), value: h.applicationsPending, tone: 'zinc' });
  if (h.noShowRisks > 0) items.push({ key: 'noShowRisk', label: t('admin.analyticsPage.actions.noShowRisk'), value: h.noShowRisks, tone: 'red' });
  return items;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function toneBorder(tone: Tone) {
  const classes: Record<Tone, string> = {
    zinc: 'border-zinc-200',
    emerald: 'border-emerald-200',
    amber: 'border-amber-200',
    red: 'border-red-200',
  };
  return classes[tone];
}

function toneText(tone: Tone) {
  const classes: Record<Tone, string> = {
    zinc: 'text-zinc-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  };
  return classes[tone];
}

function toneBg(tone: Tone) {
  const classes: Record<Tone, string> = {
    zinc: 'bg-zinc-400',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
    red: 'bg-red-600',
  };
  return classes[tone];
}

function toneStroke(tone: Tone) {
  const classes: Record<Tone, string> = {
    zinc: 'stroke-zinc-400',
    emerald: 'stroke-emerald-500',
    amber: 'stroke-amber-500',
    red: 'stroke-red-600',
  };
  return classes[tone];
}

function formatDate(value: string, language: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(language === 'es' ? 'es-MX' : 'en-US');
}
