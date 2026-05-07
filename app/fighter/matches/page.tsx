'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import { fighterService } from '@/services/fighterService';
import {
  getMatchesForFighter,
  acceptMatch,
  declineMatch,
  fighterSide,
  statusForFighter,
  type MatchWithContext,
} from '@/services/matchService';
import { reliabilityTier } from '@/services/reliabilityService';
import type { Profile, Fighter } from '@/types';

export default function FighterMatchesPage() {
  const { t } = useTranslation('events');

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [fighter, setFighter] = useState<Fighter | null>(null);
  const [matches, setMatches] = useState<MatchWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (fighterId: string) => {
    const { data, error: err } = await getMatchesForFighter(fighterId);
    if (err) setError(err);
    setMatches(data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: session } = await authService.getSession();
      const p = session?.profile ?? null;
      setProfile(p);

      if (!p || p.role !== 'fighter') {
        setLoading(false);
        return;
      }

      const { data: f } = await fighterService.getByProfileId(p.id);
      setFighter(f ?? null);
      if (f) await reload(f.id);
      setLoading(false);
    })();
  }, [reload]);

  const handleAccept = async (matchId: string) => {
    if (!fighter) return;
    setActing(matchId);
    setError(null);
    const { error: err } = await acceptMatch(matchId, fighter.id);
    if (err) setError(err);
    await reload(fighter.id);
    setActing(null);
  };

  const handleDecline = async (matchId: string) => {
    if (!fighter) return;
    setActing(matchId);
    setError(null);
    const { error: err } = await declineMatch(matchId, fighter.id);
    if (err) setError(err);
    await reload(fighter.id);
    setActing(null);
  };

  // ── Render ──
  if (loading || profile === undefined) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-zinc-500">{t('events.matches.loading', 'Cargando...')}</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-16">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">
            {t('events.matches.title', 'Mis Peleas')}
          </h1>
          <p className="text-sm text-zinc-500">
            <a href="/login" className="underline">{t('events.matches.signInPrompt', 'Inicia sesión')}</a>{' '}
            {t('events.matches.signInTail', 'para ver tus propuestas de pelea.')}
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (profile.role !== 'fighter' || !fighter) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-16">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">
            {t('events.matches.title', 'Mis Peleas')}
          </h1>
          <p className="text-sm text-zinc-500">
            {t('events.matches.fighterOnly', 'Esta sección es solo para perfiles de peleadores.')}
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const pending = matches.filter((m) => {
    const s = statusForFighter(m, fighter.id);
    return m.match_status === 'pending' && s === 'pending';
  });
  const confirmed = matches.filter((m) => m.match_status === 'confirmed');
  const history = matches.filter(
    (m) => m.match_status === 'cancelled' ||
      (m.match_status === 'pending' && statusForFighter(m, fighter.id) !== 'pending')
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-10 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900">
            {t('events.matches.title', 'Mis Peleas')}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {t(
              'events.matches.subtitle',
              'Acepta o rechaza propuestas de pelea. Una pelea se confirma cuando ambos atletas aceptan.'
            )}
          </p>
          {(() => {
            const tier = reliabilityTier(profile.reliability_score, profile.total_matches);
            if (tier.label === 'Unknown') return null;
            const tone = tier.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : tier.tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-200'
              : tier.tone === 'zinc' ? 'bg-zinc-50 text-zinc-600 border-zinc-200'
              : 'bg-red-50 text-red-700 border-red-200';
            const isNew = tier.label === 'New';
            return (
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-block text-xs font-bold px-2 py-1 border ${tone}`}>
                  {isNew
                    ? 'Atleta Nuevo · sin historial'
                    : `Reliability ${profile.reliability_score} · ${tier.label}`}
                </span>
                <span className="text-xs text-zinc-400">
                  {profile.total_matches ?? 0} peleas · {profile.cancellations ?? 0} cancelaciones · {profile.no_shows ?? 0} no-show
                </span>
              </div>
            );
          })()}
        </div>

        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Pending */}
        <Section
          title={t('events.matches.pending', 'Propuestas Pendientes')}
          count={pending.length}
          empty={t('events.matches.noPending', 'No tienes propuestas pendientes.')}
        >
          {pending.map((m) => (
            <PendingCard
              key={m.id}
              match={m}
              fighterId={fighter.id}
              busy={acting === m.id}
              onAccept={() => handleAccept(m.id)}
              onDecline={() => handleDecline(m.id)}
              t={t}
            />
          ))}
        </Section>

        {/* Confirmed */}
        <Section
          title={t('events.matches.confirmed', 'Peleas Confirmadas')}
          count={confirmed.length}
          empty={t('events.matches.noConfirmed', 'Todavía no tienes peleas confirmadas.')}
        >
          {confirmed.map((m) => (
            <StatusCard
              key={m.id}
              match={m}
              fighterId={fighter.id}
              tone="emerald"
              label={t('events.matches.statusConfirmed', 'Confirmada')}
              t={t}
            />
          ))}
        </Section>

        {/* History */}
        {history.length > 0 && (
          <Section
            title={t('events.matches.history', 'Historial')}
            count={history.length}
            empty=""
          >
            {history.map((m) => {
              const myStatus = statusForFighter(m, fighter.id);
              const tone =
                m.match_status === 'cancelled' ? 'red' :
                myStatus === 'accepted' ? 'amber' : 'zinc';
              const label =
                m.match_status === 'cancelled'
                  ? t('events.matches.statusCancelled', 'Cancelada')
                  : myStatus === 'accepted'
                  ? t('events.matches.waitingOpponent', 'Esperando al rival')
                  : t('events.matches.statusDeclined', 'Rechazada');
              return (
                <StatusCard
                  key={m.id}
                  match={m}
                  fighterId={fighter.id}
                  tone={tone}
                  label={label}
                  t={t}
                />
              );
            })}
          </Section>
        )}
      </main>
      <Footer />
    </div>
  );
}

// ── Helpers ──

function opponent(match: MatchWithContext, fighterId: string) {
  const side = fighterSide(match, fighterId);
  return side === 'a' ? match.fighter_b : match.fighter_a;
}

function eventLine(match: MatchWithContext): string {
  const ev = match.events;
  if (!ev) return '—';
  const parts = [ev.event_name];
  if (ev.event_date) parts.push(new Date(ev.event_date).toLocaleDateString());
  if (ev.city) parts.push(ev.city);
  return parts.join(' · ');
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-700">
          {title}
        </h2>
        <span className="text-xs text-zinc-400">{count}</span>
      </div>
      {count === 0 ? (
        <div className="border border-dashed border-zinc-200 py-6 text-center text-sm text-zinc-400">
          {empty}
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

type TFn = ReturnType<typeof useTranslation>['t'];

interface CardProps {
  match: MatchWithContext;
  fighterId: string;
  t: TFn;
}

function PendingCard({
  match,
  fighterId,
  busy,
  onAccept,
  onDecline,
  t,
}: CardProps & { busy: boolean; onAccept: () => void; onDecline: () => void }) {
  const opp = opponent(match, fighterId);
  return (
    <div className="border border-zinc-200 p-4">
      <div className="mb-2">
        <p className="text-sm font-bold text-zinc-900">
          vs {opp?.profiles?.full_name ?? '—'}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {opp?.weight_class ?? '—'} · {opp?.profiles?.city ?? '—'}
        </p>
      </div>
      <p className="text-xs text-zinc-500 mb-3">{eventLine(match)}</p>
      <div className="flex gap-2">
        <button
          onClick={onAccept}
          disabled={busy}
          className="flex-1 py-2 text-xs font-bold tracking-widest uppercase text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 transition-colors"
        >
          {busy ? '…' : t('events.matches.accept', 'Aceptar')}
        </button>
        <button
          onClick={onDecline}
          disabled={busy}
          className="flex-1 py-2 text-xs font-bold tracking-widest uppercase text-zinc-900 border border-zinc-300 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
          {busy ? '…' : t('events.matches.decline', 'Rechazar')}
        </button>
      </div>
    </div>
  );
}

function StatusCard({
  match,
  fighterId,
  tone,
  label,
  t: _t,
}: CardProps & { tone: 'emerald' | 'amber' | 'red' | 'zinc'; label: string }) {
  const opp = opponent(match, fighterId);
  const toneClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    zinc: 'bg-zinc-50 text-zinc-700 border-zinc-200',
  };
  return (
    <div className="border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-zinc-900">
            vs {opp?.profiles?.full_name ?? '—'}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {opp?.weight_class ?? '—'} · {opp?.profiles?.city ?? '—'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">{eventLine(match)}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 border ${toneClasses[tone]}`}>
          {label}
        </span>
      </div>
    </div>
  );
}
