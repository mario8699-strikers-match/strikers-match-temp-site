'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import type { Profile } from '@/types';

export default function AdminSponsorsPage() {
  const { t } = useTranslation('admin');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    adminService.getProfilesByRole('sponsor').then(({ data, error }) => {
      if (error) {
        setError(error);
      } else {
        setProfiles(data ?? []);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.nav.sponsors')}</h1>
        <p className="mt-1 text-sm text-zinc-500">Todos los patrocinadores registrados en la plataforma.</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">—</div>
      ) : profiles.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 text-zinc-500 text-sm">
          No hay patrocinadores registrados.
        </div>
      ) : (
        <>
        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="bg-white border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  className="font-bold text-[#C0001E] hover:underline truncate text-left"
                >
                  {p.full_name}
                </button>
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                  p.is_banned ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {p.is_banned ? 'Baneado' : 'Activo'}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 truncate">{p.email}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-zinc-500">Ciudad:</dt>
                <dd className="text-zinc-700">{p.city ?? '—'}</dd>
                <dt className="text-zinc-500">Teléfono:</dt>
                <dd className="text-zinc-700">{p.phone ?? '—'}</dd>
              </dl>
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <button
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  className="text-xs font-medium text-zinc-700 hover:text-[#C0001E] hover:underline"
                >
                  {expandedId === p.id ? 'Ocultar' : 'Ver detalle'}
                </button>
              </div>
              {expandedId === p.id && (
                <div className="mt-3 pt-3 border-t border-zinc-100 grid grid-cols-1 gap-2 text-xs">
                  <div className="border border-zinc-200 p-3">
                    <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#C0001E' }}>Contacto</p>
                    <p><span className="font-medium text-zinc-500">Tel:</span> {p.phone || '---'}</p>
                  </div>
                  <div className="border border-zinc-200 p-3">
                    <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#C0001E' }}>Cuenta</p>
                    <p><span className="font-medium text-zinc-500">Rol:</span> Patrocinador</p>
                    <p><span className="font-medium text-zinc-500">Estado:</span> {p.is_banned ? 'Baneado' : 'Activo'}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block bg-white border border-zinc-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {['Nombre', 'Correo', 'Ciudad', 'Teléfono', 'Estado', 'Acciones'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {profiles.map((p) => (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                      <button
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        className="text-[#C0001E] hover:underline font-bold text-left"
                      >
                        {p.full_name}
                      </button>
                    </td>
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:underline"
                      >
                        {expandedId === p.id ? 'Ocultar' : 'Ver detalle'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr className="bg-zinc-50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          <div className="border border-zinc-200 p-3">
                            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#C0001E' }}>Contacto</p>
                            <div className="space-y-1 text-xs text-zinc-700">
                              <p><span className="font-medium text-zinc-500">Nombre:</span> {p.full_name || '---'}</p>
                              <p><span className="font-medium text-zinc-500">Correo:</span> {p.email || '---'}</p>
                              <p><span className="font-medium text-zinc-500">Tel:</span> {p.phone || '---'}</p>
                            </div>
                          </div>
                          <div className="border border-zinc-200 p-3">
                            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#C0001E' }}>Ubicación</p>
                            <div className="space-y-1 text-xs text-zinc-700">
                              <p><span className="font-medium text-zinc-500">Ciudad:</span> {p.city || '---'}</p>
                            </div>
                          </div>
                          <div className="border border-zinc-200 p-3">
                            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#C0001E' }}>Cuenta</p>
                            <div className="space-y-1 text-xs text-zinc-700">
                              <p><span className="font-medium text-zinc-500">Rol:</span> Patrocinador</p>
                              <p><span className="font-medium text-zinc-500">Estado:</span> {p.is_banned ? 'Baneado' : 'Activo'}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
