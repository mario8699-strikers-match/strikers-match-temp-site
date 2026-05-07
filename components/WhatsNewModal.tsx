'use client';

import { useEffect, useState } from 'react';
import { authService } from '@/services/authService';

/**
 * Bump the version suffix every time you change HIGHLIGHTS so previously
 * dismissed users see the new announcement once.
 */
const WHATS_NEW_KEY = 'sm_whats_new_v3';

const HIGHLIGHTS: { title: string; body: string }[] = [
  {
    title: 'Foto de perfil y logo de promotora',
    body: 'Promotores y managers ya pueden subir su foto de perfil o logo de la empresa. Aparece en el directorio público y en tus eventos.',
  },
  {
    title: 'Publicar eventos gratis',
    body: 'Promotores y managers pueden crear y publicar carteleras ilimitadas. Sin tarjeta, sin cuotas.',
  },
  {
    title: 'Aceptación de peleas en 2 lados',
    body: 'Los peleadores ahora aceptan o rechazan cada propuesta antes de quedar agendados. Menos no-shows, más certeza.',
  },
  {
    title: 'Confiabilidad de peleadores',
    body: 'Cada perfil muestra su nivel de confiabilidad. Los nuevos aparecen como “Atleta Nuevo” hasta acumular historial real (3+ peleas).',
  },
  {
    title: 'Panel de estadísticas (Pro)',
    body: 'Mide tasa de aceptación, riesgos de no-show y peleadores confiables desde tu cuenta promoter o manager con plan Pro.',
  },
  {
    title: 'Confirmación de pagos del evento',
    body: 'Flujo claro para que peleadores confirmen su pago externo (transferencia, efectivo) y queden agendados.',
  },
  {
    title: 'Directorio de profesionales protegido',
    body: 'Los datos de contacto de cutmen, fotógrafos y médicos solo se muestran a usuarios con sesión iniciada.',
  },
  {
    title: 'Interfaz 100% en español',
    body: 'Toda la plataforma está localizada para audiencia mexicana, incluyendo etiquetas de confiabilidad y estadísticas.',
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
      // Show to any signed-in user; the highlights cover platform-wide updates
      // that affect promoters, managers, fighters, sponsors, and vendors.
      if (!role) return;
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
            Mejoras recientes en toda la plataforma: peleas, pagos, confiabilidad y estadísticas.
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
            href="/pricing"
            onClick={dismiss}
            className="text-xs sm:text-sm text-center text-zinc-600 hover:text-zinc-900 underline px-2 py-2"
          >
            Ver planes y precios
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
