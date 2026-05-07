'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
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

export default function ProfessionalsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available'>('all');
  const [search, setSearch] = useState('');

  const loadAll = useCallback(() => {
    setLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .in('role', VENDOR_ROLES)
      .eq('is_banned', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProfiles((data as Profile[]) ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime: refresh when any vendor profile availability flips
  useEffect(() => {
    const channel = supabase
      .channel('professionals-list-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          if (updated && VENDOR_ROLES.includes(updated.role as typeof VENDOR_ROLES[number])) {
            loadAll();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const visible = useMemo(() => {
    let list = profiles;
    if (filter === 'available') list = list.filter((p) => p.is_available);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          (p.city ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, filter, search]);

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="professionals" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Title + filters */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>Strikers Match</p>
            <h1 className="font-display font-black uppercase leading-none" style={{ fontSize: 'clamp(2.5rem,6vw,4.5rem)', letterSpacing: '-0.02em', color: '#0A0A0A' }}>
              Servicios de Eventos
            </h1>
            <p className="mt-2 text-sm" style={{ color: '#5A5A5A' }}>
              Fotógrafos, cutmen, jueces, catering, venues y más profesionales detrás de un evento de combate.
            </p>
          </div>
          <div className="flex gap-0 border border-zinc-200 overflow-hidden">
            {(['all', 'available'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${
                  filter === f
                    ? 'bg-[#0A0A0A] text-white'
                    : 'bg-white text-[#5A5A5A] hover:bg-zinc-50'
                }`}
              >
                {f === 'all' ? 'Todos' : 'Disponibles'}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o ciudad..."
            className="w-full sm:max-w-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
          />
        </div>

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">Cargando...</div>
        ) : visible.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-500 text-sm">No hay profesionales registrados todavía.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((p) => {
              const mailHref = `mailto:${p.email}`;
              return (
                <div
                  key={p.id}
                  className="border border-zinc-200 bg-white p-6 hover:border-[#C0001E] transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex items-center gap-3">
                    {p.photo_url ? (
                      <div className="w-12 h-12 overflow-hidden bg-zinc-100 shrink-0">
                        <Image
                          src={p.photo_url}
                          alt={p.full_name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-zinc-900 text-white font-bold flex items-center justify-center text-sm shrink-0">
                        {initials(p.full_name)}
                      </div>
                    )}
                      <div>
                        <h2 className="font-display font-black uppercase leading-none text-xl group-hover:text-[#C0001E] transition-colors" style={{ color: '#0A0A0A' }}>
                          {p.full_name}
                        </h2>
                        <p className="text-xs mt-1" style={{ color: '#9A9A9A' }}>{p.city ?? '—'}</p>
                      </div>
                    </div>
                    {p.is_available && (
                      <span
                        aria-label="Disponible"
                        title="Disponible"
                        className="mt-1 w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"
                      />
                    )}
                  </div>

                  {/* Role badge */}
                  <div className="mb-3">
                    <span className="inline-flex items-center text-xs font-bold uppercase tracking-widest px-2 py-1 bg-zinc-100 text-zinc-700">
                      {ROLE_LABELS[p.role] ?? p.role}
                    </span>
                  </div>

                  {/* Bio */}
                  {p.bio && (
                    <p className="text-sm text-zinc-600 mb-4 line-clamp-3">{p.bio}</p>
                  )}

                  {/* Meta + contact */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100">
                    {p.instagram ? (
                      <a
                        href={`https://instagram.com/${p.instagram.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-500 hover:text-zinc-900"
                      >
                        {p.instagram.startsWith('@') ? p.instagram : `@${p.instagram}`}
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-300">—</span>
                    )}
                    <a
                      href={mailHref}
                      className="text-xs font-bold uppercase tracking-widest bg-[#0A0A0A] text-white px-3 py-1.5 hover:bg-[#C0001E] transition-colors"
                    >
                      Contactar
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
