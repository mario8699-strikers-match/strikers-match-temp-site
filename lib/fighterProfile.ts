import { GENERIC_WEIGHT_CLASS_OPTIONS } from '@/lib/combatWeightCategories';
import { normalizeDisciplineList } from '@/lib/disciplines';

const LEGACY_WEIGHT_LABELS = new Map(
  GENERIC_WEIGHT_CLASS_OPTIONS
    .filter(([value]) => Boolean(value))
    .map(([value, label]) => [value, label]),
);

export function getPrimaryDiscipline(
  disciplines: Array<string | null | undefined> | null | undefined,
  fallback?: string | null,
) {
  return normalizeDisciplineList(disciplines, fallback)[0] ?? null;
}

export function getPublicWeightDisplay(
  weightClass?: string | null,
  exactWeight?: number | null,
) {
  const normalizedClass = weightClass?.trim();
  if (normalizedClass) return LEGACY_WEIGHT_LABELS.get(normalizedClass) ?? normalizedClass;
  if (exactWeight != null && Number.isFinite(exactWeight)) return `${exactWeight} kg`;
  return null;
}
