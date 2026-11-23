'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import {
  getMissingFighterRegistrationProfileFields,
  getMissingManualFighterProfileFields,
  type FighterRegistrationProfileField,
} from '@/lib/fighterRegistrationProfile';
import {
  buildFighterProfileReminderEmail,
  buildManagedFighterProfileReminderEmail,
  normalizeReminderLanguage,
} from '@/lib/fighterProfileReminderEmail';
import { manualFighterManagementPath } from '@/lib/manualFighterManagement';
import type { FighterWithProfile, ManualFighterWithCreator } from '@/types';

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

type EmailRecipient = {
  key: string;
  kind: 'registered' | 'manual';
  targetId: string;
  fighterName: string;
  recipientName: string;
  email: string;
  language?: string | null;
  isBanned: boolean;
  location: string;
  missingFields: FighterRegistrationProfileField[];
  managerRole?: string;
};

export default function AdminEmailsPage() {
  const { t } = useTranslation('admin');
  const [fighters, setFighters] = useState<FighterWithProfile[]>([]);
  const [manualFighters, setManualFighters] = useState<ManualFighterWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(() => new Set());
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      adminService.getAllFighters(),
      adminService.getAllManualFighters(),
    ]).then(([fighterResult, manualResult]) => {
      if (!active) return;
      if (fighterResult.error || manualResult.error) {
        setLoadError(fighterResult.error ?? manualResult.error);
      } else {
        setFighters(fighterResult.data ?? []);
        setManualFighters(manualResult.data ?? []);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const recipients = useMemo<EmailRecipient[]>(() => [
    ...fighters.map((fighter): EmailRecipient => ({
      key: `registered:${fighter.id}`,
      kind: 'registered',
      targetId: fighter.id,
      fighterName: fighter.profiles.full_name,
      recipientName: fighter.profiles.full_name,
      email: fighter.profiles.email,
      language: fighter.profiles.preferred_language,
      isBanned: Boolean(fighter.profiles.is_banned),
      location: [fighter.profiles.city, fighter.profiles.country].filter(Boolean).join(' '),
      missingFields: getMissingFighterRegistrationProfileFields(fighter, fighter.profiles),
    })),
    ...manualFighters.flatMap((fighter): EmailRecipient[] => fighter.profiles ? [{
      key: `manual:${fighter.id}`,
      kind: 'manual',
      targetId: fighter.id,
      fighterName: fighter.full_name,
      recipientName: fighter.profiles.full_name,
      email: fighter.profiles.email,
      language: fighter.profiles.preferred_language,
      isBanned: Boolean(fighter.profiles.is_banned),
      location: [fighter.city, fighter.country].filter(Boolean).join(' '),
      missingFields: getMissingManualFighterProfileFields(fighter),
      managerRole: fighter.profiles.role,
    }] : []),
  ].filter(({ missingFields }) => missingFields.length > 0), [fighters, manualFighters]);

  const visibleRecipients = useMemo(() => {
    const query = normalizeSearch(search.trim());
    if (!query) return recipients;
    return recipients.filter((recipient) => normalizeSearch([
      recipient.fighterName,
      recipient.recipientName,
      recipient.email,
      recipient.location,
    ].join(' ')).includes(query));
  }, [recipients, search]);

  const effectiveSelectedId = recipients.some((recipient) => recipient.key === selectedId)
    ? selectedId
    : (recipients[0]?.key ?? null);
  const selected = recipients.find((recipient) => recipient.key === effectiveSelectedId) ?? null;
  const preview = useMemo(() => {
    if (!selected || typeof window === 'undefined') return null;
    if (selected.kind === 'manual') {
      return buildManagedFighterProfileReminderEmail({
        recipientName: selected.recipientName,
        fighterName: selected.fighterName,
        language: selected.language,
        missingFields: selected.missingFields,
        profileUrl: `${window.location.origin}${manualFighterManagementPath(selected.managerRole, selected.targetId)}`,
      });
    }
    return buildFighterProfileReminderEmail({
      fullName: selected.fighterName,
      language: selected.language,
      missingFields: selected.missingFields,
      profileUrl: `${window.location.origin}/fighter/profile`,
    });
  }, [selected]);

  const handleSend = async () => {
    if (!selected) return;
    setSendingId(selected.key);
    setSendError(null);
    const result = selected.kind === 'manual'
      ? await adminService.sendManualFighterProfileReminder(selected.targetId)
      : await adminService.sendFighterProfileReminder(selected.targetId);
    setSendingId(null);
    if (result.error) {
      setSendError(result.error);
      return;
    }
    setSentIds((current) => new Set(current).add(selected.key));
  };

  const languageName = (value?: string | null) =>
    t(`admin.emails.languages.${normalizeReminderLanguage(value)}`);

  return (
    <div>
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C0001E]">
          {t('admin.emails.eyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-950">{t('admin.emails.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">{t('admin.emails.subtitle')}</p>
      </div>

      <div className="mb-6 border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-bold text-zinc-950">{t('admin.emails.standardTitle')}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{t('admin.emails.standardBody')}</p>
      </div>

      {loadError && (
        <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-zinc-950">{t('admin.emails.recipients')}</h2>
              <span className="text-xs text-zinc-500">{recipients.length}</span>
            </div>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('admin.emails.searchPlaceholder')}
              className="mt-3 min-h-11 w-full border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900"
            />
          </div>

          <div className="max-h-[680px] overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-sm text-zinc-500">{t('admin.emails.loading')}</p>
            ) : visibleRecipients.length === 0 ? (
              <p className="p-6 text-center text-sm leading-6 text-zinc-500">
                {search ? t('admin.emails.noSearchResults') : t('admin.emails.noRecipients')}
              </p>
            ) : visibleRecipients.map((recipient) => {
              const isSelected = effectiveSelectedId === recipient.key;
              const isDisabled = Boolean(recipient.isBanned || !recipient.email.trim());
              return (
                <button
                  key={recipient.key}
                  type="button"
                  onClick={() => {
                    setSelectedId(recipient.key);
                    setSendError(null);
                  }}
                  className={`block w-full border-b border-zinc-100 p-4 text-left transition-colors ${
                    isSelected ? 'bg-zinc-950 text-white' : 'hover:bg-zinc-50'
                  }`}
                >
                  <span className="block truncate text-sm font-bold">{recipient.fighterName}</span>
                  {recipient.kind === 'manual' && (
                    <span className={`mt-1 block truncate text-[11px] font-semibold uppercase tracking-wide ${isSelected ? 'text-amber-300' : 'text-amber-700'}`}>
                      {t('admin.fighters.manualRosterTab')} · {t('admin.fighters.addedBy')}: {recipient.recipientName}
                    </span>
                  )}
                  <span className={`mt-1 block truncate text-xs ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {recipient.email || t('admin.emails.noEmail')}
                  </span>
                  <span className={`mt-2 block text-xs ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {t('admin.emails.missingCount', { count: recipient.missingFields.length })}
                    {' · '}{languageName(recipient.language)}
                  </span>
                  {isDisabled && (
                    <span className={`mt-2 block text-xs font-semibold ${isSelected ? 'text-amber-300' : 'text-amber-700'}`}>
                      {recipient.isBanned ? t('admin.emails.blockedAccount') : t('admin.emails.noEmail')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 border border-zinc-200 bg-white">
          {!selected || !preview ? (
            <div className="flex min-h-[500px] items-center justify-center p-8 text-center text-sm text-zinc-500">
              {t('admin.emails.selectRecipient')}
            </div>
          ) : (
            <>
              <div className="border-b border-zinc-200 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('admin.emails.preview')}</p>
                    <h2 className="mt-1 truncate text-lg font-bold text-zinc-950">{selected.fighterName}</h2>
                    <dl className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">
                      <div>
                        <dt className="font-bold uppercase tracking-wide text-zinc-400">{t('admin.emails.to')}</dt>
                        <dd className="mt-0.5 break-all">{selected.recipientName} · {selected.email || '—'}</dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wide text-zinc-400">{t('admin.emails.language')}</dt>
                        <dd className="mt-0.5">{languageName(selected.language)}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="font-bold uppercase tracking-wide text-zinc-400">{t('admin.emails.subject')}</dt>
                        <dd className="mt-0.5 font-semibold text-zinc-800">{preview.subject}</dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={
                      sendingId === selected.key ||
                      sentIds.has(selected.key) ||
                      selected.isBanned ||
                      !selected.email.trim()
                    }
                    className="min-h-11 shrink-0 bg-[#C0001E] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {sendingId === selected.key
                      ? t('admin.emails.sending')
                      : sentIds.has(selected.key)
                        ? t('admin.emails.sent')
                        : t('admin.emails.send')}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.missingFields.map((field) => (
                    <span key={field} className="bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      {t(`admin.fighters.missingFields.${field}`)}
                    </span>
                  ))}
                </div>

                {sendError && (
                  <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {sendError}
                  </div>
                )}
              </div>

              <iframe
                title={t('admin.emails.previewFrameTitle')}
                srcDoc={preview.html}
                sandbox=""
                className="h-[620px] w-full bg-zinc-100"
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
