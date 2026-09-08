'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoutGraphic } from '@/components/BoutGraphic';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import { getManagedEventDisplay, getPublicEventDisplay, INVALID_DISPLAY_TOKEN_ERROR } from '@/services/graphicsService';
import type { PublicEventDisplay } from '@/types';

export default function EventDisplayPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const [accessMode, setAccessMode] = useState<'initializing' | 'managed' | 'token' | 'denied'>('initializing');
  const [token, setToken] = useState('');
  const [overlay, setOverlay] = useState(false);
  const [display, setDisplay] = useState<PublicEventDisplay | null>(null);
  const displayRef = useRef<PublicEventDisplay | null>(null);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [connectionLost, setConnectionLost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const initialize = window.setTimeout(() => {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const legacyToken = fragment.get('token') ?? '';
      if (legacyToken) {
        setToken(legacyToken);
        setOverlay(fragment.get('mode') === 'overlay');
        setAccessMode('token');
        return;
      }

      Promise.all([authService.getSession(), eventService.getById(eventId)]).then(async ([sessionResult, eventResult]) => {
        if (!active) return;
        const profile = sessionResult.data?.profile ?? null;
        const event = eventResult.data ?? null;
        const allowed = (await canUseEventFeature(eventId, 'matchmaking', profile, event))
          || (await canUseEventFeature(eventId, 'production', profile, event));
        if (!active) return;
        if (!allowed) {
          setError('No tienes permiso para abrir la pantalla de este evento.');
          setAccessMode('denied');
          return;
        }
        setAccessMode('managed');
      }).catch(() => {
        if (!active) return;
        setError('No se pudo verificar el acceso a la pantalla del evento.');
        setAccessMode('denied');
      });
    }, 0);
    return () => { active = false; window.clearTimeout(initialize); };
  }, [eventId]);

  useEffect(() => {
    if (!overlay) return;
    const previous = document.body.style.background;
    document.body.style.background = 'transparent';
    return () => { document.body.style.background = previous; };
  }, [overlay]);

  const reload = useCallback(async () => {
    if (accessMode === 'initializing' || accessMode === 'denied') return;
    const result = accessMode === 'token'
      ? await getPublicEventDisplay(token)
      : await getManagedEventDisplay(eventId);
    if (result.error) {
      if (result.error === INVALID_DISPLAY_TOKEN_ERROR) {
        displayRef.current = null;
        setDisplay(null);
        setConnectionLost(false);
        setError(result.error);
        return;
      }
      if (!displayRef.current) setError(result.error);
      setConnectionLost(Boolean(displayRef.current));
      return;
    }
    displayRef.current = result.data;
    setDisplay(result.data);
    setError(null);
    setConnectionLost(false);
  }, [accessMode, eventId, token]);

  useEffect(() => {
    if (accessMode === 'initializing' || accessMode === 'denied' || (accessMode === 'token' && !token)) return;
    const initial = window.setTimeout(() => { void reload(); }, 0);
    if (accessMode === 'token') {
      const tokenTimer = window.setInterval(() => { void reload(); }, 2000);
      return () => { window.clearTimeout(initial); window.clearInterval(tokenTimer); };
    }

    const channel = supabase
      .channel(`managed-event-display:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_display_state', filter: `event_id=eq.${eventId}` }, () => { void reload(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bout_graphics', filter: `event_id=eq.${eventId}` }, () => { void reload(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_graphics_settings', filter: `event_id=eq.${eventId}` }, () => { void reload(); })
      .subscribe();
    const recoveryTimer = window.setInterval(() => { void reload(); }, 30_000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(recoveryTimer);
      void supabase.removeChannel(channel);
    };
  }, [accessMode, eventId, reload, token]);

  const isSequence = display?.state && 'mode' in display.state && display.state.mode === 'sequence';
  useEffect(() => {
    if (!isSequence || !display?.graphics.length) return;
    const timer = window.setInterval(() => setSequenceIndex((index) => (index + 1) % display.graphics.length), Math.max(3, display.displayDurationSeconds || 12) * 1000);
    return () => window.clearInterval(timer);
  }, [display?.displayDurationSeconds, display?.graphics.length, isSequence]);

  const activeGraphic = useMemo(() => {
    if (!display?.graphics.length || !display.state || !('is_live' in display.state) || !display.state.is_live) return null;
    if (display.state.mode === 'sequence') return display.graphics[sequenceIndex % display.graphics.length];
    return display.graphics.find((graphic) => graphic.id === display.state.active_graphic_id) ?? null;
  }, [display, sequenceIndex]);

  const returnHref = accessMode === 'managed' ? `/events/${eventId}/manage/graphics` : null;

  if (accessMode === 'initializing') return <Status message="Abriendo la pantalla del evento…" />;
  if (error) return <Status message={error} returnHref={returnHref} />;
  if (!display) return <Status message="Conectando con la cartelera…" returnHref={returnHref} />;
  if (!activeGraphic) return <div className={`relative flex min-h-screen items-center justify-center ${overlay ? 'bg-transparent' : 'bg-black text-white'}`}><ScreenReturn href={returnHref} /><p className="text-sm uppercase tracking-[0.2em] opacity-60">Pantalla en espera</p></div>;

  return <main className={`relative flex min-h-screen items-center justify-center overflow-hidden ${overlay ? 'bg-transparent' : 'bg-black'}`}>
    <ScreenReturn href={returnHref} />
    <BoutGraphic payload={activeGraphic.payload} variant={overlay ? 'overlay' : 'screen'} className="w-full" />
    {connectionLost && <span className="absolute right-2 top-2 rounded bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase text-black">Reconectando</span>}
  </main>;
}

function ScreenReturn({ href }: { href: string | null }) {
  if (!href) return null;
  return <Link href={href} className="fixed left-3 top-3 z-20 bg-black/70 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white opacity-50 transition-opacity hover:opacity-100 focus:opacity-100">← Volver a gráficos</Link>;
}

function Status({ message, returnHref = null }: { message: string; returnHref?: string | null }) { return <main className="relative flex min-h-screen items-center justify-center bg-black p-6 text-center text-sm font-bold uppercase tracking-widest text-white"><ScreenReturn href={returnHref} />{message}</main>; }
