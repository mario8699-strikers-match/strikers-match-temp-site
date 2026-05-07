'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import type { Profile } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  fighter: 'Peleador',
  promoter: 'Promotor',
  manager: 'Manager',
  sponsor: 'Patrocinador',
  admin: 'Admin',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authService.getSession().then(({ data }) => {
      const p = data?.profile ?? null;
      if (!p) { window.location.href = '/login'; return; }
      setProfile(p);
      setFullName(p.full_name ?? '');
      setCity(p.city ?? '');
      setPhone(p.phone ?? '');
    });
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    if (!fullName.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setError(null);
    setSuccess(false);

    let photoUrl: string | undefined;
    if (photoFile) {
      const folder =
        profile.role === 'promoter' ? 'promoter-photos' :
        profile.role === 'manager'  ? 'manager-photos'  :
        profile.role === 'sponsor'  ? 'sponsor-photos'  :
        'profile-photos';
      const { data: url, error: upErr } = await authService.uploadProfilePhoto(photoFile, folder);
      if (upErr || !url) {
        setError('Error al subir la foto.');
        setSaving(false);
        return;
      }
      photoUrl = url;
    }

    const { error: err } = await authService.updateProfile(profile.id, {
      full_name: fullName.trim(),
      city: city.trim() || null,
      phone: phone.trim() || null,
      ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
    });

    setSaving(false);
    if (err) {
      setError('Error al guardar. Intenta de nuevo.');
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
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('La imagen no debe superar 8 MB.');
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error: err } = await authService.deleteAccount();
    if (err) {
      setError(err);
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
      <main className="flex-1 max-w-lg mx-auto px-4 sm:px-6 py-10 w-full">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
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
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#C0001E' }}>Mi Cuenta</p>
            <h1 className="text-3xl font-black uppercase" style={{ letterSpacing: '-1px' }}>Perfil</h1>
            <span className="inline-block mt-2 text-xs font-bold px-2 py-1 uppercase tracking-widest bg-zinc-100 text-zinc-600">
              {ROLE_LABELS[profile!.role] ?? profile!.role}
            </span>
          </div>
        </div>

        {success && (
          <div className="mb-6 border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-medium">
            Perfil actualizado correctamente.
          </div>
        )}
        {error && (
          <div className="mb-6 border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
        )}

        {/* View mode */}
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
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Editar perfil
              </button>
              {profile!.role === 'fighter' && (
                <a
                  href="/fighter/profile"
                  className="px-4 py-2 text-sm font-bold uppercase tracking-widest text-white transition-colors"
                  style={{ background: '#C0001E' }}
                >
                  Perfil de Peleador
                </a>
              )}
              {profile!.role === 'promoter' && (
                <a
                  href="/events"
                  className="px-4 py-2 text-sm font-bold uppercase tracking-widest text-white transition-colors"
                  style={{ background: '#C0001E' }}
                >
                  Mis Eventos
                </a>
              )}
              {profile!.role === 'manager' && (
                <a
                  href="/manager/dashboard"
                  className="px-4 py-2 text-sm font-bold uppercase tracking-widest text-white transition-colors"
                  style={{ background: '#C0001E' }}
                >
                  Mi Panel
                </a>
              )}
              {profile!.role === 'sponsor' && (
                <a
                  href="/sponsor/dashboard"
                  className="px-4 py-2 text-sm font-bold uppercase tracking-widest text-white transition-colors"
                  style={{ background: '#C0001E' }}
                >
                  Mi Panel
                </a>
              )}
            </div>
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <div className="space-y-5">
            {/* Photo upload */}
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div
                  className="w-20 h-20 bg-zinc-100 overflow-hidden cursor-pointer"
                  onClick={() => photoInputRef.current?.click()}
                  title={profile!.role === 'promoter' ? 'Cambiar logo' : 'Cambiar foto'}
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
                  aria-label="Cambiar imagen"
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
                <p className="text-sm font-medium text-zinc-700">
                  {profile!.role === 'promoter' ? 'Logo de la promotora' : 'Foto de perfil'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  JPG o PNG, máximo 8 MB. {profile!.role === 'promoter' ? 'Aparece en el directorio de Promotores y en tus eventos.' : 'Aparece en tu perfil público.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>
                Nombre completo *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Tu nombre completo"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>
                Email
              </label>
              <input
                type="email"
                value={profile!.email}
                disabled
                className="w-full border border-zinc-200 px-3 py-2 text-zinc-400 text-sm bg-zinc-50 cursor-not-allowed"
              />
              <p className="text-xs text-zinc-400 mt-1">El email no se puede cambiar.</p>
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>
                Ciudad
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Tu ciudad"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#5A5A5A' }}>
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+52 664 000 0000"
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setEditing(false); setError(null); setFullName(profile!.full_name ?? ''); setCity(profile!.city ?? ''); setPhone(profile!.phone ?? ''); setPhotoFile(null); setPhotoPreview(null); }}
                className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50"
                style={{ background: saving ? '#9A9A9A' : '#C0001E' }}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
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
