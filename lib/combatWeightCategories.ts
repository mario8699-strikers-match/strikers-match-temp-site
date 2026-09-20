export interface CombatWeightGroup {
  group: string;
  minimumAge: number;
  maximumAge: number | null;
  weights: string[];
}

export const GENERIC_WEIGHT_CLASS_OPTIONS: string[][] = [
  ['', 'Seleccionar categoría…'],
  ['minimosca', 'Minimosca'],
  ['mosca', 'Mosca'],
  ['supermosca', 'Supermosca'],
  ['gallo', 'Gallo'],
  ['supergallo', 'Supergallo'],
  ['pluma', 'Pluma'],
  ['superpluma', 'Superpluma'],
  ['ligero', 'Ligero'],
  ['superligero', 'Superligero'],
  ['welter', 'Welter'],
  ['superwelter', 'Superwelter'],
  ['medio', 'Medio'],
  ['supermedio', 'Supermedio'],
  ['semipesado', 'Semipesado'],
  ['crucero', 'Crucero'],
  ['pesado', 'Pesado'],
];

export const DISCIPLINE_OPTIONS = [
  'Boxeo', 'Muay Thai', 'MMA', 'Kickboxing', 'Karate', 'Judo', 'Lucha Libre',
  'Lima Lama', 'Jiu-Jitsu', 'Point Fight', 'Bare Knuckle', 'K1',
  'Light Contact', 'Kick Light', 'Low Kick', 'Full Contact', 'Otro',
];

const LEGACY_MULTIPLE_WEIGHT_CLASS = 'multiple';

export function sanitizeWeightClasses(values: Array<string | null | undefined> | null | undefined): string[] {
  return Array.from(new Set(
    (values ?? [])
      .map((value) => value?.trim() ?? '')
      .filter((value) => value && value.toLowerCase() !== LEGACY_MULTIPLE_WEIGHT_CLASS)
  ));
}

export function sanitizeWeightClass(value: string | null | undefined): string | null {
  const sanitized = value?.trim() ?? '';
  return sanitized && sanitized.toLowerCase() !== LEGACY_MULTIPLE_WEIGHT_CLASS ? sanitized : null;
}

export const BOXING_WEIGHT_GROUPS: CombatWeightGroup[] = [
  { group: 'Infantil 6–7 años', minimumAge: 6, maximumAge: 7, weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'] },
  { group: 'Infantil 8–9 años', minimumAge: 8, maximumAge: 9, weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'] },
  { group: 'Infantil 10–11 años', minimumAge: 10, maximumAge: 11, weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'] },
  { group: 'Infantil 12 años', minimumAge: 12, maximumAge: 12, weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'] },
  { group: 'Juvenil 13–14 años (Junior)', minimumAge: 13, maximumAge: 14, weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'] },
  { group: 'Juvenil 15–17 años', minimumAge: 15, maximumAge: 17, weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'] },
  {
    group: 'Adultos 18+ años', minimumAge: 18, maximumAge: null,
    weights: ['48 kg — Mini mosca', '51 kg — Mosca', '54 kg — Gallo', '57 kg — Pluma', '60 kg — Ligero', '63.5 kg — Súper ligero', '67 kg — Welter', '71 kg — Súper welter', '75 kg — Medio', '80 kg — Semi pesado', '86 kg', '92 kg', '+92 kg — Pesado'],
  },
];

export const MUAY_THAI_WEIGHT_GROUPS: CombatWeightGroup[] = [
  { group: 'Infantil 6–7 años', minimumAge: 6, maximumAge: 7, weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'] },
  { group: 'Infantil 8–9 años', minimumAge: 8, maximumAge: 9, weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'] },
  { group: 'Infantil 10–11 años', minimumAge: 10, maximumAge: 11, weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'] },
  { group: 'Infantil 12 años', minimumAge: 12, maximumAge: 12, weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'] },
  { group: 'Juvenil 13–14 años', minimumAge: 13, maximumAge: 14, weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'] },
  { group: 'Juvenil 15–17 años', minimumAge: 15, maximumAge: 17, weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'] },
  { group: 'Adultos 18+ años', minimumAge: 18, maximumAge: null, weights: ['48 kg', '51 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '81 kg', '86 kg', '91 kg', '+91 kg'] },
];

export const MMA_WEIGHT_GROUPS: CombatWeightGroup[] = [
  { group: 'Infantil 6–7 años', minimumAge: 6, maximumAge: 7, weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'] },
  { group: 'Infantil 8–9 años', minimumAge: 8, maximumAge: 9, weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'] },
  { group: 'Infantil 10–11 años', minimumAge: 10, maximumAge: 11, weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'] },
  { group: 'Infantil 12 años', minimumAge: 12, maximumAge: 12, weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'] },
  { group: 'Juvenil 13–14 años', minimumAge: 13, maximumAge: 14, weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'] },
  { group: 'Juvenil 15–17 años', minimumAge: 15, maximumAge: 17, weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'] },
  { group: 'Adultos 18+ años', minimumAge: 18, maximumAge: null, weights: ['52 kg — Mosca', '56.7 kg — Gallo', '61.2 kg — Pluma', '65.8 kg — Ligero', '70.3 kg — Welter', '77.1 kg — Medio', '83.9 kg — Semi pesado', '93 kg — Pesado ligero', '120 kg — Pesado'] },
];

export const K1_WEIGHT_GROUPS: CombatWeightGroup[] = [
  { group: 'Infantil 6–7 años', minimumAge: 6, maximumAge: 7, weights: ['20–22 kg', '23–25 kg', '26–28 kg', '29–31 kg'] },
  { group: 'Infantil 8–9 años', minimumAge: 8, maximumAge: 9, weights: ['24–27 kg', '28–31 kg', '32–35 kg', '36–39 kg'] },
  { group: 'Infantil 10–11 años', minimumAge: 10, maximumAge: 11, weights: ['28–31 kg', '32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg'] },
  { group: 'Infantil 12 años', minimumAge: 12, maximumAge: 12, weights: ['32–35 kg', '36–39 kg', '40–43 kg', '44–47 kg', '48–51 kg'] },
  { group: 'Juvenil 13–14 años', minimumAge: 13, maximumAge: 14, weights: ['40–43 kg', '44–46 kg', '48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63 kg', '66 kg', '70 kg'] },
  { group: 'Juvenil 15–17 años', minimumAge: 15, maximumAge: 17, weights: ['46–48 kg', '50 kg', '52 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '80 kg', '+80 kg'] },
  { group: 'Adultos 18+ años', minimumAge: 18, maximumAge: null, weights: ['51 kg', '54 kg', '57 kg', '60 kg', '63.5 kg', '67 kg', '71 kg', '75 kg', '81 kg', '86 kg', '91 kg', '+91 kg'] },
];

export const BJJ_WEIGHT_GROUPS: CombatWeightGroup[] = [
  { group: 'Infantil 4–5 años', minimumAge: 4, maximumAge: 5, weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Infantil 6–7 años', minimumAge: 6, maximumAge: 7, weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Infantil 8–9 años', minimumAge: 8, maximumAge: 9, weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Infantil 10–11 años', minimumAge: 10, maximumAge: 11, weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Infantil 12 años', minimumAge: 12, maximumAge: 12, weights: ['-20 kg', '21–25 kg', '26–30 kg', '31–35 kg', '36–40 kg', '41–45 kg', '+46 kg'] },
  { group: 'Juvenil 13–14 años', minimumAge: 13, maximumAge: 14, weights: ['-48 kg', '-52 kg', '-57 kg', '-63 kg', '-69 kg', '-75 kg', '-81 kg', '+81 kg'] },
  { group: 'Juvenil 15–17 años', minimumAge: 15, maximumAge: 17, weights: ['-48 kg', '-52 kg', '-57 kg', '-63 kg', '-69 kg', '-75 kg', '-81 kg', '+81 kg'] },
  { group: 'Adultos 18+ años (GI / No-Gi)', minimumAge: 18, maximumAge: null, weights: ['-57 kg — Gallo', '-64 kg — Pluma', '-70 kg — Ligero', '-76 kg — Medio', 'hasta 82.3 kg — Medio pesado', 'hasta 88.3 kg — Pesado', 'hasta 94.3 kg — Super pesado', 'hasta 100.5 kg — Pesadísimo', '+100.5 kg — Ultra pesado / Absoluto'] },
];

const BOXING_STYLE_DISCIPLINES = new Set([
  'Boxeo', 'Kickboxing', 'Light Contact', 'Low Kick', 'Kick Light', 'Point Fight', 'Full Contact',
]);

export function getCombatWeightGroups(discipline: string): CombatWeightGroup[] {
  if (discipline === 'Muay Thai') return MUAY_THAI_WEIGHT_GROUPS;
  if (discipline === 'MMA') return MMA_WEIGHT_GROUPS;
  if (discipline === 'K1') return K1_WEIGHT_GROUPS;
  if (discipline === 'Jiu-Jitsu') return BJJ_WEIGHT_GROUPS;
  if (BOXING_STYLE_DISCIPLINES.has(discipline)) return BOXING_WEIGHT_GROUPS;
  return [];
}

export function calculateAgeOnDate(dateOfBirth: string, eventDate: string | null): number | null {
  if (!dateOfBirth || !eventDate) return null;
  const birthParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  const eventParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate);
  if (!birthParts || !eventParts) return null;

  const birthYear = Number(birthParts[1]);
  const birthMonth = Number(birthParts[2]);
  const birthDay = Number(birthParts[3]);
  const eventYear = Number(eventParts[1]);
  const eventMonth = Number(eventParts[2]);
  const eventDay = Number(eventParts[3]);
  let age = eventYear - birthYear;
  if (eventMonth < birthMonth || (eventMonth === birthMonth && eventDay < birthDay)) age -= 1;
  return age >= 0 ? age : null;
}

export function getCombatWeightGroupsForAge(discipline: string, age: number | null): CombatWeightGroup[] {
  const groups = getCombatWeightGroups(discipline);
  if (age == null) return groups;
  const matching = groups.filter((group) => age >= group.minimumAge && (group.maximumAge == null || age <= group.maximumAge));
  return matching.length > 0 ? matching : groups;
}

export function restrictWeightGroupsToEvent(
  groups: CombatWeightGroup[],
  eventWeightClasses: Array<string | null | undefined> | null | undefined
): CombatWeightGroup[] {
  const configured = sanitizeWeightClasses(eventWeightClasses);
  if (configured.length === 0) return groups;

  const allowed = new Set(configured.map((value) => value.toLowerCase()));
  return groups
    .map((group) => ({
      ...group,
      weights: group.weights.filter((weight) => allowed.has(weight.toLowerCase())),
    }))
    .filter((group) => group.weights.length > 0);
}
