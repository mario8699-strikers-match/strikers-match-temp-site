'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { countryFlagEmoji, type CountryOption } from '@/lib/countries';

type CountrySearchSelectProps = {
  value: string;
  onChange: (countryCode: string) => void;
  options: CountryOption[];
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  ariaLabel?: string;
  className?: string;
};

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
}

export function CountrySearchSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  ariaLabel,
  className = '',
}: CountrySearchSelectProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = useMemo(
    () => options.find((option) => option.code === value),
    [options, value],
  );
  const selectedLabel = selectedOption
    ? `${countryFlagEmoji(selectedOption.code)} ${selectedOption.label}`
    : '';

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return options;
    return options.filter((option) => (
      normalizeSearchValue(option.label).includes(normalizedQuery)
      || option.code.toLocaleLowerCase().includes(normalizedQuery)
    ));
  }, [options, query]);

  function choose(countryCode: string) {
    onChange(countryCode);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        value={open ? query : selectedLabel}
        placeholder={open ? searchPlaceholder : placeholder}
        onFocus={(event) => {
          setOpen(true);
          setQuery('');
          setActiveIndex(0);
          event.currentTarget.select();
        }}
        onBlur={() => {
          setOpen(false);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
            event.preventDefault();
            choose(filteredOptions[activeIndex].code);
          } else if (event.key === 'Escape') {
            setOpen(false);
            setQuery('');
            inputRef.current?.blur();
          }
        }}
        className="w-full border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={placeholder}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen(true);
          setQuery('');
          setActiveIndex(0);
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
        className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-zinc-500"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4">
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto border border-zinc-300 bg-white py-1 shadow-xl"
          onMouseDown={(event) => event.preventDefault()}
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => choose('')}
            className="block w-full px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-100"
          >
            {placeholder}
          </button>
          {filteredOptions.length > 0 ? filteredOptions.map((option, index) => (
            <button
              key={option.code}
              type="button"
              role="option"
              aria-selected={option.code === value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option.code)}
              className={`block w-full px-3 py-2 text-left text-sm ${
                index === activeIndex ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-700'
              }`}
            >
              <span aria-hidden="true" className="mr-2">{countryFlagEmoji(option.code)}</span>
              {option.label}
            </button>
          )) : (
            <p className="px-3 py-3 text-sm text-zinc-500">{noResultsLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
