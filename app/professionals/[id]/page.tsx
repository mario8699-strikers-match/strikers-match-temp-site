'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { VENDOR_ROLES } from '@/types';
import type { Profile } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  ring_card_girl: 'Ring Card Girl',
  photographer: 'Fotógrafo',
  videographer: 'Videógrafo',
  broadcast_personality: 'Personalidad de Transmisión',
  catering_vendor: 'Catering / Alimentos',
  venue_rental: 'Renta de Venue',
  judge: 'Juez / Réferi',
  ring_rental: 'Renta de Ring',
  ring_announcer: 'Anunciador de Ring',
  cutman: 'Cutman',
  merchandise_vendor: 'Vendedor de Mercancía',
  ringside_doctor: 'Médico de Ringside',
  ringside_emt: 'Técnico Médico de Ringside',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '—';
}

export default function ProfessionalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [viewerRole, setViewerRole] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      authService.getSession(),
    ]).then(([{ data, error }, { data: session }]) => {
      if (cancelled) return;

      const p = data as Profile | null;
      const viewer = session?.profile ?? null;
      setIsLoggedIn(!!viewer);
      setViewerRole(viewer?.role ?? null);

      const isVendor =
        !!p &&
        (VENDOR_ROLES.includes(p.role) ||
          (p.additional_roles ?? []).some((r) => VENDOR_ROLES.includes(r)));

      // Admins bypass the ban filter; everyone else only sees active vendors.
      const allowed = isVendor && (viewer?.role === 'admin' || !p.is_banned);

      if (error || !p || !allowed) {
        setNotFound(true);
      } else {
        setVendor(p);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [id]);

  // Union of primary role + any additional vendor roles (deduped, primary first).
  const allRoles = vendor
    ? Array.from(new Set([vendor.role, ...(vendor.additional_roles ?? [])])).filter((r) =>
        VENDOR_ROLES.includes(r)
      )
    : [];

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="professionals" />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">Cargando...</div>
        ) : notFound || !vendor ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-500 text-sm">Perfil no encontrado o no disponible.</p>
            <Link
              href="/professionals"
              className="inline-block mt-4 text-xs font-bold uppercase tracking-widest text-[#C0001E] hover:underline"
            >
              ← Ver todos los profesionales
            </Link>
          </div>
        ) : (
          <>
            {/* Back link */}
            <Link
              href="/professionals"
              className="inline-block mb-6 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-[#C0001E]"
            >
              ← Profesionales
            </Link>

            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-6 items-start border-b border-zinc-200 pb-8 mb-8">
              {vendor.photo_url ? (
                <div className="w-32 h-32 overflow-hidden bg-zinc-100 shrink-0">
                  <Image
                    src={vendor.photo_url}
                    alt={vendor.full_name}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 bg-zinc-900 text-white font-bold flex items-center justify-center text-3xl shrink-0">
                  {initials(vendor.full_name)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>
                  Strikers Match
                </p>
                <h1
                  className="font-display font-black uppercase leading-none break-words"
                  style={{ fontSize: 'clamp(1.75rem,4vw,3rem)', letterSpacing: '-0.02em', color: '#0A0A0A' }}
                >
                  {vendor.full_name}
                </h1>
                <p className="mt-2 text-sm text-zinc-500">{vendor.city ?? 'Ubicación no especificada'}</p>

                {/* Role badges */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {allRoles.map((r, i) => (
                    <span
                      key={r}
                      className={`inline-flex items-center text-xs font-bold uppercase tracking-widest px-2 py-1 ${
                        i === 0 ? 'bg-zinc-100 text-zinc-700' : 'bg-white border border-zinc-200 text-zinc-600'
                      }`}
                    >
                      {i === 0 ? '' : '+ '}
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))}
                </div>

                {/* Availability pill */}
                <div className="mt-4">
                  {vendor.is_available ? (
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Disponible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-50 px-2.5 py-1">
                      <span className="w-2 h-2 rounded-full bg-zinc-300" />
                      No disponible actualmente
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bio */}
            {vendor.bio && (
              <section className="mb-8">
                <h2 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#C0001E' }}>
                  Acerca de
                </h2>
                <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed">{vendor.bio}</p>
              </section>
            )}

            {/* Contact — gated by login (admins always see) */}
            <section className="border-t border-zinc-200 pt-8">
              <h2 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C0001E' }}>
                Contacto
              </h2>

              {isLoggedIn ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Correo</dt>
                    <dd className="mt-1">
                      <a
                        href={`mailto:${vendor.email}`}
                        className="text-zinc-900 hover:text-[#C0001E] break-all"
                      >
                        {vendor.email}
                      </a>
                    </dd>
                  </div>
                  {vendor.phone && (
                    <div>
                      <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Teléfono</dt>
                      <dd className="mt-1">
                        <a
                          href={`tel:${vendor.phone}`}
                          className="text-zinc-900 hover:text-[#C0001E]"
                        >
                          {vendor.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {vendor.instagram && (
                    <div>
                      <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Instagram</dt>
                      <dd className="mt-1">
                        <a
                          href={`https://instagram.com/${vendor.instagram.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-900 hover:text-[#C0001E]"
                        >
                          {vendor.instagram.startsWith('@') ? vendor.instagram : `@${vendor.instagram}`}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-50 border border-dashed border-zinc-200 px-4 py-3 hover:bg-zinc-100 transition-colors"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Inicia sesión para ver la información de contacto
                </Link>
              )}

              {/* Primary CTA for logged-in non-admin viewers */}
              {isLoggedIn && viewerRole !== 'admin' && (
                <div className="mt-6">
                  <a
                    href={`mailto:${vendor.email}`}
                    className="inline-block text-xs font-bold uppercase tracking-widest bg-[#0A0A0A] text-white px-6 py-3 hover:bg-[#C0001E] transition-colors"
                  >
                    Contactar
                  </a>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
