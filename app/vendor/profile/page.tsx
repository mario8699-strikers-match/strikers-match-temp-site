'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
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
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!fullName.trim()) { setSaveError('El nombre es obligatorio.'); return; }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const { error } = await authService.updateProfile(profile.id, {
      full_name: fullName.trim(),
      city: city.trim() || null,
      phone: phone.trim() || null,
      bio: bio.trim() || null,
      instagram: instagram.trim() || null,
      is_available: isAvailable,
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
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
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
            Actualiza tu información. Tu perfil aparece en{' '}
            <a href="/professionals" className="font-medium text-zinc-900 underline hover:text-[#C0001E]">
              /professionals
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

          <div className="grid grid-cols-2 gap-4">
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
