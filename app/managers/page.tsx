'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import { userService } from '@/services/userService';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types';

const PAGE_SIZE = 12;

type ManagerWithRoster = Profile & { rosterCount: number };

export default function ManagersPage() {
  const [managers, setManagers] = useState<ManagerWithRoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      const [{ data: profiles }, { data: session }] = await Promise.all([
        userService.listByRole('manager'),
        authService.getSession(),
      ]);

      setIsLoggedIn(!!session?.profile);

      if (!profiles || profiles.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch roster counts for all managers in one query
      const { data: rosterRows } = await supabase
        .from('manager_fighters')
        .select('manager_id');

      const countMap: Record<string, number> = {};
      for (const row of rosterRows ?? []) {
        countMap[row.manager_id] = (countMap[row.manager_id] ?? 0) + 1;
      }

      setManagers(
        profiles.map((p) => ({
          ...p,
          rosterCount: countMap[p.id] ?? 0,
        }))
      );
      setLoading(false);
    };

    load();
  }, []);

  const totalPages = Math.ceil(managers.length / PAGE_SIZE);
  const pageManagers = useMemo(
    () => managers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [managers, page]
  );

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="managers" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>Strikers Match</p>
          <h1 className="font-display font-black uppercase leading-none" style={{ fontSize: 'clamp(2.5rem,6vw,4.5rem)', letterSpacing: '-0.02em', color: '#0A0A0A' }}>
            Managers
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#5A5A5A' }}>Managers de peleadores registrados en la plataforma</p>
        </div>

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">Cargando...</div>
        ) : managers.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-900 font-medium">No hay managers registrados aún.</p>
            <p className="mt-2 text-sm text-zinc-500">Regístrate como manager para aparecer aquí.</p>
            <a href="/register" className="mt-6 inline-block bg-zinc-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors">
              Registrarse
            </a>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pageManagers.map((manager) => (
              <div key={manager.id} className="border border-zinc-200 bg-white p-6 hover:border-zinc-400 transition-colors">

                {/* Avatar + name */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-zinc-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {manager.photo_url ? (
                      <Image
                        src={manager.photo_url}
                        alt={manager.full_name ?? 'Manager'}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : manager.full_name ? (
                      <span className="text-zinc-700 font-bold text-lg">{manager.full_name.charAt(0).toUpperCase()}</span>
                    ) : (
                      <svg className="w-6 h-6 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display font-black uppercase leading-none text-xl" style={{ color: '#0A0A0A' }}>{manager.full_name || 'Manager'}</h2>
                    {manager.city && <p className="text-xs text-zinc-500 mt-0.5">{manager.city}</p>}
                  </div>
                  {manager.rosterCount > 0 && (
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 flex-shrink-0">
                      {manager.rosterCount} peleador{manager.rosterCount !== 1 ? 'es' : ''}
                    </span>
                  )}
                </div>

                {/* CTA — locked unless logged in */}
                {isLoggedIn ? (
                  <a
                    href={`/search?manager=${manager.id}`}
                    className="block w-full text-center text-xs font-bold tracking-widest uppercase text-white bg-[#C0001E] hover:bg-[#9A0018] px-4 py-2.5 transition-colors"
                  >
                    Ver peleadores
                  </a>
                ) : (
                  <a
                    href="/login"
                    className="flex items-center justify-center gap-1.5 w-full text-center text-xs font-medium text-zinc-400 bg-zinc-50 border border-dashed border-zinc-200 px-4 py-2.5 hover:bg-zinc-100 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Inicia sesión para ver
                  </a>
                )}
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
