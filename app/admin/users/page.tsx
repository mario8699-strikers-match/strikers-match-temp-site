'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import type { Profile } from '@/types';

type Confirm = { userId: string; action: 'ban' | 'unban' } | null;

export default function AdminUsersPage() {
  const { t } = useTranslation('admin');

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminService.getAllUsers().then(({ data }) => {
      setUsers(data ?? []);
      setLoading(false);
    });
  }, []);

  const handleAction = async () => {
    if (!confirm) return;
    setActing(true);
    setError(null);

    const result =
      confirm.action === 'ban'
        ? await adminService.banUser(confirm.userId)
        : await adminService.unbanUser(confirm.userId);

    if (result.error) {
      setError(t('admin.errors.generic'));
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === confirm.userId ? { ...u, is_banned: confirm.action === 'ban' } : u
        )
      );
    }
    setActing(false);
    setConfirm(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.users.title')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('admin.users.subtitle')}</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">—</div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 text-zinc-500 text-sm">
          {t('admin.users.noUsers')}
        </div>
      ) : (
        <>
        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {users.map((user) => (
            <div key={user.id} className="bg-white border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-zinc-900 truncate">{user.full_name}</p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium flex-shrink-0 ${
                    user.is_banned ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {user.is_banned ? t('admin.users.banned') : t('admin.users.active')}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-zinc-500">{t('admin.users.role')}:</dt>
                <dd className="text-zinc-700">{t(`admin.users.roles.${user.role}`, { defaultValue: user.role })}</dd>
                <dt className="text-zinc-500">{t('admin.users.city')}:</dt>
                <dd className="text-zinc-700">{user.city ?? '—'}</dd>
              </dl>
              <div className="mt-3 pt-3 border-t border-zinc-100">
                {user.is_banned ? (
                  <button
                    onClick={() => setConfirm({ userId: user.id, action: 'unban' })}
                    className="text-xs font-medium text-emerald-700 hover:underline"
                  >
                    {t('admin.users.unban')}
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirm({ userId: user.id, action: 'ban' })}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    {t('admin.users.ban')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block bg-white border border-zinc-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {['name', 'email', 'role', 'city', 'status', 'actions'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide"
                  >
                    {t(`admin.users.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                    {user.full_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">{user.email}</td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {t(`admin.users.roles.${user.role}`, { defaultValue: user.role })}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {user.city ?? '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                        user.is_banned
                          ? 'bg-red-50 text-red-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {user.is_banned ? t('admin.users.banned') : t('admin.users.active')}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {user.is_banned ? (
                      <button
                        onClick={() => setConfirm({ userId: user.id, action: 'unban' })}
                        className="text-xs font-medium text-emerald-700 hover:underline"
                      >
                        {t('admin.users.unban')}
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirm({ userId: user.id, action: 'ban' })}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        {t('admin.users.ban')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white max-w-sm w-full p-6 shadow-xl">
            <p className="text-sm text-zinc-700 mb-6">
              {confirm.action === 'ban'
                ? t('admin.users.confirmBan')
                : t('admin.users.confirmUnban')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirm(null)}
                disabled={acting}
                className="px-4 py-2 text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50 transition-colors"
              >
                {t('common.cancel', { ns: 'common' })}
              </button>
              <button
                onClick={handleAction}
                disabled={acting}
                className={`px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors ${
                  confirm.action === 'ban'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {acting
                  ? '...'
                  : confirm.action === 'ban'
                  ? t('admin.users.ban')
                  : t('admin.users.unban')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
