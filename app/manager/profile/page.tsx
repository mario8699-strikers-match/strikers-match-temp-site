'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import { managerService } from '@/services/managerService';
import type { Profile, Fighter } from '@/types';

type FighterWithProfile = Fighter & { profiles: { full_name: string; city: string | null } };

const WEIGHT_LABELS: Record<string, string> = {
  minimosca:'Minimosca',mosca:'Mosca',supermosca:'Supermosca',gallo:'Gallo',supergallo:'Supergallo',
  pluma:'Pluma',superpluma:'Superpluma',ligero:'Ligero',superligero:'Superligero',welter:'Welter',
  superwelter:'Superwelter',medio:'Medio',supermedio:'Supermedio',semipesado:'Semipesado',crucero:'Crucero',pesado:'Pesado',
};

export default function ManagerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [roster, setRoster] = useState<FighterWithProfile[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    authService.getSession().then(({ data }) => {
      const p = data?.profile ?? null;
      if (!p) { window.location.href = '/login'; return; }
      if (p.role !== 'manager') { window.location.href = '/'; return; }
      setProfile(p);
      setFullName(p.full_name ?? '');
      setCity(p.city ?? '');
      setPhone(p.phone ?? '');

      managerService.getRoster(p.id).then(({ data: fighters }) => {
        setRoster((fighters as FighterWithProfile[]) ?? []);
        setRosterLoading(false);
      });
    });
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    if (!fullName.trim()) { setSaveError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const { error } = await authService.updateProfile(profile.id, {
      full_name: fullName.trim(),
      city: city.trim() || null,
      phone: phone.trim() || null,
    });

    setSaving(false);
    if (error) {
      setSaveError('Error al guardar. Intenta de nuevo.');
    } else {
      setProfile({ ...profile, full_name: fullName.trim(), city: city.trim() || null, phone: phone.trim() || null });
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  if (profile === undefined) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm" style={{ color: '#9A9A9A' }}>...</p></div>;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage={null} />
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-10 w-full">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#C0001E' }}>Perfil del Manager</p>
            <h1 className="text-3xl font-black uppercase" style={{ letterSpacing: '-1px' }}>{profile!.full_name || 'Sin nombre'}</h1>
            {profile!.city && <p className="text-sm mt-1" style={{ color: '#5A5A5A' }}>{profile!.city}</p>}
          </div>
          <a
            href="/manager/dashboard"
            className="text-xs font-bold tracking-widest uppercase text-white px-4 py-2 transition-colors flex-shrink-0"
            style={{ background: '#C0001E' }}
          >
            Mi Panel →
          </a>
        </div>

        {saveSuccess && (
          <div className="mb-6 border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-medium">
            Perfil actualizado correctamente.
          </div>
        )}

        {/* ── View Mode ── */}
        {!editing && (
          <div className="space-y-6">
            <div className="border border-zinc-100 p-6 space-y-4">
              {[
                { label: 'Nombre completo', value: profile!.full_name || '—' },
                { label: 'Email', value: profile!.email },
                { label: 'Ciudad', value: profile!.city || '—' },
                { label: 'Teléfono', value: profile!.phone || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-bold tracking-widest uppercase mb-0.5" style={{ color: '#9A9A9A' }}>{label}</p>
                  <p className="text-sm font-semibold text-zinc-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Editar perfil
              </button>
            </div>
          </div>
        )}

        {/* ── Edit Mode ── */}
        {editing && (
          <div className="space-y-5">
            {saveError && <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{saveError}</div>}

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Nombre completo *</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Tu nombre completo"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Email</label>
              <input type="email" value={profile!.email} disabled
                className="w-full border border-zinc-200 px-3 py-2 text-zinc-400 text-sm bg-zinc-50 cursor-not-allowed" />
              <p className="text-xs text-zinc-400 mt-1">El email no se puede cambiar.</p>
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Ciudad</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Tu ciudad"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+52 664 000 0000"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setEditing(false); setSaveError(null); setFullName(profile!.full_name ?? ''); setCity(profile!.city ?? ''); setPhone(profile!.phone ?? ''); }}
                className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50"
                style={{ background: saving ? '#9A9A9A' : '#C0001E' }}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}

        {/* ── Roster ── */}
        <div className="mt-10 border-t border-zinc-100 pt-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C0001E' }}>
            Mi Roster ({roster.length})
          </p>
          {rosterLoading ? (
            <p className="text-sm text-zinc-400">Cargando...</p>
          ) : roster.length === 0 ? (
            <div className="border border-dashed border-zinc-200 py-10 text-center">
              <p className="text-sm text-zinc-400 mb-3">Tu roster está vacío.</p>
              <a href="/manager/dashboard" className="text-xs font-bold tracking-widest uppercase text-white px-4 py-2 transition-colors" style={{ background: '#C0001E' }}>
                Agregar peleadores
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {roster.map(f => (
                <div
                  key={f.id}
                  className="border border-zinc-200 p-4 flex items-start gap-3 cursor-pointer hover:border-zinc-400 transition-colors"
                  onClick={() => router.push(`/fighters/${f.id}`)}
                >
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
                    <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>
                      {f.weight_class ? WEIGHT_LABELS[f.weight_class] ?? f.weight_class : '—'} · {f.profiles?.city ?? '—'}
                    </p>
                    <div className="flex gap-1 mt-1">
                      <span className="text-xs font-bold text-zinc-600">{f.record_wins}V</span>
                      <span className="text-xs text-zinc-400">–</span>
                      <span className="text-xs font-bold text-zinc-600">{f.record_losses}D</span>
                      <span className="text-xs text-zinc-400">–</span>
                      <span className="text-xs font-bold text-zinc-600">{f.record_draws}E</span>
                    </div>
                    <span className={`inline-block mt-1 text-xs font-bold px-1.5 py-0.5 uppercase tracking-widest ${f.experience_level === 'pro' ? 'bg-[#C0001E] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                      {f.experience_level === 'pro' ? 'Pro' : 'Amateur'}
                    </span>
                  </div>
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
