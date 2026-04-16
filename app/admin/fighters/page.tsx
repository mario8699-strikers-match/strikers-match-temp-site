'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import type { FighterWithProfile } from '@/types';

type Confirm = { fighterId: string; action: 'verify' | 'unverify' | 'hide' | 'unhide' } | null;

const REP_LABELS: { key: 'manager' | 'promoter' | 'sponsor'; label: string }[] = [
  { key: 'manager', label: 'Manager' },
  { key: 'promoter', label: 'Promotor' },
  { key: 'sponsor', label: 'Sponsor' },
];

export default function AdminFightersPage() {
  const { t } = useTranslation('admin');

  const [fighters, setFighters] = useState<FighterWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminService.getAllFighters().then(({ data }) => {
      setFighters(data ?? []);
      setLoading(false);
    });
  }, []);

  const handleAction = async () => {
    if (!confirm) return;
    setActing(true);
    setError(null);

    let result;
    switch (confirm.action) {
      case 'verify':
        result = await adminService.verifyFighter(confirm.fighterId);
        break;
      case 'unverify':
        result = await adminService.unverifyFighter(confirm.fighterId);
        break;
      case 'hide':
        result = await adminService.hideFighter(confirm.fighterId);
        break;
      case 'unhide':
        result = await adminService.unhideFighter(confirm.fighterId);
        break;
    }

    if (result.error) {
      setError(t('admin.errors.generic'));
    } else {
      setFighters((prev) =>
        prev.map((f) => {
          if (f.id !== confirm.fighterId) return f;
          if (confirm.action === 'verify' || confirm.action === 'unverify') {
            return { ...f, verified: confirm.action === 'verify' };
          }
          return { ...f, is_hidden: confirm.action === 'hide' };
        })
      );
    }
    setActing(false);
    setConfirm(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.fighters.title')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('admin.fighters.subtitle')}</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">—</div>
      ) : fighters.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 text-zinc-500 text-sm">
          {t('admin.fighters.noFighters')}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {['name', 'email', 'phone', 'city', 'weightClass', 'record', 'available', 'verified', 'visible', 'rep', 'actions'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide"
                  >
                    {col === 'rep' ? 'Representacion' : col === 'phone' ? 'Telefono' : col === 'visible' ? 'Visible' : t(`admin.fighters.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {fighters.map((fighter) => (
                <React.Fragment key={fighter.id}>
                <tr className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                    <Link href={`/fighters/${fighter.id}`} className="text-[#C0001E] hover:underline font-bold">
                      {fighter.profiles.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {fighter.profiles.email}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {fighter.profiles.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {fighter.profiles.city ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {fighter.weight_class ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {fighter.record_wins}W / {fighter.record_losses}L / {fighter.record_draws}D
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                      fighter.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {fighter.is_available ? t('admin.fighters.yes') : t('admin.fighters.no')}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fighter.verified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {t('admin.fighters.verified')}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">{t('admin.fighters.notVerified')}</span>
                    )}
                  </td>
                  {/* Visibility status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fighter.is_hidden ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                        Oculto
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Visible
                      </span>
                    )}
                  </td>
                  {/* Representation badges */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-1">
                      {fighter.has_manager && <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700">M</span>}
                      {fighter.has_promoter && <span className="text-xs font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700">P</span>}
                      {fighter.has_sponsor && <span className="text-xs font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700">S</span>}
                      {!fighter.has_manager && !fighter.has_promoter && !fighter.has_sponsor && <span className="text-xs text-zinc-400">---</span>}
                    </div>
                    {(fighter.has_manager || fighter.has_promoter || fighter.has_sponsor) && (
                      <button
                        onClick={() => setExpandedId(expandedId === fighter.id ? null : fighter.id)}
                        className="text-xs text-zinc-400 hover:text-zinc-700 mt-0.5 block"
                      >
                        {expandedId === fighter.id ? 'Ocultar' : 'Ver info'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {fighter.verified ? (
                        <button
                          onClick={() => setConfirm({ fighterId: fighter.id, action: 'unverify' })}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:underline"
                        >
                          {t('admin.fighters.unverify')}
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirm({ fighterId: fighter.id, action: 'verify' })}
                          className="text-xs font-medium text-emerald-700 hover:underline"
                        >
                          {t('admin.fighters.verify')}
                        </button>
                      )}
                      {fighter.is_hidden ? (
                        <button
                          onClick={() => setConfirm({ fighterId: fighter.id, action: 'unhide' })}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Mostrar
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirm({ fighterId: fighter.id, action: 'hide' })}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          Ocultar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Expanded representation details */}
                {expandedId === fighter.id && (
                  <tr className="bg-zinc-50">
                    <td colSpan={12} className="px-4 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        {REP_LABELS.map(({ key, label }) => {
                          const has = fighter[`has_${key}` as keyof typeof fighter] as boolean;
                          const name = fighter[`${key}_name` as keyof typeof fighter] as string | null;
                          const email = fighter[`${key}_email` as keyof typeof fighter] as string | null;
                          const phone = fighter[`${key}_phone` as keyof typeof fighter] as string | null;
                          return (
                            <div key={key} className="border border-zinc-200 p-3">
                              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: has ? '#C0001E' : '#9A9A9A' }}>{label}</p>
                              {has ? (
                                <div className="space-y-1 text-xs text-zinc-700">
                                  <p><span className="font-medium text-zinc-500">Nombre:</span> {name || '---'}</p>
                                  <p><span className="font-medium text-zinc-500">Correo:</span> {email || '---'}</p>
                                  <p><span className="font-medium text-zinc-500">Tel:</span> {phone || '---'}</p>
                                </div>
                              ) : (
                                <p className="text-xs text-zinc-400">No registrado</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white max-w-sm w-full p-6 shadow-xl">
            <p className="text-sm text-zinc-700 mb-6">
              {confirm.action === 'verify'
                ? t('admin.fighters.confirmVerify')
                : confirm.action === 'unverify'
                ? t('admin.fighters.confirmUnverify')
                : confirm.action === 'hide'
                ? 'Este peleador sera ocultado de otros perfiles de peleadores. Solo admin, promotores, managers y sponsors podran verlo.'
                : 'Este peleador sera visible para todos los usuarios nuevamente.'}
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
                className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {acting ? '...' : confirm.action === 'hide' ? 'Ocultar' : confirm.action === 'unhide' ? 'Mostrar' : t(`admin.fighters.${confirm.action}`)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
