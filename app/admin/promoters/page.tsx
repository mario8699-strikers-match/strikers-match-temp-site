'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import type { Profile, PromoterFederationStatus } from '@/types';

export default function AdminPromotersPage() {
  const { t } = useTranslation('admin');
  const { t: tPromoters } = useTranslation('promoters');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingFederationStatus, setUpdatingFederationStatus] = useState<string | null>(null);

  useEffect(() => {
    adminService.getProfilesByRole('promoter').then(({ data, error }) => {
      if (error) {
        setError(error);
      } else {
        setProfiles(data ?? []);
      }
      setLoading(false);
    });
  }, []);

  const updateFederationStatus = async (promoterId: string, status: PromoterFederationStatus) => {
    setUpdatingFederationStatus(promoterId);
    setError(null);
    const { data, error } = await adminService.updatePromoterFederationStatus(promoterId, status);
    if (error || !data) {
      setError(error ?? tPromoters('promoters.federation.updateFailed'));
    } else {
      setProfiles((prev) => prev.map((profile) => profile.id === promoterId ? data : profile));
    }
    setUpdatingFederationStatus(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.nav.promoters')}</h1>
        <p className="mt-1 text-sm text-zinc-500">Todos los promotores registrados en la plataforma.</p>
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
          No hay promotores registrados.
        </div>
      ) : (
        <>
        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="bg-white border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/events?promoter=${p.id}`} className="font-bold text-[#C0001E] hover:underline truncate">
                  {p.full_name}
                </Link>
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
                <dt className="text-zinc-500">Clasificación:</dt>
                <dd className="text-zinc-700">
                  <FederationStatusButtons
                    status={p.promoter_federation_status ?? 'independent'}
                    disabled={updatingFederationStatus === p.id}
                    labels={{
                      federated: tPromoters('promoters.federation.federated'),
                      independent: tPromoters('promoters.federation.independent'),
                    }}
                    onChange={(status) => void updateFederationStatus(p.id, status)}
                  />
                </dd>
              </dl>
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <Link href={`/events?promoter=${p.id}`} className="text-xs font-medium text-zinc-700 hover:text-[#C0001E] hover:underline">
                  Ver eventos →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block bg-white border border-zinc-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {['Nombre', 'Correo', 'Ciudad', 'Teléfono', 'Clasificación', 'Estado', 'Acciones'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                    <Link href={`/events?promoter=${p.id}`} className="text-[#C0001E] hover:underline font-bold">
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.email}</td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.city ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.phone ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <FederationStatusButtons
                      status={p.promoter_federation_status ?? 'independent'}
                      disabled={updatingFederationStatus === p.id}
                      labels={{
                        federated: tPromoters('promoters.federation.federated'),
                        independent: tPromoters('promoters.federation.independent'),
                      }}
                      onChange={(status) => void updateFederationStatus(p.id, status)}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                      p.is_banned ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {p.is_banned ? 'Baneado' : 'Activo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/events?promoter=${p.id}`} className="text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:underline">
                      Ver eventos
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

function FederationStatusButtons({
  status,
  disabled,
  labels,
  onChange,
}: {
  status: PromoterFederationStatus;
  disabled: boolean;
  labels: Record<PromoterFederationStatus, string>;
  onChange: (status: PromoterFederationStatus) => void;
}) {
  return (
    <div className="inline-grid grid-cols-2 border border-zinc-200">
      {(['independent', 'federated'] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled || status === option}
          onClick={() => onChange(option)}
          className={`px-2 py-1 text-xs font-medium transition-colors disabled:cursor-default ${
            status === option
              ? 'bg-zinc-900 text-white'
              : 'bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-60'
          }`}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
