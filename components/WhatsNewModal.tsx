'use client';

import { useEffect, useState } from 'react';
import { authService } from '@/services/authService';
import { VENDOR_ROLES } from '@/types';

/**
 * Bump the version suffix every time you change HIGHLIGHTS so previously
 * dismissed users see the new announcement once.
 */
const WHATS_NEW_KEY = 'sm_vendor_whats_new_v1';

const HIGHLIGHTS: { title: string; body: string }[] = [
  {
    title: 'Foto de perfil',
    body: 'Sube una foto y aparece en tu tarjeta del directorio público de Servicios.',
  },
  {
    title: 'Múltiples especialidades',
    body: 'Si ofreces más de un servicio (cutman + EMT, fotógrafo + videógrafo, etc.), añádelos en tu perfil.',
  },
  {
    title: 'Nuevos roles médicos',
    body: 'Médico de Ringside y Técnico Médico de Ringside ya están disponibles.',
  },
  {
    title: 'Directorio público',
    body: 'Tu perfil aparece en /professionals para que promotores te encuentren.',
  },
];

export function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(WHATS_NEW_KEY) === 'dismissed') return;

    let cancelled = false;
    authService.getSession().then(({ data }) => {
      if (cancelled) return;
      const role = data?.profile?.role;
      if (!role) return;
      if (!VENDOR_ROLES.includes(role as typeof VENDOR_ROLES[number])) return;
      setOpen(true);
    });

    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(WHATS_NEW_KEY, 'dismissed');
    } catch {
      // ignore (private mode, etc.)
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      <div
        className="bg-white w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0A0A0A] text-white px-5 sm:px-6 py-5 relative">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[#9A9A9A] hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: '#C0001E' }}>
            Strikers Match
          </p>
          <h2
            id="whats-new-title"
            className="font-display font-black uppercase mt-1 leading-none"
            style={{ fontSize: 'clamp(1.75rem,5vw,2.25rem)', letterSpacing: '-0.01em' }}
          >
            ¿Qué hay de nuevo?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#9A9A9A]">
            Mejoras recientes para profesionales y servicios.
          </p>
        </div>

        {/* Body */}
        <ul className="p-5 sm:p-6 space-y-4">
          {HIGHLIGHTS.map((h, i) => (
            <li key={h.title} className="flex gap-3 sm:gap-4 items-start">
              <span
                className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-[#C0001E] text-white font-display font-black text-xs sm:text-sm flex items-center justify-center"
                aria-hidden
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-zinc-900">{h.title}</h3>
                <p className="text-xs sm:text-sm text-zinc-600 mt-0.5 leading-relaxed">{h.body}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer actions */}
        <div className="border-t border-zinc-100 p-4 sm:p-5 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-between sm:items-center">
          <a
            href="/vendor/profile"
            onClick={dismiss}
            className="text-xs sm:text-sm text-center text-zinc-600 hover:text-zinc-900 underline px-2 py-2"
          >
            Editar mi perfil
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="w-full sm:w-auto text-xs font-bold uppercase tracking-widest bg-[#0A0A0A] text-white px-6 py-3 hover:bg-[#C0001E] transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
