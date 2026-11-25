'use client';

import { useTranslation } from 'react-i18next';
import { disciplineI18nKey } from '@/lib/disciplines';
import type { DisciplineRecordDraft } from '@/lib/disciplineRecords';

type DisciplineRecordEditorProps = {
  disciplines: string[];
  value: DisciplineRecordDraft;
  onChange: (nextValue: DisciplineRecordDraft) => void;
};

function digitsOnly(value: string) {
  return value.replace(/\D+/g, '');
}

export function DisciplineRecordEditor({ disciplines, value, onChange }: DisciplineRecordEditorProps) {
  const { t } = useTranslation('fighters');

  if (disciplines.length === 0) {
    return <p className="text-sm text-zinc-500">{t('fighters.accountProfile.selectDisciplineForRecord')}</p>;
  }

  return (
    <div className="space-y-4">
      {disciplines.map((discipline) => {
        const translationKey = disciplineI18nKey(discipline);
        const localizedDiscipline = translationKey
          ? t(`fighters.disciplines.${translationKey}`, { defaultValue: discipline })
          : discipline;
        const record = value[discipline] ?? { wins: '0', losses: '0', draws: '0' };
        return (
          <fieldset key={discipline} className="border border-zinc-200 p-4">
            <legend className="px-2 text-xs font-bold uppercase tracking-widest text-zinc-700">
              {localizedDiscipline} · {t('fighters.accountProfile.recordLabel')}
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {([
                ['wins', t('fighters.accountProfile.wins')],
                ['losses', t('fighters.accountProfile.losses')],
                ['draws', t('fighters.accountProfile.draws')],
              ] as const).map(([field, label]) => (
                <label key={field}>
                  <span className="mb-1 block text-xs text-zinc-500">{label}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={record[field]}
                    onChange={(event) => onChange({
                      ...value,
                      [discipline]: { ...record, [field]: digitsOnly(event.target.value) },
                    })}
                    className="w-full border border-zinc-300 px-3 py-2 text-center text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
