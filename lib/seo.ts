import type { Metadata } from 'next';

export const SITE_NAME = 'Strikers Match';
export const SITE_URL = 'https://strikersmatch.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`;
export const DEFAULT_CONTENT_LANGUAGE = 'es';

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  index?: boolean;
  type?: 'website' | 'profile';
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

export function pageMetadata({
  title,
  description,
  path,
  image,
  index = true,
  type = 'website',
}: PageMetadataOptions): Metadata {
  const canonical = absoluteUrl(path);
  const socialImage = image || DEFAULT_OG_IMAGE;
  const socialTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return {
    title: { absolute: socialTitle },
    description,
    alternates: { canonical },
    robots: index
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type,
      locale: DEFAULT_CONTENT_LANGUAGE,
      url: canonical,
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      images: [{ url: socialImage, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [socialImage],
    },
  };
}

export function formatSeoDate(value?: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function timeZoneOffsetMinutes(timeZone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return Math.round((zonedAsUtc - instant) / 60_000);
}

/** Produces an ISO 8601 date-time with the event's real UTC offset. */
export function schemaEventStartDate(
  date?: string | null,
  time?: string | null,
  timeZone?: string | null,
): string | undefined {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  if (!time) return date;

  const timeMatch = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return date;
  const normalizedTime = `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3] ?? '00'}`;
  if (!timeZone) return `${date}T${normalizedTime}`;

  try {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute, second] = normalizedTime.split(':').map(Number);
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const firstOffset = timeZoneOffsetMinutes(timeZone, localAsUtc);
    const eventInstant = localAsUtc - firstOffset * 60_000;
    const offset = timeZoneOffsetMinutes(timeZone, eventInstant);
    const sign = offset >= 0 ? '+' : '-';
    const absoluteOffset = Math.abs(offset);
    const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0');
    const offsetMinutes = String(absoluteOffset % 60).padStart(2, '0');
    return `${date}T${normalizedTime}${sign}${offsetHours}:${offsetMinutes}`;
  } catch {
    return `${date}T${normalizedTime}`;
  }
}

export function truncateDescription(value: string, maxLength = 155): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizedLocationPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function joinLocationParts(parts: Array<string | null | undefined>): string {
  const included: string[] = [];
  const normalizedIncluded: string[] = [];
  for (const rawPart of parts) {
    const part = rawPart?.trim();
    if (!part) continue;
    const normalized = normalizedLocationPart(part);
    if (normalizedIncluded.some((existing) => (
      existing === normalized || (normalized.length >= 4 && existing.includes(normalized))
    ))) continue;
    included.push(part);
    normalizedIncluded.push(normalized);
  }
  return included.join(', ');
}
