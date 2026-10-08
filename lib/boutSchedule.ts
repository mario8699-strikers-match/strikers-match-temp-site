export function toLocalDateTimeInputValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (part: number) => String(part).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatBoutScheduledTime(
  value: string | null | undefined,
  locales: Intl.LocalesArgument = 'es-MX',
) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locales, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatBoutScheduledDateTime(
  value: string | null | undefined,
  locales: Intl.LocalesArgument = 'es-MX',
) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locales, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
