'use client';

import { useEffect, useState } from 'react';
import { authService } from '@/services/authService';
import { canPerformAction } from '@/services/subscriptionService';
import {
  getEventHealth,
  getPromoterEvents,
  getAdminAnalyticsEvents,
  type EventHealth,
} from '@/services/analyticsService';
import type { Profile } from '@/types';

/**
 * Analytics dashboard body — no Navbar/Footer chrome so it can be rendered
 * inside either the public promoter layout or the admin sidebar layout.
 */
export function AnalyticsBody() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [paywallReason, setPaywallReason] = useState<string>('');

  const [events, setEvents] = useState<
    { id: string; event_name: string; event_date: string | null; status: string }[]
  >([]);
  const [selected, setSelected] = useState<string>('');
  const [health, setHealth] = useState<EventHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: session } = await authService.getSession();
      const p = session?.profile ?? null;
      setProfile(p);
      if (!p) return;

      const check = await canPerformAction(p.id, p.role, 'analytics_dashboard');
      setAllowed(check.allowed);
      setPaywallReason(check.reason);
      if (!check.allowed) return;

      // Admins see events created by any admin; promoters see only their own.
      const { data: evs } = p.role === 'admin'
        ? await getAdminAnalyticsEvents()
        : await getPromoterEvents(p.id);
      setEvents(evs ?? []);
      if (evs && evs.length > 0) setSelected(evs[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!selected || !allowed) return;
    setLoadingHealth(true);
    getEventHealth(selected).then(({ data }) => {
      setHealth(data);
      setLoadingHealth(false);
    });
  }, [selected, allowed]);

  if (profile === undefined) {
    return <p className="text-sm text-zinc-500">Cargando...</p>;
  }

  if (!profile) {
    return (
      <>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Estadísticas</h1>
        <p className="text-sm text-zinc-500">
          <a href="/login" className="underline">Inicia sesión</a> para ver el panel de estadísticas.
        </p>
      </>
    );
  }

  if (allowed === false) {
    return (
      <>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Estadísticas</h1>
        <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {paywallReason || 'Esta función requiere el plan Pro.'}
        </div>
        <a
          href="/pricing"
          className="inline-block mt-4 px-4 py-2 text-xs font-bold tracking-widest uppercase text-white bg-zinc-900 hover:bg-black"
        >
          Ver Planes
        </a>
      </>
    );
  }

  if (allowed === null) {
    return <p className="text-sm text-zinc-500">Verificando acceso...</p>;
  }

  if (events.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Estadísticas</h1>
        <p className="text-sm text-zinc-500">Aún no hay eventos para analizar.</p>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Estadísticas — Salud del Evento</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Métricas operativas: pagos confirmados, peleas armadas, clases de peso faltantes y riesgo de no-show.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-bold tracking-widest uppercase text-zinc-700 mb-2">
          Evento
        </label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full sm:w-auto border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.event_name}{e.event_date ? ` — ${new Date(e.event_date).toLocaleDateString()}` : ''}
            </option>
          ))}
        </select>
      </div>

      {loadingHealth || !health ? (
        <p className="text-sm text-zinc-500">Cargando métricas...</p>
      ) : (
        <HealthDashboard h={health} />
      )}
    </>
  );
}

function HealthDashboard({ h }: { h: EventHealth }) {
  const progressPct = Math.round(h.registrationProgress * 100);
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Solicitudes" value={h.totalApplications} />
        <Kpi label="Registrados (pago)" value={h.totalRegistered} />
        <Kpi label="Pago confirmado" value={h.confirmed} tone="emerald" />
        <Kpi label="Sin pareja" value={h.unmatchedConfirmed} tone={h.unmatchedConfirmed > 0 ? 'amber' : 'emerald'} />
      </section>

      <section>
        <SectionTitle>Solicitudes de Peleadores</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label="Pendientes" value={h.applicationsPending} tone={h.applicationsPending > 0 ? 'amber' : 'zinc'} />
          <Kpi label="Aceptadas" value={h.applicationsAccepted} tone="emerald" />
          <Kpi label="Rechazadas" value={h.applicationsDeclined} />
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Aplicaciones son la intención de participar. Se convierten en “Registrados” cuando inicias el flujo de pago.
        </p>
      </section>

      <section>
        <SectionTitle>Pagos</SectionTitle>
        <Bar
          segments={[
            { label: 'Confirmados', value: h.confirmed, tone: 'emerald' },
            { label: 'Por confirmar', value: h.submitted, tone: 'amber' },
            { label: 'Pendientes', value: h.pending, tone: 'zinc' },
          ]}
        />
        <p className="text-xs text-zinc-500 mt-2">
          {h.submitted} confirmaciones esperando tu acción.
        </p>
      </section>

      <section>
        <SectionTitle>Peleas</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label="Propuestas activas" value={h.matchesProposed} />
          <Kpi label="Confirmadas" value={h.matchesConfirmed} tone="emerald" />
          <Kpi label="Confirmados sin pareja" value={h.unmatchedConfirmed} tone={h.unmatchedConfirmed > 0 ? 'amber' : 'zinc'} />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <SectionTitle>Cobertura por Categoría de Peso</SectionTitle>
          {h.weightClassesNeeded.length > 0 && (
            <span className="text-xs text-zinc-500">
              <strong className="text-zinc-900">{h.weightClassesCovered.length}</strong>
              {' / '}
              {h.weightClassesNeeded.length} cubiertas
            </span>
          )}
        </div>
        {h.weightClassesNeeded.length === 0 ? (
          <p className="text-xs text-zinc-500">No se definieron categorías para este evento.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {h.weightClassesNeeded.map((w) => {
                const covered = h.weightClassesCovered.includes(w);
                return (
                  <div
                    key={w}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs border ${
                      covered
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-white border-zinc-200 text-zinc-700'
                    }`}
                    title={covered ? 'Cubierto' : 'Faltante'}
                  >
                    <span className="truncate font-medium">{w}</span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                        covered ? 'bg-emerald-500' : 'bg-red-400'
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                );
              })}
            </div>
            {h.missingWeightClasses.length > 0 && (
              <p className="text-xs text-amber-700 mt-3">
                Faltan {h.missingWeightClasses.length} categorías por cubrir.
              </p>
            )}
          </>
        )}
      </section>

      <section>
        <SectionTitle>Confiabilidad de los Peleadores Confirmados</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Alta confiabilidad" value={h.highReliabilityFighters} tone="emerald" />
          <Kpi label="Riesgo de no-show" value={h.noShowRisks} tone={h.noShowRisks > 0 ? 'red' : 'emerald'} />
        </div>
      </section>

      <section>
        <SectionTitle>Progreso General</SectionTitle>
        <div className="w-full h-3 bg-zinc-100 overflow-hidden">
          <div
            className="h-3 bg-emerald-600"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 mt-2">{progressPct}% de la meta cubierta.</p>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-700 mb-3">{children}</h2>
  );
}

function Kpi({
  label,
  value,
  tone = 'zinc',
}: {
  label: string;
  value: number;
  tone?: 'zinc' | 'emerald' | 'amber' | 'red';
}) {
  const toneClasses: Record<string, string> = {
    zinc: 'border-zinc-200 text-zinc-900',
    emerald: 'border-emerald-200 text-emerald-700',
    amber: 'border-amber-200 text-amber-700',
    red: 'border-red-200 text-red-700',
  };
  return (
    <div className={`border ${toneClasses[tone]} p-4`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs uppercase tracking-wide text-zinc-500 mt-1">{label}</p>
    </div>
  );
}

function Bar({
  segments,
}: {
  segments: { label: string; value: number; tone: 'emerald' | 'amber' | 'zinc' }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return <p className="text-xs text-zinc-500">Aún no hay registros.</p>;
  }
  const toneBg: Record<string, string> = {
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
    zinc: 'bg-zinc-400',
  };
  return (
    <div>
      <div className="w-full h-3 bg-zinc-100 overflow-hidden flex">
        {segments.map((s, i) => (
          <div
            key={i}
            className={toneBg[s.tone]}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
        {segments.map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 ${toneBg[s.tone]}`} />
            {s.label}: <strong className="text-zinc-700">{s.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
