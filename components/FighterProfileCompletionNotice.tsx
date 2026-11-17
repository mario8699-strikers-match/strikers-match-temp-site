'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { FighterRegistrationProfileField } from '@/lib/fighterRegistrationProfile';

export function FighterProfileCompletionNotice({
  missingFields,
}: {
  missingFields: FighterRegistrationProfileField[];
}) {
  const { t } = useTranslation('events');

  if (missingFields.length === 0) return null;

  return (
    <div className="border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-950">
        {t('events.registration.profileRequiredTitle')}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-900">
        {t('events.registration.profileRequiredBody')}
      </p>
      <ul className="mt-3 grid gap-1 text-xs text-amber-950 sm:grid-cols-2">
        {missingFields.map((field) => (
          <li key={field} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-0.5 font-bold text-[#C0001E]">•</span>
            <span>{t(`events.registration.missing.${field}`)}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/fighter/profile"
        className="mt-4 inline-flex min-h-11 items-center bg-zinc-950 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#C0001E]"
      >
        {t('events.registration.completeProfile')}
      </Link>
    </div>
  );
}
