'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import { managerService } from '@/services/managerService';
import type { Profile, Fighter, ManualFighter } from '@/types';

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
  const [manualFighters, setManualFighters] = useState<ManualFighter[]>([]);

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

      managerService.getManualFighters(p.id).then(({ data: mf }) => {
        setManualFighters(mf ?? []);
      });
    });
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    if (!fullName.trim()) { setSaveError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    let photoUrl: string | undefined;
    if (photoFile) {
      const { data: url, error: upErr } = await authService.uploadProfilePhoto(photoFile, 'manager-photos');
      if (upErr || !url) {
        setSaveError('Error al subir la foto.');
        setSaving(false);
        return;
      }
      photoUrl = url;
    }

    const { error } = await authService.updateProfile(profile.id, {
      full_name: fullName.trim(),
      city: city.trim() || null,
      phone: phone.trim() || null,
      ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
    });

    setSaving(false);
    if (error) {
      setSaveError('Error al guardar. Intenta de nuevo.');
    } else {
      setProfile({
        ...profile,
        full_name: fullName.trim(),
        city: city.trim() || null,
        phone: phone.trim() || null,
        photo_url: photoUrl ?? profile.photo_url,
      });
      setPhotoFile(null);
      setPhotoPreview(null);
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSaveError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setSaveError('La imagen no debe superar 8 MB.');
      return;
    }
    setSaveError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error } = await authService.deleteAccount();
    if (error) {
      setSaveError(error);
      setDeleting(false);
      setShowDeleteConfirm(false);
    } else {
      window.location.href = '/';
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
        <div className="flex items-start justify-between mb-8 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {profile!.photo_url ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 overflow-hidden bg-zinc-100 flex-shrink-0">
                <Image src={profile!.photo_url} alt={profile!.full_name ?? 'Foto'} width={80} height={80} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-200 flex items-center justify-center flex-shrink-0">
                <span className="text-zinc-700 font-bold text-2xl">
                  {(profile!.full_name ?? '?').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#C0001E' }}>Perfil del Manager</p>
              <h1 className="text-2xl sm:text-3xl font-black uppercase truncate" style={{ letterSpacing: '-1px' }}>{profile!.full_name || 'Sin nombre'}</h1>
              {profile!.city && <p className="text-sm mt-1" style={{ color: '#5A5A5A' }}>{profile!.city}</p>}
            </div>
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

            {/* Photo upload */}
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div
                  className="w-20 h-20 bg-zinc-100 overflow-hidden cursor-pointer"
                  onClick={() => photoInputRef.current?.click()}
                  title="Cambiar foto"
                >
                  {photoPreview ? (
                    <Image src={photoPreview} alt="Foto" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                  ) : profile!.photo_url ? (
                    <Image src={profile!.photo_url} alt="Foto" width={80} height={80} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                      </svg>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-zinc-900 text-white flex items-center justify-center"
                  aria-label="Cambiar foto"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-700">Foto de perfil</p>
                <p className="text-xs text-zinc-500 mt-0.5">JPG o PNG, máximo 8 MB. Aparece en el directorio de Managers.</p>
              </div>
            </div>

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
              <button onClick={() => { setEditing(false); setSaveError(null); setFullName(profile!.full_name ?? ''); setCity(profile!.city ?? ''); setPhone(profile!.phone ?? ''); setPhotoFile(null); setPhotoPreview(null); }}
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

        {/* ── Manual Fighters ── */}
        {manualFighters.length > 0 && (
          <div className="mt-10 border-t border-zinc-100 pt-8">
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#C0001E' }}>
              Mis Peleadores ({manualFighters.length})
            </p>
            <p className="text-xs text-zinc-400 mb-4">Peleadores no registrados en la plataforma.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {manualFighters.map(f => (
                <div key={f.id} className="border border-zinc-200 p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-zinc-900">{f.full_name}</p>
                    {f.nickname && <span className="text-xs text-zinc-400">&ldquo;{f.nickname}&rdquo;</span>}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#5A5A5A' }}>
                    {f.weight_class ? WEIGHT_LABELS[f.weight_class] ?? f.weight_class : '—'} · {f.city ?? '—'}
                  </p>
                  <div className="flex gap-1 mt-1">
                    <span className="text-xs font-bold text-zinc-600">{f.record_wins}V</span>
                    <span className="text-xs text-zinc-400">–</span>
                    <span className="text-xs font-bold text-zinc-600">{f.record_losses}D</span>
                    <span className="text-xs text-zinc-400">–</span>
                    <span className="text-xs font-bold text-zinc-600">{f.record_draws}E</span>
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <span className={`text-xs font-bold px-1.5 py-0.5 uppercase tracking-widest ${f.experience_level === 'pro' ? 'bg-[#C0001E] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                      {f.experience_level === 'pro' ? 'Pro' : 'Amateur'}
                    </span>
                    {f.discipline && <span className="text-xs font-bold px-1.5 py-0.5 uppercase tracking-wide bg-zinc-900 text-white">{f.discipline}</span>}
                  </div>
                  {(f.phone || f.email) && (
                    <p className="text-xs text-zinc-400 mt-1.5">{[f.phone, f.email].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Delete Account ── */}
        <div className="mt-12 border-t border-zinc-100 pt-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-2 text-red-600">Zona de peligro</p>
          <p className="text-sm text-zinc-500 mb-4">Eliminar tu cuenta es permanente. Se borrarán todos tus datos y no podrás recuperarlos.</p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            Eliminar cuenta
          </button>
        </div>

        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white max-w-sm w-full p-6 shadow-lg">
              <h3 className="text-lg font-black uppercase mb-2">Eliminar cuenta</h3>
              <p className="text-sm text-zinc-600 mb-6">
                Esta acción es irreversible. Se eliminarán tu perfil, datos y toda la información asociada a tu cuenta. ¿Estás seguro?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
