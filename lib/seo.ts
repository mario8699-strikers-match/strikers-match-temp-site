import type { Metadata } from 'next';

export const SITE_NAME = 'Strikers Match';
export const SITE_URL = 'https://strikersmatch.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`;

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
      locale: 'es_MX',
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

export function truncateDescription(value: string, maxLength = 155): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
