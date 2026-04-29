'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ManualFighterManager } from '@/components/ManualFighterManager';
import { authService } from '@/services/authService';
import { eventService } from '@/services/eventService';
import { getEventRegistrations, confirmPayment } from '@/services/registrationService';
import { seedTestData } from '@/lib/testSeed';
import { runTestFlow, resetTestSubscription } from '@/lib/testFlow';
import type { Event, EventApplication, Profile } from '@/types';
import type { RegistrationWithFighter } from '@/types';
import type { TestFlowResult } from '@/lib/testFlow';

const STATUS_COLORS: Record<Event['status'], string> = {
  draft:     'bg-zinc-100 text-zinc-600',
  published: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  completed: 'bg-blue-50 text-blue-700',
};

const APP_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700' },
  accepted:  { label: 'Aceptado',   cls: 'bg-emerald-50 text-emerald-700' },
  declined:  { label: 'Rechazado',  cls: 'bg-red-50 text-red-700' },
  withdrawn: { label: 'Retirado',   cls: 'bg-zinc-100 text-zinc-500' },
};

type ApplicationWithFighter = EventApplication & {
  fighters: {
    profiles: { full_name: string; city: string | null };
    weight_class: string | null;
    disciplines: string[];
    photo_url: string | null;
  };
};

export default function PromoterDashboardPage() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  // Selected event for applications panel
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationWithFighter[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [updatingApp, setUpdatingApp] = useState<string | null>(null);

  // Event registrations (payment tracking)
  const [selectedRegEventId, setSelectedRegEventId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationWithFighter[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [confirmingReg, setConfirmingReg] = useState<string | null>(null);

  // ── DEV ONLY: Test flow state — REMOVE BEFORE PRODUCTION ──
  const [testRunning, setTestRunning] = useState(false);
  const [seedRunning, setSeedRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestFlowResult | null>(null);
  const [seedLog, setSeedLog] = useState<string[]>([]);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    authService.getSession().then(async ({ data }) => {
      const p = data?.profile ?? null;
      setProfile(p);
      if (!p) { window.location.href = '/login'; return; }
      if (p.role !== 'promoter' && p.role !== 'admin') { window.location.href = '/'; return; }

      const [{ data: evs }, counts] = await Promise.all([
        eventService.getByPromoter(p.id),
        eventService.getApplicationCountsForPromoter(p.id),
      ]);
      setEvents(evs ?? []);
      setPendingCounts(counts);
      setLoading(false);
    });
  }, []);

  const loadApplications = async (eventId: string) => {
    if (selectedEventId === eventId) { setSelectedEventId(null); return; }
    setSelectedEventId(eventId);
    setAppsLoading(true);
    const { data } = await eventService.getApplicationsForEvent(eventId);
    setApplications((data ?? []) as ApplicationWithFighter[]);
    setAppsLoading(false);
  };

  const handleAppStatus = async (appId: string, status: 'accepted' | 'declined') => {
    setUpdatingApp(appId);
    await eventService.updateApplicationStatus(appId, status);
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a));
    // Update pending count
    if (selectedEventId) {
      setPendingCounts((prev) => ({
        ...prev,
        [selectedEventId]: Math.max(0, (prev[selectedEventId] ?? 1) - 1),
      }));
    }
    setUpdatingApp(null);
  };

  const loadRegistrations = async (eventId: string) => {
    if (selectedRegEventId === eventId) { setSelectedRegEventId(null); return; }
    setSelectedRegEventId(eventId);
    setRegsLoading(true);
    const { data } = await getEventRegistrations(eventId);
    setRegistrations(data ?? []);
    setRegsLoading(false);
  };

  const handleConfirmPayment = async (regId: string) => {
    setConfirmingReg(regId);
    const { data } = await confirmPayment(regId);
    if (data) {
      setRegistrations((prev) => prev.map((r) => r.id === regId ? { ...r, payment_status: 'confirmed', confirmed_at: data.confirmed_at } : r));
    }
    setConfirmingReg(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Sin fecha';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (profile === undefined) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm" style={{ color: '#9A9A9A' }}>...</p></div>;

  const publishedEvents = events.filter((e) => e.status === 'published');
  const draftEvents = events.filter((e) => e.status !== 'published' && e.status !== 'completed');
  const totalPending = Object.values(pendingCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage={null} />
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#C0001E' }}>Panel del Promotor</p>
            <h1 className="text-3xl font-black uppercase" style={{ letterSpacing: '-1px' }}>{profile!.full_name}</h1>
            <p className="text-sm mt-1" style={{ color: '#5A5A5A' }}>{profile!.city ?? ''}</p>
          </div>
          <a href="/events/create"
            className="px-5 py-2.5 text-xs font-bold tracking-widest uppercase text-white transition-colors flex-shrink-0"
            style={{ background: '#C0001E' }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#9A0018')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#C0001E')}>
            + Nuevo evento
          </a>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Eventos publicados', value: publishedEvents.length },
            { label: 'Borradores', value: draftEvents.length },
            { label: 'Solicitudes pendientes', value: totalPending },
          ].map(({ label, value }) => (
            <div key={label} className="border border-zinc-100 p-5 text-center">
              <p className="text-3xl font-black" style={{ fontFamily: 'var(--font-barlow-condensed)', letterSpacing: '-1px' }}>{value}</p>
              <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: '#5A5A5A' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Events list */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C0001E' }}>
            Mis Eventos ({events.length})
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400 py-8">Cargando...</p>
        ) : events.length === 0 ? (
          <div className="border border-dashed border-zinc-200 py-16 text-center">
            <p className="text-sm text-zinc-400 mb-4">No has creado ningún evento todavía.</p>
            <a href="/events/create" className="text-xs font-bold tracking-widest uppercase text-white px-5 py-2.5 transition-colors"
              style={{ background: '#C0001E' }}>
              Crear primer evento
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => {
              const pending = pendingCounts[ev.id] ?? 0;
              const isOpen = selectedEventId === ev.id;

              return (
                <div key={ev.id} className="border border-zinc-200">
                  {/* Event row */}
                  <div className="flex items-start gap-4 p-4 sm:p-5">
                    {/* Flyer thumbnail */}
                    <div className="flex-shrink-0 w-12 h-12 bg-zinc-100 overflow-hidden">
                      {ev.flyer_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ev.flyer_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-zinc-900">{ev.event_name}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 flex-shrink-0 ${STATUS_COLORS[ev.status]}`}>
                          {ev.status}
                        </span>
                        {pending > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 bg-[#C0001E] text-white flex-shrink-0">
                            {pending} pendiente{pending !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: '#5A5A5A' }}>
                        {formatDate(ev.event_date)}{ev.city ? ` · ${ev.city}` : ''}
                      </p>
                      {(ev.disciplines_needed ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(ev.disciplines_needed ?? []).map((d) => (
                            <span key={d} className="text-xs font-bold px-2 py-0.5 uppercase tracking-wide bg-zinc-900 text-white">{d}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <a href={`/events/${ev.id}`}
                        className="text-xs font-medium text-zinc-500 border border-zinc-200 px-3 py-1.5 hover:bg-zinc-50 transition-colors">
                        Editar
                      </a>
                      <button onClick={() => loadApplications(ev.id)}
                        className={`text-xs font-bold tracking-wide uppercase px-3 py-1.5 border transition-colors ${
                          isOpen ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                        }`}>
                        Solicitudes
                      </button>
                      <button onClick={() => loadRegistrations(ev.id)}
                        className={`text-xs font-bold tracking-wide uppercase px-3 py-1.5 border transition-colors ${
                          selectedRegEventId === ev.id ? 'bg-zinc-900 text-white border-zinc-900' : 'text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                        }`}>
                        Pagos
                      </button>
                    </div>
                  </div>

                  {/* Applications panel */}
                  {isOpen && (
                    <div className="border-t border-zinc-100 bg-zinc-50 px-4 sm:px-5 py-4">
                      <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#5A5A5A' }}>
                        Solicitudes para este evento
                      </p>
                      {appsLoading ? (
                        <p className="text-sm text-zinc-400">Cargando...</p>
                      ) : applications.length === 0 ? (
                        <p className="text-sm text-zinc-400">No hay solicitudes para este evento aún.</p>
                      ) : (
                        <div className="space-y-3">
                          {applications.map((app) => {
                            const s = APP_STATUS_LABELS[app.status] ?? { label: app.status, cls: 'bg-zinc-100 text-zinc-500' };
                            const f = app.fighters;
                            return (
                              <div key={app.id} className="bg-white border border-zinc-200 p-4">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div>
                                    <p className="text-sm font-bold text-zinc-900">{f?.profiles?.full_name ?? '—'}</p>
                                    <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>
                                      {f?.weight_class ?? '—'} · {f?.profiles?.city ?? '—'}
                                    </p>
                                    {f?.disciplines && f.disciplines.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {f.disciplines.map((d) => (
                                          <span key={d} className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-600 uppercase tracking-wide">{d}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-1 flex-shrink-0 ${s.cls}`}>{s.label}</span>
                                </div>
                                {app.message && (
                                  <p className="text-xs text-zinc-600 bg-zinc-50 px-3 py-2 mb-3 italic border border-zinc-100">
                                    &ldquo;{app.message}&rdquo;
                                  </p>
                                )}
                                {app.status === 'pending' && (
                                  <div className="flex gap-2 justify-end">
                                    <button onClick={() => handleAppStatus(app.id, 'declined')} disabled={updatingApp === app.id}
                                      className="px-3 py-1.5 text-xs font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
                                      Rechazar
                                    </button>
                                    <button onClick={() => handleAppStatus(app.id, 'accepted')} disabled={updatingApp === app.id}
                                      className="px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 transition-colors"
                                      style={{ background: '#C0001E' }}>
                                      {updatingApp === app.id ? '...' : 'Aceptar'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Registrations / Payment panel */}
                  {selectedRegEventId === ev.id && (
                    <div className="border-t border-zinc-100 bg-zinc-50 px-4 sm:px-5 py-4">
                      <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#5A5A5A' }}>
                        Registro y Pagos
                      </p>
                      {regsLoading ? (
                        <p className="text-sm text-zinc-400">Cargando...</p>
                      ) : registrations.length === 0 ? (
                        <p className="text-sm text-zinc-400">Ningún peleador se ha registrado para este evento aún.</p>
                      ) : (
                        <div className="space-y-6">
                          {/* Section 1: Pending */}
                          {registrations.filter(r => r.payment_status === 'pending').length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2">
                                Pendientes ({registrations.filter(r => r.payment_status === 'pending').length})
                              </p>
                              <div className="space-y-2">
                                {registrations.filter(r => r.payment_status === 'pending').map((reg) => (
                                  <div key={reg.id} className="bg-white border border-zinc-200 p-3 flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-bold text-zinc-900">{reg.fighters?.profiles?.full_name ?? '—'}</p>
                                      <p className="text-xs text-zinc-500">{reg.fighters?.weight_class ?? '—'} · {reg.fighters?.profiles?.city ?? '—'}</p>
                                    </div>
                                    <span className="text-xs font-bold px-2 py-1 bg-amber-50 text-amber-700 flex-shrink-0">PENDIENTE</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Section 2: Awaiting Confirmation (submitted) */}
                          {registrations.filter(r => r.payment_status === 'submitted').length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-blue-700 mb-2">
                                Esperando Confirmación ({registrations.filter(r => r.payment_status === 'submitted').length})
                              </p>
                              <div className="space-y-2">
                                {registrations.filter(r => r.payment_status === 'submitted').map((reg) => (
                                  <div key={reg.id} className="bg-white border border-blue-200 p-3 flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-bold text-zinc-900">{reg.fighters?.profiles?.full_name ?? '—'}</p>
                                      <p className="text-xs text-zinc-500">{reg.fighters?.weight_class ?? '—'} · {reg.fighters?.profiles?.city ?? '—'}</p>
                                      {reg.submitted_at && (
                                        <p className="text-xs text-blue-500 mt-0.5">
                                          Enviado: {new Date(reg.submitted_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleConfirmPayment(reg.id)}
                                      disabled={confirmingReg === reg.id}
                                      className="px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 transition-colors flex-shrink-0"
                                      style={{ background: '#C0001E' }}
                                    >
                                      {confirmingReg === reg.id ? '...' : 'Confirmar Pago'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Section 3: Paid (confirmed) */}
                          {registrations.filter(r => r.payment_status === 'confirmed').length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
                                Pagados ({registrations.filter(r => r.payment_status === 'confirmed').length})
                              </p>
                              <div className="space-y-2">
                                {registrations.filter(r => r.payment_status === 'confirmed').map((reg) => (
                                  <div key={reg.id} className="bg-white border border-emerald-200 p-3 flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-bold text-zinc-900">{reg.fighters?.profiles?.full_name ?? '—'}</p>
                                      <p className="text-xs text-zinc-500">{reg.fighters?.weight_class ?? '—'} · {reg.fighters?.profiles?.city ?? '—'}</p>
                                      {reg.confirmed_at && (
                                        <p className="text-xs text-emerald-500 mt-0.5">
                                          Confirmado: {new Date(reg.confirmed_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      )}
                                    </div>
                                    <span className="text-xs font-bold px-2 py-1 bg-emerald-50 text-emerald-700 flex-shrink-0">PAGADO</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Manual fighters (roster) ── */}
        {profile && (
          <div className="mt-12 border-t border-zinc-100 pt-8">
            <ManualFighterManager
              creatorId={profile.id}
              sectionLabel="Mi Roster"
              description="Peleadores que no tienen cuenta en la plataforma. Se mostrarán públicamente con la etiqueta Roster; cualquier solicitud de pelea llegará a ti dentro de la app."
            />
          </div>
        )}
      </main>

      {/* ── DEV ONLY: Test Panel — REMOVE BEFORE PRODUCTION ── */}
      {isDev && (
        <div className="border-t-4 border-amber-400 bg-amber-50 px-4 sm:px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold tracking-widest uppercase text-amber-700 bg-amber-200 px-2 py-1">DEV ONLY</span>
              <p className="text-sm font-bold text-amber-900">Testing & Validation Panel</p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={async () => {
                  setSeedRunning(true);
                  setSeedLog([]);
                  const res = await seedTestData();
                  setSeedLog(res.log);
                  setSeedRunning(false);
                }}
                disabled={seedRunning}
                className="px-4 py-2 text-xs font-bold tracking-wide uppercase text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {seedRunning ? 'Seeding...' : 'Seed Test Data'}
              </button>

              <button
                onClick={async () => {
                  setTestRunning(true);
                  setTestResult(null);
                  const res = await runTestFlow();
                  setTestResult(res);
                  setTestRunning(false);
                }}
                disabled={testRunning}
                className="px-4 py-2 text-xs font-bold tracking-wide uppercase text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {testRunning ? 'Running...' : 'Run Test Flow'}
              </button>

              <button
                onClick={async () => {
                  const res = await resetTestSubscription();
                  if (res.success) {
                    setTestResult(null);
                    alert('Subscription reset. You can run the test again.');
                  } else {
                    alert(`Reset failed: ${res.error}`);
                  }
                }}
                className="px-4 py-2 text-xs font-bold tracking-wide uppercase text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors"
              >
                Reset Subscription
              </button>
            </div>

            {/* Seed log */}
            {seedLog.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold uppercase text-amber-700 mb-2">Seed Log</p>
                <div className="bg-white border border-amber-200 p-3 max-h-48 overflow-y-auto font-mono text-xs text-zinc-700 space-y-0.5">
                  {seedLog.map((line, i) => (
                    <p key={i} className={line.includes('ERROR') ? 'text-red-600 font-bold' : ''}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Test results */}
            {testResult && (
              <div className="bg-white border border-amber-200 p-4">
                <p className="text-xs font-bold uppercase text-amber-700 mb-3">Test Flow Results</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <ResultBadge label="1st Request" value={testResult.first_request} pass={testResult.first_request === 'success'} />
                  <ResultBadge label="2nd Request" value={testResult.second_request} pass={testResult.second_request === 'blocked'} />
                  <ResultBadge label="Paywall" value={testResult.paywall_triggered ? 'triggered' : 'not triggered'} pass={testResult.paywall_triggered} />
                  <ResultBadge label="Fighter Blocked" value={testResult.fighter_blocked ? 'yes' : 'no'} pass={testResult.fighter_blocked} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-xs">
                    <span className="font-bold text-zinc-500">free_request_used before:</span>{' '}
                    <span className="font-mono">{String(testResult.free_request_used_before)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-zinc-500">free_request_used after:</span>{' '}
                    <span className="font-mono">{String(testResult.free_request_used_after)}</span>
                  </div>
                </div>

                {testResult.errors.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-bold text-red-600 mb-1">Errors:</p>
                    {testResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600 font-mono">{e}</p>
                    ))}
                  </div>
                )}

                <details className="mt-2">
                  <summary className="text-xs font-bold text-amber-700 cursor-pointer">Full Log ({testResult.log.length} entries)</summary>
                  <div className="mt-2 bg-zinc-50 border border-zinc-200 p-3 max-h-48 overflow-y-auto font-mono text-xs text-zinc-600 space-y-0.5">
                    {testResult.log.map((line, i) => (
                      <p key={i} className={line.includes('FAIL') || line.includes('ERROR') ? 'text-red-600 font-bold' : line.includes('PASS') ? 'text-emerald-600 font-bold' : ''}>{line}</p>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

/* ── DEV ONLY: Result badge component — REMOVE BEFORE PRODUCTION ── */
function ResultBadge({ label, value, pass }: { label: string; value: string; pass: boolean }) {
  return (
    <div className={`border p-3 text-center ${pass ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
      <p className="text-xs font-bold uppercase text-zinc-500 mb-1">{label}</p>
      <p className={`text-sm font-bold ${pass ? 'text-emerald-700' : 'text-red-700'}`}>{value}</p>
    </div>
  );
}
