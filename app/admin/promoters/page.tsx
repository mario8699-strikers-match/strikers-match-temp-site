'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/types';

export default function AdminPromotersPage() {
  const { t } = useTranslation('admin');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'promoter')
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        setProfiles(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.nav.promoters')}</h1>
        <p className="mt-1 text-sm text-zinc-500">Todos los promotores registrados en la plataforma.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">—</div>
      ) : profiles.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 text-zinc-500 text-sm">
          No hay promotores registrados.
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {['Nombre', 'Correo', 'Ciudad', 'Teléfono', 'Estado'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">{p.full_name}</td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.email}</td>
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
