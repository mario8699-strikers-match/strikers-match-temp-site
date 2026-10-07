export const DISCIPLINE_OPTIONS: readonly string[] = [
  'Boxeo',
  'Muay Thai',
  'MMA',
  'Kickboxing',
  'Karate',
  'Judo',
  'Lucha Libre',
  'Lima Lama',
  'Jiu-Jitsu',
  'Point Fight',
  'Bare Knuckle',
  'K1',
  'Light Contact',
  'Kick Light',
  'Low Kick',
  'Full Contact',
  'Otro',
];

const CANONICAL_DISCIPLINES = new Map(
  DISCIPLINE_OPTIONS.map((discipline) => [discipline.toLocaleLowerCase('es-MX'), discipline])
);

export function normalizeDiscipline(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return CANONICAL_DISCIPLINES.get(trimmed.toLocaleLowerCase('es-MX')) ?? trimmed;
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
    const key = discipline.toLocaleLowerCase('es-MX');
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
  const selectedKey = normalizeDiscipline(selected)?.toLocaleLowerCase('es-MX');
  if (!selectedKey) return true;
  return normalizeDisciplineList(disciplines, fallback)
    .some((discipline) => discipline.toLocaleLowerCase('es-MX') === selectedKey);
}

export function sortDisciplines(values: Iterable<string>): string[] {
  const canonicalOrder = new Map(
    DISCIPLINE_OPTIONS.map((discipline, index) => [discipline.toLocaleLowerCase('es-MX'), index])
  );

  return normalizeDisciplineList(Array.from(values)).sort((disciplineA, disciplineB) => {
    const orderA = canonicalOrder.get(disciplineA.toLocaleLowerCase('es-MX')) ?? Number.MAX_SAFE_INTEGER;
    const orderB = canonicalOrder.get(disciplineB.toLocaleLowerCase('es-MX')) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return disciplineA.localeCompare(disciplineB, 'es', { sensitivity: 'base' });
  });
}
