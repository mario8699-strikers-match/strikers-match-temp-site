const WEIGHT_CLASS_KEYS = new Set([
  'minimosca', 'mosca', 'supermosca', 'gallo', 'supergallo', 'pluma',
  'superpluma', 'ligero', 'superligero', 'welter', 'superwelter', 'medio',
  'supermedio', 'semipesado', 'crucero', 'pesado', 'multiple',
]);

export function fighterWeightClassI18nKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLocaleLowerCase();
  return normalized && WEIGHT_CLASS_KEYS.has(normalized) ? normalized : null;
}

export function fighterGenderI18nKey(value: string | null | undefined): 'male' | 'female' | null {
  const normalized = value?.trim().toLocaleLowerCase();
  if (!normalized) return null;
  if (['masculino', 'masculina', 'hombre', 'varon', 'varón', 'male', 'm'].includes(normalized)) return 'male';
  if (['femenino', 'femenina', 'mujer', 'female', 'f'].includes(normalized)) return 'female';
  return null;
}
