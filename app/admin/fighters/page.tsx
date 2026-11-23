'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { InlineCombatRecord } from '@/components/CombatRecord';
import { adminService } from '@/services/adminService';
import { getMissingFighterRegistrationProfileFields } from '@/lib/fighterRegistrationProfile';
import { buildFighterProfileReminderEmail } from '@/lib/fighterProfileReminderEmail';
import { fighterPublicPath, manualFighterPublicPath } from '@/lib/publicUrls';
import type { FighterWithProfile, ManualFighterWithCreator } from '@/types';

type Confirm = { fighterId: string; action: 'verify' | 'unverify' | 'hide' | 'unhide' } | null;
type Tab = 'registered' | 'manual';
type ReminderPreview = {
  fighterId: string;
  fighterName: string;
  recipientEmail: string;
  language: string;
  subject: string;
  html: string;
};

const REP_LABELS = ['manager', 'promoter', 'sponsor'] as const;

export default function AdminFightersPage() {
  const { t } = useTranslation('admin');

  const [fighters, setFighters] = useState<FighterWithProfile[]>([]);
  const [manualFighters, setManualFighters] = useState<ManualFighterWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('registered');
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [reminderSentIds, setReminderSentIds] = useState<Set<string>>(() => new Set());
  const [reminderPreview, setReminderPreview] = useState<ReminderPreview | null>(null);

  const missingFieldsByFighterId = useMemo(() => new Map(
    fighters.map((fighter) => [
      fighter.id,
      getMissingFighterRegistrationProfileFields(fighter, fighter.profiles),
    ]),
  ), [fighters]);

  useEffect(() => {
    Promise.all([
      adminService.getAllFighters(),
      adminService.getAllManualFighters(),
    ]).then(([regRes, manRes]) => {
      setFighters(regRes.data ?? []);
      setManualFighters(manRes.data ?? []);
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

  const openReminderPreview = (fighter: FighterWithProfile) => {
    const missingFields = missingFieldsByFighterId.get(fighter.id) ?? [];
    const email = buildFighterProfileReminderEmail({
      fullName: fighter.profiles.full_name,
      language: fighter.profiles.preferred_language,
      missingFields,
      profileUrl: `${window.location.origin}/fighter/profile`,
    });
    setReminderPreview({
      fighterId: fighter.id,
      fighterName: fighter.profiles.full_name,
      recipientEmail: fighter.profiles.email,
      language: fighter.profiles.preferred_language ?? 'es',
      subject: email.subject,
      html: email.html,
    });
  };

  const handleProfileReminder = async (fighterId: string) => {
    setRemindingId(fighterId);
    setError(null);
    const result = await adminService.sendFighterProfileReminder(fighterId);
    setRemindingId(null);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setReminderSentIds((current) => new Set(current).add(fighterId));
    return true;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.fighters.title')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('admin.fighters.subtitle')}</p>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-6 border-b border-zinc-200">
        <button
          onClick={() => setTab('registered')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'registered'
              ? 'border-[#C0001E] text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}
        >
          Registrados <span className="ml-1 text-xs text-zinc-400">({fighters.length})</span>
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'manual'
              ? 'border-[#C0001E] text-zinc-900'
              : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}
        >
          Roster (sin cuenta) <span className="ml-1 text-xs text-zinc-400">({manualFighters.length})</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">—</div>
      ) : tab === 'registered' ? (
        fighters.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 text-zinc-500 text-sm">
          {t('admin.fighters.noFighters')}
        </div>
      ) : (
        <>
        {/* Mobile card list - registered */}
        <div className="sm:hidden space-y-3">
          {fighters.map((fighter) => (
            <div key={fighter.id} className="bg-white border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={fighterPublicPath(fighter)} className="font-bold text-[#C0001E] hover:underline truncate">
                  {fighter.profiles.full_name}
                </Link>
                <div className="flex flex-wrap gap-1 flex-shrink-0">
                  {fighter.verified && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700">✓</span>
                  )}
                  {fighter.is_hidden && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-red-50 text-red-700">{t('admin.fighters.hidden')}</span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-zinc-500 truncate">{fighter.profiles.email}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-zinc-500">{t('admin.fighters.phone')}:</dt>
                <dd className="text-zinc-700">{fighter.profiles.phone ?? '—'}</dd>
                <dt className="text-zinc-500">{t('admin.fighters.city')}:</dt>
                <dd className="text-zinc-700">{fighter.profiles.city ?? '—'}</dd>
                <dt className="text-zinc-500">{t('admin.fighters.weightClass')}:</dt>
                <dd className="text-zinc-700">{fighter.weight_class ?? '—'}</dd>
                <dt className="text-zinc-500">{t('admin.fighters.record')}:</dt>
                <dd className="text-zinc-700"><InlineCombatRecord wins={fighter.record_wins} losses={fighter.record_losses} draws={fighter.record_draws} winLabel="W" lossLabel="L" drawLabel="D" /></dd>
                <dt className="text-zinc-500">{t('admin.fighters.available')}:</dt>
                <dd className="text-zinc-700">{fighter.is_available ? t('admin.fighters.yes') : t('admin.fighters.no')}</dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">
                {fighter.has_manager && <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700">{t('admin.fighters.roles.manager')}</span>}
                {fighter.has_promoter && <span className="text-xs font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700">{t('admin.fighters.roles.promoter')}</span>}
                {fighter.has_sponsor && <span className="text-xs font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700">{t('admin.fighters.roles.sponsor')}</span>}
              </div>
              <div className="mt-3 border-t border-zinc-100 pt-3">
                {(missingFieldsByFighterId.get(fighter.id) ?? []).length > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-amber-700">{t('admin.fighters.profileIncomplete')}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {(missingFieldsByFighterId.get(fighter.id) ?? [])
                        .map((field) => t(`admin.fighters.missingFields.${field}`))
                        .join(' · ')}
                    </p>
                    <button
                      type="button"
                      onClick={() => openReminderPreview(fighter)}
                      disabled={reminderSentIds.has(fighter.id)}
                      className="mt-2 text-xs font-bold text-[#C0001E] hover:underline disabled:text-emerald-700 disabled:no-underline"
                    >
                      {reminderSentIds.has(fighter.id)
                        ? t('admin.fighters.reminderSent')
                        : t('admin.fighters.previewReminder')}
                    </button>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-emerald-700">{t('admin.fighters.profileComplete')}</p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-wrap gap-4">
                {fighter.verified ? (
                  <button onClick={() => setConfirm({ fighterId: fighter.id, action: 'unverify' })} className="text-xs font-medium text-zinc-500 hover:underline">{t('admin.fighters.unverify')}</button>
                ) : (
                  <button onClick={() => setConfirm({ fighterId: fighter.id, action: 'verify' })} className="text-xs font-medium text-emerald-700 hover:underline">{t('admin.fighters.verify')}</button>
                )}
                {fighter.is_hidden ? (
                  <button onClick={() => setConfirm({ fighterId: fighter.id, action: 'unhide' })} className="text-xs font-medium text-blue-600 hover:underline">{t('admin.fighters.show')}</button>
                ) : (
                  <button onClick={() => setConfirm({ fighterId: fighter.id, action: 'hide' })} className="text-xs font-medium text-red-500 hover:underline">{t('admin.fighters.hide')}</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table - registered */}
        <div className="hidden sm:block bg-white border border-zinc-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {['name', 'email', 'phone', 'city', 'weightClass', 'record', 'available', 'verified', 'visible', 'profileStatus', 'rep', 'actions'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide"
                  >
                    {col === 'rep' ? t('admin.fighters.representation') : col === 'phone' ? t('admin.fighters.phone') : col === 'visible' ? t('admin.fighters.visible') : t(`admin.fighters.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {fighters.map((fighter) => (
                <React.Fragment key={fighter.id}>
                <tr className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                    <Link href={fighterPublicPath(fighter)} className="text-[#C0001E] hover:underline font-bold">
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
                    <InlineCombatRecord wins={fighter.record_wins} losses={fighter.record_losses} draws={fighter.record_draws} winLabel="W" lossLabel="L" drawLabel="D" />
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
                  <td className="px-4 py-3 align-top">
                    {(missingFieldsByFighterId.get(fighter.id) ?? []).length > 0 ? (
                      <div className="max-w-48">
                        <p className="text-xs font-semibold text-amber-700">{t('admin.fighters.profileIncomplete')}</p>
                        <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                          {(missingFieldsByFighterId.get(fighter.id) ?? [])
                            .map((field) => t(`admin.fighters.missingFields.${field}`))
                            .join(' · ')}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-700">{t('admin.fighters.profileComplete')}</span>
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
                      {(missingFieldsByFighterId.get(fighter.id) ?? []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => openReminderPreview(fighter)}
                          disabled={reminderSentIds.has(fighter.id)}
                          className="text-xs font-medium text-[#C0001E] hover:underline disabled:text-emerald-700 disabled:no-underline"
                        >
                          {reminderSentIds.has(fighter.id)
                            ? t('admin.fighters.reminderSent')
                            : t('admin.fighters.previewReminder')}
                        </button>
                      )}
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
                        {REP_LABELS.map((key) => {
                          const has = fighter[`has_${key}` as keyof typeof fighter] as boolean;
                          const name = fighter[`${key}_name` as keyof typeof fighter] as string | null;
                          const email = fighter[`${key}_email` as keyof typeof fighter] as string | null;
                          const phone = fighter[`${key}_phone` as keyof typeof fighter] as string | null;
                          return (
                            <div key={key} className="border border-zinc-200 p-3">
                              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: has ? '#C0001E' : '#9A9A9A' }}>{t(`admin.fighters.roles.${key}`)}</p>
                              {has ? (
                                <div className="space-y-1 text-xs text-zinc-700">
                                  <p><span className="font-medium text-zinc-500">{t('admin.fighters.name')}:</span> {name || '---'}</p>
                                  <p><span className="font-medium text-zinc-500">{t('admin.fighters.email')}:</span> {email || '---'}</p>
                                  <p><span className="font-medium text-zinc-500">Tel:</span> {phone || '---'}</p>
                                </div>
                              ) : (
                                <p className="text-xs text-zinc-400">{t('admin.fighters.notRegistered')}</p>
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
        </>
      )
      ) : (
        manualFighters.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-zinc-200 text-zinc-500 text-sm">
            {t('admin.fighters.noManualFighters')}
          </div>
        ) : (
          <>
          {/* Mobile card list - manual */}
          <div className="sm:hidden space-y-3">
            {manualFighters.map((mf) => (
              <div key={mf.id} className="bg-white border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={manualFighterPublicPath(mf)} className="font-bold text-[#C0001E] hover:underline truncate">
                    {mf.full_name}
                  </Link>
                  {mf.profiles?.role === 'manager' && (
                    <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 flex-shrink-0">{t('admin.fighters.roles.manager')}</span>
                  )}
                  {mf.profiles?.role === 'promoter' && (
                    <span className="text-xs font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 flex-shrink-0">{t('admin.fighters.roles.promoter')}</span>
                  )}
                </div>
                {mf.nickname && <p className="mt-1 text-xs text-zinc-400">“{mf.nickname}”</p>}
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-zinc-500">{t('admin.fighters.addedBy')}:</dt>
                  <dd className="text-zinc-700">{mf.profiles?.full_name ?? '—'}</dd>
                  <dt className="text-zinc-500">{t('admin.fighters.weightClass')}:</dt>
                  <dd className="text-zinc-700">{mf.weight_class ?? '—'}</dd>
                  <dt className="text-zinc-500">Record:</dt>
                  <dd className="text-zinc-700"><InlineCombatRecord wins={mf.record_wins} losses={mf.record_losses} draws={mf.record_draws} winLabel="W" lossLabel="L" drawLabel="D" /></dd>
                  <dt className="text-zinc-500">{t('admin.fighters.city')}:</dt>
                  <dd className="text-zinc-700">{mf.city ?? '—'}</dd>
                </dl>
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <Link href={manualFighterPublicPath(mf)} className="text-xs font-medium text-zinc-700 hover:text-[#C0001E] hover:underline">
                    {t('admin.fighters.viewProfile')} →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table - manual */}
          <div className="hidden sm:block bg-white border border-zinc-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  {['name', 'addedBy', 'role', 'creatorEmail', 'weightClass', 'record', 'city', 'available', 'actions'].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide"
                    >
                      {t(`admin.fighters.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {manualFighters.map((mf) => (
                  <tr key={mf.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                      <Link href={manualFighterPublicPath(mf)} className="text-[#C0001E] hover:underline font-bold">
                        {mf.full_name}
                      </Link>
                      {mf.nickname && (
                        <span className="ml-2 text-xs text-zinc-400">“{mf.nickname}”</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">
                      {mf.profiles?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {mf.profiles?.role === 'manager' && (
                        <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700">{t('admin.fighters.roles.manager')}</span>
                      )}
                      {mf.profiles?.role === 'promoter' && (
                        <span className="text-xs font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700">{t('admin.fighters.roles.promoter')}</span>
                      )}
                      {!mf.profiles?.role && <span className="text-xs text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                      {mf.profiles?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                      {mf.weight_class ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                      <InlineCombatRecord wins={mf.record_wins} losses={mf.record_losses} draws={mf.record_draws} winLabel="W" lossLabel="L" drawLabel="D" />
                    </td>
                    <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                      {mf.city ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                        mf.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {mf.is_available ? t('admin.fighters.yes') : t('admin.fighters.no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={manualFighterPublicPath(mf)}
                        className="text-xs font-medium text-zinc-700 hover:text-[#C0001E] hover:underline"
                      >
                        {t('admin.fighters.viewProfile')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )
      )}

      {reminderPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col bg-white shadow-xl">
            <div className="border-b border-zinc-200 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-zinc-950">{t('admin.fighters.emailPreviewTitle')}</h2>
              <dl className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">
                <div>
                  <dt className="font-bold uppercase tracking-wide text-zinc-400">{t('admin.fighters.emailTo')}</dt>
                  <dd className="mt-0.5 break-all">{reminderPreview.fighterName} · {reminderPreview.recipientEmail}</dd>
                </div>
                <div>
                  <dt className="font-bold uppercase tracking-wide text-zinc-400">{t('admin.fighters.emailLanguage')}</dt>
                  <dd className="mt-0.5 uppercase">{reminderPreview.language}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-bold uppercase tracking-wide text-zinc-400">{t('admin.fighters.emailSubject')}</dt>
                  <dd className="mt-0.5 font-semibold text-zinc-800">{reminderPreview.subject}</dd>
                </div>
              </dl>
            </div>
            <iframe
              title={t('admin.fighters.emailPreviewFrameTitle')}
              srcDoc={reminderPreview.html}
              sandbox=""
              className="h-[60vh] w-full bg-zinc-100"
            />
            <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={() => setReminderPreview(null)}
                disabled={remindingId === reminderPreview.fighterId}
                className="min-h-11 border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50"
              >
                {t('admin.fighters.closePreview')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const sent = await handleProfileReminder(reminderPreview.fighterId);
                  if (sent) setReminderPreview(null);
                }}
                disabled={remindingId === reminderPreview.fighterId}
                className="min-h-11 bg-[#C0001E] px-5 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
              >
                {remindingId === reminderPreview.fighterId
                  ? t('admin.fighters.sendingReminder')
                  : t('admin.fighters.sendReminder')}
              </button>
            </div>
          </div>
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
                ? t('admin.fighters.confirmHide')
                : t('admin.fighters.confirmShow')}
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
