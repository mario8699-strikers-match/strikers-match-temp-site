'use client';

import { useTranslation } from 'react-i18next';
import { RecordValue } from '@/components/CombatRecord';
import { disciplineI18nKey } from '@/lib/disciplines';
import { getDisciplineRecord, type CombatRecordValues } from '@/lib/disciplineRecords';
import type { FighterDisciplineRecord } from '@/types';

type DisciplineRecordSummaryProps = {
  disciplines: string[];
  records?: FighterDisciplineRecord[];
  fallback: CombatRecordValues;
  recordLabel: string;
  variant?: 'hero' | 'profile' | 'compact';
};

export function DisciplineRecordSummary({
  disciplines,
  records,
  fallback,
  recordLabel,
  variant = 'profile',
}: DisciplineRecordSummaryProps) {
  const { t } = useTranslation('fighters');
  const visibleDisciplines = disciplines.length > 0 ? disciplines : [''];

  return (
    <div className={variant === 'compact' ? 'space-y-1.5' : 'space-y-5'}>
      {visibleDisciplines.map((discipline, index) => {
        const translationKey = disciplineI18nKey(discipline);
        const localizedDiscipline = translationKey
          ? t(`fighters.disciplines.${translationKey}`, { defaultValue: discipline })
          : discipline;
        const record = getDisciplineRecord(records, discipline, index === 0 ? fallback : undefined);
        const heading = [localizedDiscipline, recordLabel].filter(Boolean).join(' · ');

        if (variant === 'compact') {
          return (
            <p key={discipline || 'record'} className="text-xs font-semibold text-zinc-600">
              <span className="mr-2 uppercase tracking-wide text-zinc-500">{heading}</span>
              <RecordValue part="wins" value={record.wins} />
              <span className="text-zinc-300">–</span>
              <RecordValue part="losses" value={record.losses} />
              <span className="text-zinc-300">–</span>
              <RecordValue part="draws" value={record.draws} />
            </p>
          );
        }

        return (
          <div key={discipline || 'record'}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">{heading}</p>
            <p className={`mt-2 flex flex-wrap items-baseline gap-2 font-display font-black tracking-[-0.04em] ${
              variant === 'hero' ? 'text-5xl sm:text-6xl' : 'text-3xl'
            }`}>
              <RecordValue part="wins" value={record.wins} />
              <span className="text-zinc-300">–</span>
              <RecordValue part="losses" value={record.losses} />
              <span className="text-zinc-300">–</span>
              <RecordValue part="draws" value={record.draws} />
            </p>
          </div>
        );
      })}
    </div>
  );
}
