'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import { fighterService } from '@/services/fighterService';
import { manualFighterService } from '@/services/manualFighterService';
import { supabase } from '@/lib/supabaseClient';
import type { FighterWithProfile, ManualFighterWithCreator } from '@/types';

const WEIGHT_CLASSES = [
  'minimosca', 'mosca', 'supermosca', 'gallo', 'supergallo',
  'pluma', 'superpluma', 'ligero', 'superligero', 'welter',
  'superwelter', 'medio', 'supermedio', 'semipesado', 'crucero', 'pesado',
];

const WEIGHT_LABELS: Record<string, string> = {
  minimosca: 'Minimosca', mosca: 'Mosca', supermosca: 'Supermosca',
  gallo: 'Gallo', supergallo: 'Supergallo', pluma: 'Pluma',
  superpluma: 'Superpluma', ligero: 'Ligero', superligero: 'Superligero',
  welter: 'Welter', superwelter: 'Superwelter', medio: 'Medio',
  supermedio: 'Supermedio', semipesado: 'Semipesado', crucero: 'Crucero', pesado: 'Pesado',
};

const PAGE_SIZE = 12;
const ROSTER_PAGE_SIZE = 12;

export default function SearchPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── Filter state ──────────────────────────
  const [weightClass, setWeightClass] = useState('');
  const [city, setCity] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [shortNotice, setShortNotice] = useState(false);
  const [available, setAvailable] = useState(false);
  const [page, setPage] = useState(1);
  const [rosterPage, setRosterPage] = useState(1);

  // ── Debounce city input (400ms) ───────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCityChange = useCallback((value: string) => {
    setCity(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedCity(value);
      setPage(1);
    }, 400);
  }, []);

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── React Query for fighter search ────────
  const filters = {
    weight_class: weightClass || undefined,
    city: debouncedCity || undefined,
    short_notice_ready: shortNotice || undefined,
    is_available: available || undefined,
    page,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['fighters', filters],
    queryFn: async () => {
      const { data: result, error } = await fighterService.search(filters);
      if (error) throw new Error(error);
      return result!;
    },
    placeholderData: (previousData) => previousData,
  });

  // Manual fighters (roster) — fetched once, filtered client-side
  const { data: manualAll } = useQuery({
    queryKey: ['manual-fighters-public'],
    queryFn: async () => {
      const { data: result, error } = await manualFighterService.getAllPublic();
      if (error) throw new Error(error);
      return (result ?? []) as ManualFighterWithCreator[];
    },
  });

  const manualFighters = useMemo(
    () =>
      (manualAll ?? []).filter((m) => {
        if (weightClass && m.weight_class !== weightClass) return false;
        if (debouncedCity && !(m.city ?? '').toLowerCase().includes(debouncedCity.toLowerCase())) return false;
        if (available && !m.is_available) return false;
        // short_notice_ready not tracked on manual fighters — exclude when set
        if (shortNotice) return false;
        return true;
      }),
    [manualAll, weightClass, debouncedCity, available, shortNotice]
  );

  const rosterTotalPages = Math.ceil(manualFighters.length / ROSTER_PAGE_SIZE);
  const pageRoster = useMemo(
    () => manualFighters.slice((rosterPage - 1) * ROSTER_PAGE_SIZE, rosterPage * ROSTER_PAGE_SIZE),
    [manualFighters, rosterPage]
  );

  // Reset roster page when filters change
  useEffect(() => {
    setRosterPage(1);
  }, [weightClass, debouncedCity, available, shortNotice]);

  const fighters = (data?.fighters ?? []) as (FighterWithProfile & { profiles: { full_name: string; city: string | null } })[];
  const total = data?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Reset page on filter change ───────────
  useEffect(() => {
    setPage(1);
  }, [weightClass, shortNotice, available]);

  // ── Supabase Realtime: refresh on fighter availability changes ──
  useEffect(() => {
    const channel = supabase
      .channel('fighters-search-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fighters' },
        (payload) => {
          const old = payload.old as Record<string, unknown>;
          const updated = payload.new as Record<string, unknown>;
          // Only refetch when availability-related fields change
          if (
            old.is_available !== updated.is_available ||
            old.short_notice_ready !== updated.short_notice_ready ||
            old.weight_class !== updated.weight_class
          ) {
            queryClient.invalidateQueries({ queryKey: ['fighters'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ── Handlers ──────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedCity(city);
    setPage(1);
  };

  const handlePage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">

        {/* Title */}
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#C0001E' }}>
            Directorio
          </p>
          <h1 className="text-3xl font-black uppercase" style={{ letterSpacing: '-1px' }}>
            Buscar Peleadores
          </h1>
          <p className="text-sm mt-1" style={{ color: '#5A5A5A' }}>
            Filtra por division, ciudad, disponibilidad o aviso corto.
          </p>
        </div>

        {/* Filters */}
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Weight class */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>
              Division
            </label>
            <select
              value={weightClass}
              onChange={(e) => setWeightClass(e.target.value)}
              className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">Todas las divisiones</option>
              {WEIGHT_CLASSES.map((wc) => (
                <option key={wc} value={wc}>{WEIGHT_LABELS[wc]}</option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>
              Ciudad
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              placeholder="Ej. Monterrey"
              className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3 justify-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
                className="w-4 h-4 accent-[#C0001E]"
              />
              <span className="text-sm font-medium text-zinc-700">Solo disponibles</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shortNotice}
                onChange={(e) => setShortNotice(e.target.checked)}
                className="w-4 h-4 accent-[#C0001E]"
              />
              <span className="text-sm font-medium text-zinc-700">Aviso corto</span>
            </label>
          </div>

          {/* Submit */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 text-sm font-bold tracking-widest uppercase text-white transition-colors"
              style={{ background: '#C0001E' }}
              onMouseOver={e => (e.currentTarget.style.background = '#9A0018')}
              onMouseOut={e => (e.currentTarget.style.background = '#C0001E')}
            >
              Buscar
            </button>
          </div>
        </form>

        {/* Results count */}
        {!isLoading && (
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#9A9A9A' }}>
              {total} peleador{total !== 1 ? 'es' : ''} encontrado{total !== 1 ? 's' : ''}
            </p>
            {isFetching && (
              <span className="text-xs text-zinc-400 animate-pulse">Actualizando...</span>
            )}
          </div>
        )}

        {/* Cards */}
        {isLoading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">Buscando...</div>
        ) : fighters.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-500 text-sm">No se encontraron peleadores con esos filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {fighters.map((fighter) => (
              <div
                key={fighter.id}
                onClick={() => router.push(`/fighters/${fighter.id}`)}
                className="border border-zinc-200 bg-white hover:border-zinc-400 transition-colors cursor-pointer"
              >
                {/* Photo */}
                <div className="w-full h-40 bg-zinc-100 overflow-hidden">
                  {fighter.photo_url ? (
                    <Image
                      src={fighter.photo_url}
                      alt={fighter.profiles?.full_name ?? ''}
                      width={300}
                      height={160}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {/* Name + verified */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900 leading-tight">
                        {fighter.profiles?.full_name ?? '\u2014'}
                      </h2>
                      <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>
                        {fighter.profiles?.city ?? '\u2014'}
                      </p>
                    </div>
                    {fighter.verified && (
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Record */}
                  <div className="grid grid-cols-3 gap-1 text-center mb-3">
                    {[
                      { label: 'V', value: fighter.record_wins },
                      { label: 'D', value: fighter.record_losses },
                      { label: 'E', value: fighter.record_draws },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-zinc-50 py-1">
                        <p className="text-base font-black text-zinc-900">{value}</p>
                        <p className="text-xs" style={{ color: '#9A9A9A' }}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {fighter.weight_class && (
                      <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5">
                        {WEIGHT_LABELS[fighter.weight_class] ?? fighter.weight_class}
                      </span>
                    )}
                    {fighter.is_available && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5">Disponible</span>
                    )}
                    {fighter.short_notice_ready && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5">Aviso corto</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <Pagination page={page} totalPages={totalPages} onPageChange={handlePage} />

        {/* Roster (manual fighters added by managers/promoters) */}
        {manualFighters.length > 0 && (
          <section className="mt-16">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-black uppercase tracking-widest" style={{ color: '#0A0A0A' }}>Roster</h2>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5">Sin cuenta</span>
              <p className="text-xs" style={{ color: '#9A9A9A' }}>
                {manualFighters.length} peleador{manualFighters.length !== 1 ? 'es' : ''} gestionado{manualFighters.length !== 1 ? 's' : ''} por manager/promotor
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {pageRoster.map((mf) => (
                <div
                  key={mf.id}
                  onClick={() => router.push(`/fighters/manual/${mf.id}`)}
                  className="border border-zinc-200 bg-white hover:border-zinc-400 transition-colors cursor-pointer"
                >
                  <div className="w-full h-40 bg-zinc-100 overflow-hidden">
                    {mf.photo_url ? (
                      <Image
                        src={mf.photo_url}
                        alt={mf.full_name}
                        width={300}
                        height={160}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 leading-tight">{mf.full_name}</h3>
                        <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>{mf.city ?? '\u2014'}</p>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 flex-shrink-0">Roster</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center mb-3">
                      {[
                        { label: 'V', value: mf.record_wins },
                        { label: 'D', value: mf.record_losses },
                        { label: 'E', value: mf.record_draws },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-zinc-50 py-1">
                          <p className="text-base font-black text-zinc-900">{value}</p>
                          <p className="text-xs" style={{ color: '#9A9A9A' }}>{label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {mf.weight_class && (
                        <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5">
                          {WEIGHT_LABELS[mf.weight_class] ?? mf.weight_class}
                        </span>
                      )}
                      {mf.is_available && (
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5">Disponible</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              page={rosterPage}
              totalPages={rosterTotalPages}
              onPageChange={(p) => {
                setRosterPage(p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
