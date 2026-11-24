export const DISCIPLINE_OPTIONS: readonly string[] = [
  'Boxeo',
  'Muay Thai',
  'MMA',
  'Kickboxing',
  'Karate',
  'Lucha Libre',
  'Bare Knuckle',
  'K1',
  'Light Contact',
  'Low Kick',
];

// Retain legacy values for existing athlete and event records. They are no
// longer offered as platform categories for new profiles, filters, or events.
const LEGACY_DISCIPLINE_OPTIONS: readonly string[] = [
  'Judo',
  'Lima Lama',
  'Jiu-Jitsu',
  'Point Fight',
  'Kick Light',
  'Full Contact',
  'Otro',
];

const ALL_DISCIPLINE_VALUES = [...DISCIPLINE_OPTIONS, ...LEGACY_DISCIPLINE_OPTIONS];

const CANONICAL_DISCIPLINES = new Map(
  ALL_DISCIPLINE_VALUES.map((discipline) => [discipline.toLocaleLowerCase(), discipline])
);

const DISCIPLINE_I18N_KEYS: Readonly<Record<string, string>> = {
  'boxeo': 'boxing',
  'muay thai': 'muayThai',
  'mma': 'mma',
  'kickboxing': 'kickboxing',
  'karate': 'karate',
  'judo': 'judo',
  'lucha libre': 'wrestling',
  'lima lama': 'limaLama',
  'jiu-jitsu': 'jiuJitsu',
  'point fight': 'pointFight',
  'bare knuckle': 'bareKnuckle',
  'k1': 'k1',
  'light contact': 'lightContact',
  'kick light': 'kickLight',
  'low kick': 'lowKick',
  'full contact': 'fullContact',
  'otro': 'other',
};

export function disciplineI18nKey(value: string | null | undefined): string | null {
  const discipline = normalizeDiscipline(value);
  if (!discipline) return null;
  return DISCIPLINE_I18N_KEYS[discipline.toLocaleLowerCase()] ?? null;
}

export function normalizeDiscipline(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return CANONICAL_DISCIPLINES.get(trimmed.toLocaleLowerCase()) ?? trimmed;
}

export function normalizeDisciplineList(
  values: Array<string | null | undefined> | null | undefined,
  fallback?: string | null
): string[] {
  const disciplines: string[] = [];
  const seen = new Set<string>();

  for (const value of [...(values ?? []), fallback]) {
    const discipline = normalizeDiscipline(value);
    if (!discipline) continue;
    const key = discipline.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    disciplines.push(discipline);
  }

  return disciplines;
}

export function disciplineMatches(
  disciplines: Array<string | null | undefined> | null | undefined,
  selected: string,
  fallback?: string | null
): boolean {
  const selectedKey = normalizeDiscipline(selected)?.toLocaleLowerCase();
  if (!selectedKey) return true;
  return normalizeDisciplineList(disciplines, fallback)
    .some((discipline) => discipline.toLocaleLowerCase() === selectedKey);
}

export function sortDisciplines(values: Iterable<string>): string[] {
  const canonicalOrder = new Map(
    ALL_DISCIPLINE_VALUES.map((discipline, index) => [discipline.toLocaleLowerCase(), index])
  );

  return normalizeDisciplineList(Array.from(values)).sort((disciplineA, disciplineB) => {
    const orderA = canonicalOrder.get(disciplineA.toLocaleLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const orderB = canonicalOrder.get(disciplineB.toLocaleLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return disciplineA.localeCompare(disciplineB, 'es', { sensitivity: 'base' });
  });
}
