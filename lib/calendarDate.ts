const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/**
 * Formats a database DATE value as a local calendar date without applying a
 * timezone conversion. Parsing YYYY-MM-DD with `new Date(value)` treats it as
 * UTC and can display the previous day in timezones west of UTC.
 */
export function formatCalendarDate(
  value: string,
  locales: Intl.LocalesArgument = 'es-MX',
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return value;
  }

  return date.toLocaleDateString(locales, options);
}
