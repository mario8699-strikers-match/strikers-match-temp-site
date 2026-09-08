'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { setEventDisplay } from '@/services/graphicsService';
import {
  advanceGuidedOnboarding,
  GUIDED_ONBOARDING_EVENT,
  updateGuidedOnboarding,
  type GuidedOnboardingStep,
} from '@/services/onboardingService';
import type { Profile } from '@/types';

const ONBOARDING_ACTIVE_KEY = 'sm_onboarding_active';
const ONBOARDING_SHOWN_SESSION_KEY = 'sm_onboarding_shown_session';

type Panel = 'welcome' | 'step' | 'help' | 'topic' | null;

interface HelpTopic {
  title: string;
  body: string;
  action: string;
  path: (eventId: string | null) => string;
}

const HELP_TOPICS: HelpTopic[] = [
  { title: 'Crear un evento', body: 'Crea el nombre, fecha, ciudad, recinto y disciplinas de tu nueva cartelera.', action: 'Crear evento', path: () => '/events/create' },
  { title: 'Registrar peleadores', body: 'Agrega perfiles de Strikers Match, peleadores de tu roster o altas rápidas exclusivas del evento.', action: 'Abrir participantes', path: (id) => id ? `/events/${id}/manage/participants` : '/events' },
  { title: 'Encontrar enfrentamientos', body: 'Revisa las combinaciones calculadas por peso, edad, experiencia, récord, disciplina y disponibilidad.', action: 'Abrir matchmaking', path: (id) => id ? `/events/${id}/manage/matchmaking` : '/events' },
  { title: 'Revisar peleas', body: 'Tú decides qué propuesta aceptar, rechazar, modificar o fijar antes de hacerla oficial.', action: 'Revisar propuestas', path: (id) => id ? `/events/${id}/manage/matchmaking` : '/events' },
  { title: 'Generar gráficos', body: 'Los combates oficiales generan borradores que puedes aprobar, publicar y descargar.', action: 'Abrir gráficos', path: (id) => id ? `/events/${id}/manage/graphics` : '/events' },
  { title: 'Mostrar peleas en pantalla', body: 'Publica un gráfico y abre el modo pantalla directamente dentro de Strikers Match.', action: 'Configurar pantalla', path: (id) => id ? `/events/${id}/manage/graphics` : '/events' },
];

function setOnboardingActive(active: boolean) {
  try {
    if (active) sessionStorage.setItem(ONBOARDING_ACTIVE_KEY, '1');
    else sessionStorage.removeItem(ONBOARDING_ACTIVE_KEY);
  } catch {
    // Continue without session storage in private browsing modes.
  }
  window.dispatchEvent(new Event('sm:onboarding-state'));
}

function validStep(value: number): value is GuidedOnboardingStep {
  return Number.isInteger(value) && value >= 1 && value <= 8;
}

export function GuidedOnboardingHelp() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [step, setStep] = useState<GuidedOnboardingStep>(1);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [participantReady, setParticipantReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authService.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const nextProfile = data?.profile ?? null;
      if (!nextProfile || !['promoter', 'manager'].includes(nextProfile.role)) return;

      const { data: ownedEvents, error: ownedEventsError } = await supabase
        .from('events')
        .select('id')
        .eq('promoter_id', nextProfile.id)
        .limit(1);
      if (cancelled) return;

      // The first-event guide cannot be permanently dismissed. Promoters and
      // managers may close it for the current visit, but it returns until an
      // event owned by their account exists.
      if (!ownedEventsError && (ownedEvents?.length ?? 0) === 0) {
        setProfile({
          ...nextProfile,
          onboarding_completed: false,
          onboarding_step: 0,
          onboarding_dismissed: false,
          onboarding_event_id: null,
        });
        setStep(1);
        setEventId(null);
        setDismissed(false);
        setPanel('welcome');
        try { sessionStorage.setItem(ONBOARDING_SHOWN_SESSION_KEY, '1'); } catch { /* noop */ }

        if (nextProfile.onboarding_completed || nextProfile.onboarding_step !== 0 || nextProfile.onboarding_dismissed) {
          void updateGuidedOnboarding({ step: 0, completed: false, dismissed: false });
        }
        return;
      }

      const savedStep = validStep(nextProfile.onboarding_step) ? nextProfile.onboarding_step : 1;
      setProfile(nextProfile);
      setStep(savedStep);
      setEventId(nextProfile.onboarding_event_id ?? null);
      setDismissed(Boolean(nextProfile.onboarding_dismissed));

      const requestedStep = Number(new URLSearchParams(window.location.search).get('guideStep'));
      if (!nextProfile.onboarding_completed && validStep(requestedStep)) {
        setStep(requestedStep);
        setPanel('step');
        return;
      }
      if (!nextProfile.onboarding_completed && !nextProfile.onboarding_dismissed && nextProfile.onboarding_step === 0) {
        setPanel('welcome');
        try { sessionStorage.setItem(ONBOARDING_SHOWN_SESSION_KEY, '1'); } catch { /* noop */ }
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setOnboardingActive(panel !== null);
    return () => setOnboardingActive(false);
  }, [panel]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ step: GuidedOnboardingStep; eventId?: string | null; open?: boolean }>).detail;
      if (!detail || !validStep(detail.step)) return;
      setStep(detail.step);
      if (detail.eventId) setEventId(detail.eventId);
      setDismissed(false);
      setProfile((current) => current ? {
        ...current,
        onboarding_step: detail.step,
        onboarding_event_id: detail.eventId ?? current.onboarding_event_id,
        onboarding_dismissed: false,
      } : current);
      if (detail.open !== false) setPanel('step');
    };
    window.addEventListener(GUIDED_ONBOARDING_EVENT, listener);
    return () => window.removeEventListener(GUIDED_ONBOARDING_EVENT, listener);
  }, []);

  const revealParticipantStep = useCallback(async (targetEventId: string) => {
    setParticipantReady(true);
    if (step === 3) {
      await advanceGuidedOnboarding(4, targetEventId, true);
    } else if (step === 4 && !dismissed) {
      setPanel('step');
    }
  }, [dismissed, step]);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    Promise.all([
      supabase.from('events').select('event_name').eq('id', eventId).maybeSingle(),
      supabase.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    ]).then(([eventResult, registrationResult]) => {
      if (!active) return;
      setEventName(eventResult.data?.event_name ?? null);
      if ((registrationResult.count ?? 0) > 0) void revealParticipantStep(eventId);
    });

    const channel = supabase
      .channel(`guided-onboarding:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_registrations', filter: `event_id=eq.${eventId}` }, () => {
        if (active) void revealParticipantStep(eventId);
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [eventId, revealParticipantStep]);

  const completedSteps = useMemo(
    () => profile?.onboarding_completed ? 8 : Math.max(0, step - 1),
    [profile?.onboarding_completed, step]
  );

  const start = async () => {
    setBusy(true); setError(null);
    const result = await advanceGuidedOnboarding(1, null, false);
    if (result.error) setError(result.error);
    else { setStep(1); setDismissed(false); setPanel('step'); }
    setBusy(false);
  };

  const dismiss = async () => {
    setBusy(true); setError(null);
    const result = await updateGuidedOnboarding({ dismissed: true });
    if (result.error) setError(result.error);
    else { setDismissed(true); setPanel(null); }
    setBusy(false);
  };

  const closePanel = () => { setPanel(null); setError(null); setCopied(false); };
  const go = (path: string) => { setPanel(null); window.location.href = path; };

  const continueGuide = async () => {
    const nextStep = profile?.onboarding_completed ? 1 : step;
    setBusy(true); setError(null);
    const result = profile?.onboarding_completed
      ? await updateGuidedOnboarding({ step: 1, completed: false, dismissed: false })
      : await advanceGuidedOnboarding(nextStep, eventId, true);
    if (!result.error) {
      setStep(nextStep);
      setDismissed(false);
      setProfile((current) => current ? {
        ...current,
        onboarding_completed: false,
        onboarding_step: nextStep,
        onboarding_dismissed: false,
      } : current);
      setPanel('step');
    } else setError(result.error);
    setBusy(false);
  };

  const shareRegistration = async (nativeShare: boolean) => {
    if (!eventId) { setError('Primero crea o selecciona un evento.'); return; }
    const url = `${window.location.origin}/events/${eventId}`;
    setBusy(true); setError(null);
    try {
      if (nativeShare && navigator.share) {
        await navigator.share({ title: eventName ?? 'Registro del evento', text: 'Regístrate para participar en este evento de Strikers Match.', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
      const result = await advanceGuidedOnboarding(4, eventId, false);
      if (result.error) setError(result.error);
      else { setStep(4); setPanel(null); }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setError('No se pudo compartir el enlace. Puedes copiarlo manualmente desde la página del evento.');
    } finally {
      setBusy(false);
    }
  };

  const openMatchmaking = async () => {
    if (!eventId || !participantReady) return;
    setBusy(true);
    const result = await advanceGuidedOnboarding(5, eventId, false);
    if (result.error) { setError(result.error); setBusy(false); return; }
    go(`/events/${eventId}/manage/matchmaking?guideStep=5`);
  };

  const openGraphics = async () => {
    if (!eventId) return;
    setBusy(true);
    const result = await advanceGuidedOnboarding(7, eventId, false);
    if (result.error) { setError(result.error); setBusy(false); return; }
    go(`/events/${eventId}/manage/graphics?guideStep=7`);
  };

  const openDisplay = async () => {
    if (!eventId) return;
    setBusy(true); setError(null);
    const displayResult = await setEventDisplay(eventId, null, 'sequence', true);
    if (displayResult.error) {
      setError(displayResult.error);
      setBusy(false);
      return;
    }
    const completed = await updateGuidedOnboarding({ step: 8, eventId, completed: true, dismissed: false });
    if (completed.error) {
      setError(completed.error);
      setBusy(false);
      return;
    }
    setProfile((current) => current ? { ...current, onboarding_completed: true, onboarding_step: 8, onboarding_dismissed: false } : current);
    setPanel(null);
    window.location.href = `/events/${eventId}/display`;
  };

  if (!profile || /^\/events\/[^/]+\/display$/.test(pathname)) return null;

  const topic = selectedTopic;
  return (
    <>
      <button type="button" onClick={() => { setPanel('help'); setError(null); }} className="fixed bottom-5 right-4 z-[85] min-h-11 bg-zinc-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl hover:bg-[#C0001E] print:hidden sm:bottom-6 sm:right-6" aria-label="Abrir ayuda">
        <span aria-hidden>?</span> Ayuda
      </button>
      {copied && <p role="status" className="fixed bottom-20 right-4 z-[86] bg-emerald-700 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-xl print:hidden sm:right-6">Enlace copiado</p>}

      {panel && (
        <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/60 print:hidden sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="guided-help-title">
          <div className="max-h-[95vh] w-full overflow-y-auto bg-white sm:max-w-xl">
            {panel === 'welcome' ? (
              <>
                <PanelHeader eyebrow="Strikers Match" title="Welcome to Strikers Match" onClose={dismiss} />
                <div className="p-5 sm:p-6"><p className="text-lg font-bold text-zinc-900">Vamos a configurar tu primer evento.</p><p className="mt-2 text-sm leading-relaxed text-zinc-600">Te guiaremos paso a paso. No necesitas conocimientos técnicos.</p>{error && <ErrorMessage value={error} />}</div>
                <div className="grid grid-cols-1 gap-2 border-t border-zinc-100 p-4 sm:grid-cols-2 sm:p-5"><button type="button" onClick={dismiss} disabled={busy} className="min-h-11 border border-zinc-300 px-4 text-xs font-bold uppercase text-zinc-700">Lo haré después</button><button type="button" onClick={start} disabled={busy} className="min-h-11 bg-[#C0001E] px-4 text-xs font-bold uppercase text-white">Comenzar</button></div>
              </>
            ) : panel === 'help' ? (
              <>
                <PanelHeader eyebrow="Ayuda contextual" title="¿Qué quieres hacer?" onClose={closePanel} />
                <div className="p-5 sm:p-6"><Progress completed={completedSteps} /><div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">{HELP_TOPICS.map((item) => <button key={item.title} type="button" onClick={() => { setSelectedTopic(item); setPanel('topic'); }} className="min-h-14 border border-zinc-200 p-3 text-left text-sm font-bold text-zinc-900 hover:border-[#C0001E] hover:text-[#C0001E]">{item.title}</button>)}</div>{error && <ErrorMessage value={error} />}<button type="button" onClick={continueGuide} disabled={busy} className="mt-5 min-h-11 w-full bg-zinc-950 px-4 text-xs font-bold uppercase tracking-widest text-white">{profile.onboarding_completed ? 'Recorrer guía completa' : dismissed ? 'Continuar guía pendiente' : 'Ver mi siguiente paso'}</button></div>
              </>
            ) : panel === 'topic' && topic ? (
              <>
                <PanelHeader eyebrow="Guía rápida" title={topic.title} onClose={() => setPanel('help')} />
                <div className="p-5 sm:p-6"><p className="text-sm leading-relaxed text-zinc-600">{topic.body}</p><button type="button" onClick={() => go(topic.path(eventId))} className="mt-5 min-h-11 w-full bg-[#C0001E] px-4 text-xs font-bold uppercase tracking-widest text-white">{topic.action}</button></div>
              </>
            ) : (
              <WizardStep step={step} eventId={eventId} eventName={eventName} participantReady={participantReady} busy={busy} copied={copied} error={error} onDismiss={dismiss} onGo={go} onShare={shareRegistration} onMatchmaking={openMatchmaking} onGraphics={openGraphics} onDisplay={openDisplay} onClose={closePanel} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function WizardStep({ step, eventId, eventName, participantReady, busy, copied, error, onDismiss, onGo, onShare, onMatchmaking, onGraphics, onDisplay, onClose }: {
  step: GuidedOnboardingStep; eventId: string | null; eventName: string | null; participantReady: boolean; busy: boolean; copied: boolean; error: string | null;
  onDismiss: () => void; onGo: (path: string) => void; onShare: (native: boolean) => void; onMatchmaking: () => void; onGraphics: () => void; onDisplay: () => void; onClose: () => void;
}) {
  const content = STEP_CONTENT[step];
  return <>
    <PanelHeader eyebrow={`Paso ${step} de 8`} title={content.title} onClose={onDismiss} />
    <div className="p-5 sm:p-6"><Progress completed={step - 1} /><p className="mt-5 text-sm leading-relaxed text-zinc-600">{content.body}</p>{eventName && step > 1 && <p className="mt-3 border-l-2 border-[#C0001E] pl-3 text-sm font-bold text-zinc-900">{eventName}</p>}{step === 3 && eventId && <p className="mt-4 break-all border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">{typeof window !== 'undefined' ? `${window.location.origin}/events/${eventId}` : `/events/${eventId}`}</p>}{step === 4 && !participantReady && <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">La guía continuará automáticamente cuando llegue el primer registro. También puedes agregar un peleador manualmente.</p>}{error && <ErrorMessage value={error} />}</div>
    <div className="border-t border-zinc-100 p-4 sm:p-5">
      {step === 1 && <PrimaryButton label="Crear mi evento" busy={busy} onClick={() => onGo('/events/create?onboarding=1')} />}
      {step === 2 && <PrimaryButton label="Configurar registro" busy={busy || !eventId} onClick={() => eventId && onGo(`/events/${eventId}/manage/settings`)} />}
      {step === 3 && <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onShare(false)} disabled={busy || !eventId} className="min-h-11 border border-zinc-300 px-3 text-xs font-bold uppercase">{copied ? 'Enlace copiado' : 'Copiar enlace'}</button><button type="button" onClick={() => onShare(true)} disabled={busy || !eventId} className="min-h-11 bg-[#C0001E] px-3 text-xs font-bold uppercase text-white">Compartir</button></div>}
      {step === 4 && <PrimaryButton label={participantReady ? 'Ver posibles enfrentamientos' : 'Esperando registros'} busy={busy || !participantReady} onClick={onMatchmaking} />}
      {step === 5 && <PrimaryButton label="Entendido, yo decido" busy={busy} onClick={onClose} />}
      {step === 6 && <PrimaryButton label="Continuar a gráficos" busy={busy || !eventId} onClick={onGraphics} />}
      {step === 7 && <PrimaryButton label="Ver gráficos" busy={busy || !eventId} onClick={() => eventId && onGo(`/events/${eventId}/manage/graphics`)} />}
      {step === 8 && <PrimaryButton label="Abrir modo pantalla" busy={busy || !eventId} onClick={onDisplay} />}
      <button type="button" onClick={onDismiss} disabled={busy} className="mt-2 min-h-10 w-full text-xs font-bold uppercase text-zinc-500 hover:text-zinc-900">Lo haré después</button>
    </div>
  </>;
}

const STEP_CONTENT: Record<GuidedOnboardingStep, { title: string; body: string }> = {
  1: { title: 'Primero vamos a crear tu evento.', body: 'Aquí ingresarás el nombre, fecha, lugar y tipo de evento.' },
  2: { title: 'Ahora configura el registro de peleadores.', body: 'Selecciona las categorías, pesos y disciplinas que estarán disponibles.' },
  3: { title: 'Tu evento ya tiene un enlace de registro.', body: 'Comparte este enlace con tus peleadores, managers y gimnasios. Cuando alguien se registre, aparecerá automáticamente en tu lista de participantes.' },
  4: { title: 'Aquí comienza el matchmaking.', body: 'Strikers Match analizará los peleadores registrados y te mostrará posibles enfrentamientos.' },
  5: { title: 'Tú tienes la última palabra.', body: 'Revisa cada enfrentamiento y decide si quieres aprobarlo, rechazarlo o modificarlo. El sistema nunca hace oficial una pelea sin tu decisión.' },
  6: { title: 'Tu pelea ya es oficial.', body: 'Una vez aprobada, Strikers Match genera automáticamente la información y los gráficos correspondientes.' },
  7: { title: 'Tus gráficos están listos.', body: 'Puedes utilizarlos en redes sociales, pantallas, proyectores y material promocional.' },
  8: { title: '¿Listo para el evento?', body: 'Abre el modo pantalla para mostrar automáticamente los enfrentamientos durante tu evento.' },
};

function Progress({ completed }: { completed: number }) {
  return <div aria-label={`${completed} de 8 pasos completados`}><div className="flex items-center gap-1">{Array.from({ length: 8 }, (_, index) => <span key={index} className={`h-2 flex-1 ${index < completed ? 'bg-[#C0001E]' : 'bg-zinc-200'}`} />)}</div><p className="mt-2 text-xs font-bold uppercase tracking-widest text-zinc-500">{completed} de 8 pasos completados</p></div>;
}

function PanelHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return <header className="relative bg-zinc-950 px-5 py-5 pr-16 text-white sm:px-6"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C0001E]">{eyebrow}</p><h2 id="guided-help-title" className="mt-1 font-display text-3xl font-black uppercase leading-none">{title}</h2><button type="button" onClick={onClose} aria-label="Cerrar guía" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center border border-zinc-700 text-xl text-zinc-300 hover:border-zinc-400 hover:text-white">×</button></header>;
}

function PrimaryButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return <button type="button" disabled={busy} onClick={onClick} className="min-h-11 w-full bg-[#C0001E] px-4 text-xs font-bold uppercase tracking-widest text-white disabled:bg-zinc-300">{busy ? 'Espera…' : label}</button>;
}

function ErrorMessage({ value }: { value: string }) { return <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{value}</p>; }
