'use client';

interface GenderDivisionCheckboxesProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const OPTIONS = ['Masculino', 'Femenino'] as const;

function canonicalValue(value: string): typeof OPTIONS[number] | '' {
  const normalized = value.trim().toLowerCase();
  if (['masculino', 'masculina', 'hombre', 'varon', 'varón', 'male', 'm'].includes(normalized)) return 'Masculino';
  if (['femenino', 'femenina', 'mujer', 'female', 'f'].includes(normalized)) return 'Femenino';
  return '';
}

export function GenderDivisionCheckboxes({
  value,
  onChange,
  label = 'División de género',
}: GenderDivisionCheckboxesProps) {
  const selected = canonicalValue(value);

  return (
    <fieldset>
      <legend className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-600">{label}</legend>
      <div className="grid min-h-11 grid-cols-2 gap-2">
        {OPTIONS.map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm font-semibold ${
              selected === option
                ? 'border-[#C0001E] bg-red-50 text-[#C0001E]'
                : 'border-zinc-300 bg-white text-zinc-700'
            }`}
          >
            <input
              type="checkbox"
              checked={selected === option}
              onChange={(event) => onChange(event.target.checked ? option : '')}
              className="h-4 w-4 accent-[#C0001E]"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
