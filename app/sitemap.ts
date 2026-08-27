import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getSitemapRecords } from '@/lib/seoData';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /* ── Static public pages ────────────────────────────────────── */
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/events`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/fighters`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/promoters`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/managers`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/sponsors`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/directorio`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/about`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/privacy-policy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const records = await getSitemapRecords();
  const modified = (record: { updated_at?: string | null; created_at?: string | null }) =>
    record.updated_at || record.created_at || undefined;

  return [
    ...staticPages,
    ...records.events.map((event) => ({
      url: `${SITE_URL}/events/${event.id}`,
      lastModified: modified(event),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...records.fighters.map((fighter) => ({
      url: `${SITE_URL}/fighters/${fighter.id}`,
      lastModified: modified(fighter),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...records.manualFighters.map((fighter) => ({
      url: `${SITE_URL}/fighters/manual/${fighter.id}`,
      lastModified: modified(fighter),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...records.professionals.map((profile) => ({
      url: `${SITE_URL}/professionals/${profile.id}`,
      lastModified: modified(profile),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
