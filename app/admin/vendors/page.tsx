'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import { VENDOR_ROLES } from '@/types';
import type { Profile } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  ring_card_girl: 'Ring Card Girl',
  photographer: 'Fotógrafo',
  videographer: 'Videógrafo',
  broadcast_personality: 'Transmisión',
  catering_vendor: 'Catering',
  venue_rental: 'Venue',
  judge: 'Juez / Réferi',
  ring_rental: 'Renta de Ring',
  ring_announcer: 'Anunciador',
  cutman: 'Cutman',
  merchandise_vendor: 'Mercancía',
};

export default function AdminVendorsPage() {
  const { t } = useTranslation('admin');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');

  useEffect(() => {
    // Fetch all vendor roles in parallel
    Promise.all(
      VENDOR_ROLES.map((role) => adminService.getProfilesByRole(role))
    ).then((results) => {
      const allProfiles: Profile[] = [];
      for (const res of results) {
        if (res.error) {
          setError(res.error);
        } else if (res.data) {
          allProfiles.push(...res.data);
        }
      }
      allProfiles.sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
      setProfiles(allProfiles);
      setLoading(false);
    });
  }, []);

  const filtered = filterRole === 'all'
    ? profiles
    : profiles.filter((p) => p.role === filterRole);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.nav.vendors')}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Todos los vendors y servicios registrados en la plataforma.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Role filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilterRole('all')}
          className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
            filterRole === 'all'
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
          }`}
        >
          Todos ({profiles.length})
        </button>
        {VENDOR_ROLES.map((role) => {
          const count = profiles.filter((p) => p.role === role).length;
          if (count === 0) return null;
          return (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                filterRole === role
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {ROLE_LABELS[role] ?? role} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">—</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 text-zinc-500 text-sm">
          No hay vendors registrados{filterRole !== 'all' ? ` con el rol ${ROLE_LABELS[filterRole] ?? filterRole}` : ''}.
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {['Nombre', 'Correo', 'Rol', 'Ciudad', 'Teléfono', 'Estado'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-bold text-[#C0001E] whitespace-nowrap">
                    {p.full_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700">
                      {ROLE_LABELS[p.role] ?? p.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.city ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.phone ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                      p.is_banned ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {p.is_banned ? 'Baneado' : 'Activo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
