'use client';

import { useEffect, useRef, useState } from 'react';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabaseClient';

/**
 * Auto-logout after inactivity.
 *
 * Behavior:
 *   - Tracks user activity (mouse, keyboard, touch, scroll).
 *   - After IDLE_MS with no activity, shows a warning modal with a
 *     countdown of WARN_MS seconds.
 *   - If no response within the warning, signs out and redirects to /login.
 *   - Syncs last-activity across tabs via localStorage.
 *   - No-op when there is no authenticated session.
 */

const IDLE_MS = 30 * 60 * 1000;   // 30 minutes of inactivity before warning
const WARN_MS = 60 * 1000;        // 60 seconds to respond before logout
const STORAGE_KEY = 'sm:lastActivity';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
];

export function IdleTimeout() {
  const [authed, setAuthed] = useState(false);
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARN_MS / 1000));

  const lastActivityRef = useRef<number>(Date.now());
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Track auth state ──────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAuthed(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ── Activity tracking + idle check ────────────────────────────────
  useEffect(() => {
    if (!authed) {
      // Clean up any stale timers when signed out.
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setWarning(false);
      return;
    }

    const bump = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      try { localStorage.setItem(STORAGE_KEY, String(now)); } catch {}
      if (warning) {
        // User came back during the warning window — dismiss it.
        setWarning(false);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }
    };

    const syncFromStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const ts = parseInt(e.newValue, 10);
        if (!Number.isNaN(ts)) lastActivityRef.current = Math.max(lastActivityRef.current, ts);
      }
    };

    // Seed with any cross-tab timestamp so opening a new tab doesn't reset us.
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const ts = parseInt(stored, 10);
        if (!Number.isNaN(ts)) lastActivityRef.current = ts;
      } else {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
    } catch {}

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, bump, { passive: true }));
    window.addEventListener('storage', syncFromStorage);

    checkTimerRef.current = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_MS && !warning) {
        setWarning(true);
        setSecondsLeft(Math.floor(WARN_MS / 1000));
      }
    }, 15_000); // check every 15s — cheap

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, bump));
      window.removeEventListener('storage', syncFromStorage);
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    };
  }, [authed, warning]);

  // ── Countdown while warning is shown ──────────────────────────────
  useEffect(() => {
    if (!warning) return;
    const deadline = Date.now() + WARN_MS;
    countdownTimerRef.current = setInterval(() => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        void doLogout();
      } else {
        setSecondsLeft(Math.ceil(remainingMs / 1000));
      }
    }, 500);
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [warning]);

  const doLogout = async () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    await authService.logout();
    window.location.href = '/login?reason=timeout';
  };

  const stayLoggedIn = () => {
    const now = Date.now();
    lastActivityRef.current = now;
    try { localStorage.setItem(STORAGE_KEY, String(now)); } catch {}
    setWarning(false);
  };

  if (!authed || !warning) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md bg-white border border-zinc-200 shadow-xl">
        <div className="px-5 py-4 border-b border-zinc-200">
          <h2 id="idle-timeout-title" className="text-lg font-bold text-zinc-900">
            ¿Sigues ahí?
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-zinc-700">
            Por seguridad, cerraremos tu sesión automáticamente por inactividad en:
          </p>
          <p className="text-3xl font-bold text-[#C0001E] tabular-nums">
            {secondsLeft}s
          </p>
          <p className="text-xs text-zinc-500">
            Haz clic en “Seguir conectado” para continuar tu sesión.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-zinc-200 flex items-center justify-end gap-2">
          <button
            onClick={doLogout}
            className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-zinc-700 border border-zinc-300 hover:bg-zinc-50"
          >
            Cerrar sesión
          </button>
          <button
            onClick={stayLoggedIn}
            className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-white bg-[#C0001E] hover:bg-[#A00019]"
          >
            Seguir conectado
          </button>
        </div>
      </div>
    </div>
  );
}
