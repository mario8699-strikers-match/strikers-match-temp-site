'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { authService } from '@/services/authService';
import { VENDOR_ROLES } from '@/types';
import type { Profile, UserRole } from '@/types';

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

export default function VendorProfilePage() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [additionalRoles, setAdditionalRoles] = useState<UserRole[]>([]);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authService.getSession().then(({ data }) => {
      const p = data?.profile ?? null;
      if (!p) { window.location.href = '/login'; return; }
      if (!VENDOR_ROLES.includes(p.role)) { window.location.href = '/'; return; }
      setProfile(p);
      setFullName(p.full_name ?? '');
      setCity(p.city ?? '');
      setPhone(p.phone ?? '');
      setBio(p.bio ?? '');
      setInstagram(p.instagram ?? '');
      setIsAvailable(p.is_available ?? true);
      setAdditionalRoles((p.additional_roles ?? []).filter((r) => r !== p.role));
    });
  }, []);

  const toggleAdditionalRole = (role: UserRole) => {
    setAdditionalRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!fullName.trim()) { setSaveError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    let photoUrl: string | undefined;
    if (photoFile) {
      const { data: url, error: upErr } = await authService.uploadProfilePhoto(photoFile);
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
      bio: bio.trim() || null,
      instagram: instagram.trim() || null,
      is_available: isAvailable,
      additional_roles: additionalRoles.filter((r) => r !== profile.role),
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
        bio: bio.trim() || null,
        instagram: instagram.trim() || null,
        is_available: isAvailable,
        photo_url: photoUrl ?? profile.photo_url,
        additional_roles: additionalRoles.filter((r) => r !== profile.role),
      });
      setPhotoFile(null);
      setPhotoPreview(null);
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

  if (profile === undefined) {
    return (
      <div className="min-h-screen bg-white font-sans flex flex-col">
        <Navbar activePage={null} />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 w-full">
          <p className="text-sm text-zinc-400">Cargando...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-16 w-full">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>Strikers Match</p>
          <h1 className="text-3xl font-bold text-zinc-900">Mi Perfil</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Actualiza tu información. Tu perfil aparece en el directorio de{' '}
            <a href="/professionals" className="font-medium text-zinc-900 underline hover:text-[#C0001E]">
              Servicios de Eventos
            </a>.
          </p>
          <div className="mt-3">
            <span className="inline-flex items-center text-xs font-bold uppercase tracking-widest px-2 py-1 bg-zinc-100 text-zinc-700">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
            Perfil guardado correctamente.
          </div>
        )}
        {saveError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {saveError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div
                className="w-20 h-20 bg-zinc-100 overflow-hidden cursor-pointer"
                onClick={() => photoInputRef.current?.click()}
                title="Cambiar foto"
              >
                {photoPreview ? (
                  <Image src={photoPreview} alt="Foto de perfil" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                ) : profile.photo_url ? (
                  <Image src={profile.photo_url} alt="Foto de perfil" width={80} height={80} className="w-full h-full object-cover" />
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
              <p className="text-xs text-zinc-500 mt-0.5">
                JPG o PNG, máximo 8 MB. Aparece en el directorio público.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-zinc-700 mb-1">
              Nombre Completo
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              value={profile.email}
              disabled
              className="w-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-zinc-700 mb-1">Ciudad</label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 mb-1">Teléfono</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-zinc-700 mb-1">
              Descripción <span className="text-zinc-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Breve descripción de tu servicio y experiencia"
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
            />
          </div>

          <div>
            <label htmlFor="instagram" className="block text-sm font-medium text-zinc-700 mb-1">
              Instagram <span className="text-zinc-400 font-normal">(opcional)</span>
            </label>
            <input
              id="instagram"
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@tu_usuario"
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Otros servicios que ofreces <span className="text-zinc-400 font-normal">(opcional)</span>
            </label>
            <p className="text-xs text-zinc-500 mb-3">
              Selecciona todos los que apliquen. Por ejemplo, un cutman también certificado como EMT.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VENDOR_ROLES.filter((r) => r !== profile.role).map((role) => {
                const checked = additionalRoles.includes(role);
                return (
                  <label
                    key={role}
                    className={`flex items-center gap-2 px-3 py-2 border cursor-pointer transition-colors ${
                      checked
                        ? 'border-zinc-900 bg-zinc-50'
                        : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAdditionalRole(role)}
                      className="w-4 h-4 border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                    <span className="text-xs text-zinc-700">{ROLE_LABELS[role] ?? role}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="w-4 h-4 border-zinc-300 text-zinc-900 focus:ring-zinc-900"
            />
            <span className="text-sm text-zinc-700">
              Disponible para contratación (aparece con indicador verde en el directorio)
            </span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-brand-red text-white py-2.5 text-sm font-semibold hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
