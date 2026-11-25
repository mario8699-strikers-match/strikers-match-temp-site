import { normalizeDiscipline } from '@/lib/disciplines';
import type { FighterDisciplineRecord } from '@/types';

export type CombatRecordValues = {
  wins: number;
  losses: number;
  draws: number;
};

export type DisciplineRecordDraft = Record<string, {
  wins: string;
  losses: string;
  draws: string;
}>;

export const EMPTY_COMBAT_RECORD: CombatRecordValues = { wins: 0, losses: 0, draws: 0 };

function recordKey(discipline: string) {
  return (normalizeDiscipline(discipline) ?? discipline.trim()).toLocaleLowerCase();
}

function nonNegativeInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function getDisciplineRecord(
  records: FighterDisciplineRecord[] | null | undefined,
  discipline: string,
  fallback: CombatRecordValues = EMPTY_COMBAT_RECORD,
): CombatRecordValues {
  const key = recordKey(discipline);
  const match = records?.find((record) => recordKey(record.discipline) === key);
  if (!match) return fallback;
  return {
    wins: nonNegativeInteger(match.wins),
    losses: nonNegativeInteger(match.losses),
    draws: nonNegativeInteger(match.draws),
  };
}

export function buildDisciplineRecordDraft(
  disciplines: string[],
  records: FighterDisciplineRecord[] | null | undefined,
  fallback: CombatRecordValues = EMPTY_COMBAT_RECORD,
): DisciplineRecordDraft {
  return Object.fromEntries(disciplines.map((discipline, index) => {
    const record = getDisciplineRecord(records, discipline, index === 0 ? fallback : EMPTY_COMBAT_RECORD);
    return [discipline, {
      wins: String(record.wins),
      losses: String(record.losses),
      draws: String(record.draws),
    }];
  }));
}

export function disciplineRecordRows(
  disciplines: string[],
  draft: DisciplineRecordDraft,
  fallback: CombatRecordValues = EMPTY_COMBAT_RECORD,
) {
  return disciplines.map((discipline, index) => {
    const values = draft[discipline];
    return {
      discipline,
      wins: nonNegativeInteger(values?.wins ?? (index === 0 ? fallback.wins : 0)),
      losses: nonNegativeInteger(values?.losses ?? (index === 0 ? fallback.losses : 0)),
      draws: nonNegativeInteger(values?.draws ?? (index === 0 ? fallback.draws : 0)),
    };
  });
}

export function primaryDisciplineRecord(
  disciplines: string[],
  draft: DisciplineRecordDraft,
  fallback: CombatRecordValues = EMPTY_COMBAT_RECORD,
) {
  return disciplineRecordRows(disciplines, draft, fallback)[0] ?? fallback;
}
