import { FightersPageClient, type FighterDirectoryEntry } from '@/components/FightersPageClient';
import { StructuredData } from '@/components/StructuredData';
import { absoluteUrl } from '@/lib/seo';
import { getPublicFightersForPage } from '@/lib/seoData';

export const revalidate = 300;

export default async function FightersPage() {
  const { registered, manual } = await getPublicFightersForPage();
  const initialEntries: FighterDirectoryEntry[] = [
    ...registered.map((fighter) => ({ kind: 'registered' as const, data: fighter })),
    ...manual.map((fighter) => ({ kind: 'manual' as const, data: fighter })),
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Peleadores de boxeo y MMA en México',
    itemListElement: initialEntries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.kind === 'manual' ? entry.data.full_name : entry.data.profiles?.full_name,
      url: absoluteUrl(entry.kind === 'manual' ? `/fighters/manual/${entry.data.id}` : `/fighters/${entry.data.id}`),
    })),
  };

  return (
    <>
      <StructuredData data={itemList} />
      <FightersPageClient initialEntries={initialEntries} />
    </>
  );
}
