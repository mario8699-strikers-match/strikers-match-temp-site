'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import { VENDOR_ROLES } from '@/types';
import type { Profile } from '@/types';

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

  const matchesRole = (p: Profile, role: string) =>
    p.role === role || (p.additional_roles ?? []).includes(role as Profile['role']);

  const filtered = filterRole === 'all'
    ? profiles
    : profiles.filter((p) => matchesRole(p, filterRole));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.nav.vendors')}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t('admin.directory.vendorsSubtitle')}
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
          {t('admin.directory.all')} ({profiles.length})
        </button>
        {VENDOR_ROLES.map((role) => {
          const count = profiles.filter((p) => matchesRole(p, role)).length;
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
              {t(`admin.users.roles.${role}`, { defaultValue: role })} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">—</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 text-zinc-500 text-sm">
          {filterRole !== 'all'
            ? t('admin.directory.noVendorsRole', { role: t(`admin.users.roles.${filterRole}`, { defaultValue: filterRole }) })
            : t('admin.directory.noVendors')}
        </div>
      ) : (
        <>
        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/professionals/${p.id}`} className="font-bold text-[#C0001E] truncate hover:underline block">
                    {p.full_name}
                  </Link>
                  <p className="text-xs text-zinc-500 truncate">{p.email}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                  p.is_banned ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {p.is_banned ? t('admin.users.banned') : t('admin.users.active')}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700">
                  {t(`admin.users.roles.${p.role}`, { defaultValue: p.role })}
                </span>
                {(p.additional_roles ?? [])
                  .filter((r) => r !== p.role)
                  .map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-white border border-zinc-200 text-zinc-600"
                    >
                      + {t(`admin.users.roles.${r}`, { defaultValue: r })}
                    </span>
                  ))}
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-zinc-500">{t('admin.directory.city')}:</dt>
                <dd className="text-zinc-700">{p.city ?? '—'}</dd>
                <dt className="text-zinc-500">{t('admin.directory.phone')}:</dt>
                <dd className="text-zinc-700">{p.phone ?? '—'}</dd>
              </dl>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block bg-white border border-zinc-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {['name', 'email', 'role', 'city', 'phone', 'status'].map((col) => (
                  <th key={col} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    {t(`admin.directory.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-bold text-[#C0001E] whitespace-nowrap">
                    <Link href={`/professionals/${p.id}`} className="hover:underline">
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700">
                        {t(`admin.users.roles.${p.role}`, { defaultValue: p.role })}
                      </span>
                      {(p.additional_roles ?? [])
                        .filter((r) => r !== p.role)
                        .map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-white border border-zinc-200 text-zinc-600"
                          >
                            + {t(`admin.users.roles.${r}`, { defaultValue: r })}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.city ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{p.phone ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                      p.is_banned ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {p.is_banned ? t('admin.users.banned') : t('admin.users.active')}
                    </span>
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
