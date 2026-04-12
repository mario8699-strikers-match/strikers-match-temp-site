'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import { managerService } from '@/services/managerService';
import { fighterService } from '@/services/fighterService';
import type { Profile, Fighter } from '@/types';

type FighterWithProfile = Fighter & { profiles: { full_name: string; city: string | null } };

const WEIGHT_LABELS: Record<string, string> = {
  minimosca:'Minimosca',mosca:'Mosca',supermosca:'Supermosca',gallo:'Gallo',supergallo:'Supergallo',
  pluma:'Pluma',superpluma:'Superpluma',ligero:'Ligero',superligero:'Superligero',welter:'Welter',
  superwelter:'Superwelter',medio:'Medio',supermedio:'Supermedio',semipesado:'Semipesado',crucero:'Crucero',pesado:'Pesado',
};

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [roster, setRoster] = useState<FighterWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Add fighter state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FighterWithProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    authService.getSession().then(({ data }) => {
      const p = data?.profile ?? null;
      setProfile(p);
      if (!p) { window.location.href = '/login'; return; }
      if (p.role !== 'manager') { window.location.href = '/'; return; }

      managerService.getRoster(p.id).then(({ data: fighters }) => {
        setRoster((fighters as FighterWithProfile[]) ?? []);
        setLoading(false);
      });
    });
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setAddError(null);
    const { data } = await fighterService.search({ page: 1 });
    // Filter client-side by name since ilike on joined column has limitations
    const all = (data?.fighters as FighterWithProfile[]) ?? [];
    const filtered = all.filter(f =>
      (f.profiles?.full_name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    setSearchResults(filtered.slice(0, 8));
    setSearching(false);
  };

  const handleAdd = async (fighter: FighterWithProfile) => {
    if (!profile) return;
    setAdding(fighter.id);
    setAddError(null);
    const { error } = await managerService.addFighter(profile.id, fighter.id);
    setAdding(null);
    if (error) {
      setAddError(error.includes('unique') ? 'Este peleador ya está en tu roster.' : 'Error al agregar.');
    } else {
      setRoster(prev => [...prev, fighter]);
      setSearchResults(prev => prev.filter(f => f.id !== fighter.id));
    }
  };

  const handleRemove = async (fighterId: string) => {
    if (!profile) return;
    setRemoving(fighterId);
    await managerService.removeFighter(profile.id, fighterId);
    setRoster(prev => prev.filter(f => f.id !== fighterId));
    setRemoving(null);
  };

  if (profile === undefined) return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm" style={{ color:'#9A9A9A' }}>...</p></div>;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage={null} />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#C0001E' }}>Panel del Manager</p>
          <h1 className="text-3xl font-black uppercase" style={{ letterSpacing:'-1px' }}>{profile!.full_name}</h1>
          <p className="text-sm mt-1" style={{ color:'#5A5A5A' }}>{profile!.city ?? ''}</p>
        </div>

        {/* Search + Add fighters */}
        <div className="border border-zinc-200 p-6 mb-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color:'#5A5A5A' }}>Agregar Peleador al Roster</p>
          <form onSubmit={handleSearch} className="flex gap-3 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre..."
              className="flex-1 border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
            <button type="submit" disabled={searching} className="px-4 py-2 text-sm font-bold tracking-widest uppercase text-white disabled:opacity-50 transition-colors" style={{ background:'#C0001E' }}>
              {searching ? '...' : 'Buscar'}
            </button>
          </form>

          {addError && <p className="text-xs text-red-600 mb-3">{addError}</p>}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 border border-zinc-100 bg-zinc-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-200 overflow-hidden flex-shrink-0">
                      {f.photo_url ? <Image src={f.photo_url} alt="" width={32} height={32} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{f.profiles?.full_name}</p>
                      <p className="text-xs" style={{ color:'#5A5A5A' }}>
                        {f.weight_class ? WEIGHT_LABELS[f.weight_class] ?? f.weight_class : '—'} · {f.profiles?.city ?? '—'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleAdd(f)} disabled={adding === f.id}
                    className="px-3 py-1 text-xs font-bold text-white disabled:opacity-50 transition-colors" style={{ background:'#C0001E' }}>
                    {adding === f.id ? '...' : 'Agregar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Roster */}
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color:'#C0001E' }}>
            Mi Roster ({roster.length})
          </p>
          {loading ? (
            <p className="text-sm text-zinc-400">Cargando...</p>
          ) : roster.length === 0 ? (
            <div className="border border-dashed border-zinc-200 py-12 text-center">
              <p className="text-sm text-zinc-400">Tu roster está vacío. Busca peleadores arriba para agregarlos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {roster.map(f => (
                <div key={f.id} className="border border-zinc-200 p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 cursor-pointer" onClick={() => router.push(`/fighters/${f.id}`)}>
                    <div className="w-12 h-12 bg-zinc-100 overflow-hidden flex-shrink-0">
                      {f.photo_url ? (
                        <Image src={f.photo_url} alt="" width={48} height={48} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900">{f.profiles?.full_name}</p>
                      <p className="text-xs mt-0.5" style={{ color:'#5A5A5A' }}>
                        {f.weight_class ? WEIGHT_LABELS[f.weight_class] ?? f.weight_class : '—'} · {f.profiles?.city ?? '—'}
                      </p>
                      <div className="flex gap-1 mt-1">
                        <span className="text-xs font-bold text-zinc-600">{f.record_wins}V</span>
                        <span className="text-xs text-zinc-400">–</span>
                        <span className="text-xs font-bold text-zinc-600">{f.record_losses}D</span>
                        <span className="text-xs text-zinc-400">–</span>
                        <span className="text-xs font-bold text-zinc-600">{f.record_draws}E</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleRemove(f.id)} disabled={removing === f.id}
                    className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors flex-shrink-0 pt-1">
                    {removing === f.id ? '...' : 'Quitar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
