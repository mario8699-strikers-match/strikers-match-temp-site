'use client';

import {
  GENERIC_WEIGHT_CLASS_OPTIONS,
  getCombatWeightGroups,
  sanitizeWeightClasses,
} from '@/lib/combatWeightCategories';

interface EventWeightCategorySelectorProps {
  disciplines: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  defaultAllSelected?: boolean;
}

export function EventWeightCategorySelector({
  disciplines,
  selected,
  onChange,
  defaultAllSelected = false,
}: EventWeightCategorySelectorProps) {
  const selectedCategories = sanitizeWeightClasses(selected);
  const disciplineSections = disciplines.map((discipline) => ({
    discipline,
    groups: getCombatWeightGroups(discipline),
  }));
  const genericDisciplines = disciplineSections
    .filter(({ groups }) => groups.length === 0)
    .map(({ discipline }) => discipline);

  const toggle = (weightClass: string) => {
    onChange(selectedCategories.includes(weightClass)
      ? selectedCategories.filter((value) => value !== weightClass)
      : [...selectedCategories, weightClass]);
  };

  const toggleGroup = (weightClasses: string[]) => {
    const groupWeightClasses = sanitizeWeightClasses(weightClasses);
    const allSelected = groupWeightClasses.every((weightClass) => selectedCategories.includes(weightClass));
    onChange(allSelected
      ? selectedCategories.filter((weightClass) => !groupWeightClasses.includes(weightClass))
      : sanitizeWeightClasses([...selectedCategories, ...groupWeightClasses]));
  };

  if (disciplines.length === 0) {
    return <p className="text-xs italic text-zinc-400">Selecciona una disciplina para ver las categorías por edad y peso.</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-500">
        {defaultAllSelected
          ? 'Todas las categorías de edad se abren automáticamente. Haz clic en una categoría para abrir o cerrar todos sus pesos.'
          : 'Selecciona las categorías de edad que tendrá el evento. Cada categoría abre todos sus pesos.'}
      </p>
      {disciplineSections.filter(({ groups }) => groups.length > 0).map(({ discipline, groups }) => (
        <section key={discipline} className="border border-zinc-200 p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-800">{discipline}</p>
          <div className="space-y-3">
            {groups.map((group) => (
              <WeightGroupSelector
                key={`${discipline}:${group.group}`}
                label={group.group}
                weightClasses={group.weights}
                selectedCategories={selectedCategories}
                onToggleGroup={() => toggleGroup(group.weights)}
                onToggleWeight={toggle}
              />
            ))}
          </div>
        </section>
      ))}
      {genericDisciplines.length > 0 && (
        <section className="border border-zinc-200 p-4">
          <p className="mb-1 text-xs font-black uppercase tracking-widest text-zinc-800">Otras disciplinas</p>
          <p className="mb-3 text-xs text-zinc-500">{genericDisciplines.join(', ')}</p>
          <WeightGroupSelector
            label="Todas las categorías de peso"
            weightClasses={GENERIC_WEIGHT_CLASS_OPTIONS.slice(1).map(([value]) => value)}
            weightLabels={Object.fromEntries(GENERIC_WEIGHT_CLASS_OPTIONS.slice(1))}
            selectedCategories={selectedCategories}
            onToggleGroup={() => toggleGroup(GENERIC_WEIGHT_CLASS_OPTIONS.slice(1).map(([value]) => value))}
            onToggleWeight={toggle}
          />
        </section>
      )}
      {selectedCategories.length > 0 && (
        <p className="text-xs font-semibold text-zinc-700">{selectedCategories.length} categorías seleccionadas</p>
      )}
    </div>
  );
}

function WeightGroupSelector({
  label,
  weightClasses,
  weightLabels = {},
  selectedCategories,
  onToggleGroup,
  onToggleWeight,
}: {
  label: string;
  weightClasses: string[];
  weightLabels?: Record<string, string>;
  selectedCategories: string[];
  onToggleGroup: () => void;
  onToggleWeight: (weightClass: string) => void;
}) {
  const normalizedWeightClasses = sanitizeWeightClasses(weightClasses);
  const selectedCount = normalizedWeightClasses.filter((weightClass) => selectedCategories.includes(weightClass)).length;
  const allSelected = selectedCount === normalizedWeightClasses.length;
  const partiallySelected = selectedCount > 0 && !allSelected;

  return (
    <div className="border border-zinc-200 bg-zinc-50/60 p-3">
      <button
        type="button"
        onClick={onToggleGroup}
        aria-pressed={allSelected}
        className={`flex min-h-11 w-full items-center justify-between gap-3 border px-3 py-2 text-left transition-colors ${
          allSelected
            ? 'border-[#C0001E] bg-[#C0001E] text-white'
            : partiallySelected
              ? 'border-[#C0001E] bg-red-50 text-[#9F0019]'
              : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500'
        }`}
      >
        <span className="text-xs font-black uppercase tracking-wider">{label}</span>
        <span className={`shrink-0 text-[11px] font-bold uppercase tracking-wide ${
          allSelected ? 'text-white/80' : partiallySelected ? 'text-[#9F0019]' : 'text-zinc-400'
        }`}>
          {allSelected ? 'Todos los pesos abiertos' : partiallySelected ? `${selectedCount} de ${normalizedWeightClasses.length}` : 'Cerrada'}
        </span>
      </button>

      <details className="mt-2 group">
        <summary className="min-h-11 cursor-pointer list-none py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C0001E]">
          <span className="inline-flex items-center gap-2">
            <span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span>
            Personalizar pesos ({selectedCount}/{normalizedWeightClasses.length})
          </span>
        </summary>
        <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3">
          {normalizedWeightClasses.map((weightClass) => (
            <CategoryButton
              key={weightClass}
              label={weightLabels[weightClass] ?? weightClass}
              selected={selectedCategories.includes(weightClass)}
              onClick={() => onToggleWeight(weightClass)}
            />
          ))}
        </div>
      </details>
    </div>
  );
}

function CategoryButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1.5 text-xs font-bold tracking-wide transition-colors ${
        selected
          ? 'border-[#C0001E] bg-[#C0001E] text-white'
          : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500'
      }`}
    >
      {label}
    </button>
  );
}
