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
}

export function EventWeightCategorySelector({
  disciplines,
  selected,
  onChange,
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

  if (disciplines.length === 0) {
    return <p className="text-xs italic text-zinc-400">Selecciona una disciplina para ver las categorías por edad y peso.</p>;
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-500">
        Selecciona todas las categorías que tendrá el evento. Cada peleador recibirá una categoría concreta en Participantes.
      </p>
      {disciplineSections.filter(({ groups }) => groups.length > 0).map(({ discipline, groups }) => (
        <section key={discipline} className="border border-zinc-200 p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-800">{discipline}</p>
          {groups.map((group) => (
            <div key={`${discipline}:${group.group}`} className="mb-4 last:mb-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">{group.group}</p>
              <div className="flex flex-wrap gap-2">
                {group.weights.map((weightClass) => (
                  <CategoryButton
                    key={`${discipline}:${group.group}:${weightClass}`}
                    label={weightClass}
                    selected={selectedCategories.includes(weightClass)}
                    onClick={() => toggle(weightClass)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      {genericDisciplines.length > 0 && (
        <section className="border border-zinc-200 p-4">
          <p className="mb-1 text-xs font-black uppercase tracking-widest text-zinc-800">Otras disciplinas</p>
          <p className="mb-3 text-xs text-zinc-500">{genericDisciplines.join(', ')}</p>
          <div className="flex flex-wrap gap-2">
            {GENERIC_WEIGHT_CLASS_OPTIONS.slice(1).map(([value, label]) => (
              <CategoryButton
                key={value}
                label={label}
                selected={selectedCategories.includes(value)}
                onClick={() => toggle(value)}
              />
            ))}
          </div>
        </section>
      )}
      {selectedCategories.length > 0 && (
        <p className="text-xs font-semibold text-zinc-700">{selectedCategories.length} categorías seleccionadas</p>
      )}
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
