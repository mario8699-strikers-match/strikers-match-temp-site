import { DirectoryPageClient } from '@/components/DirectoryPageClient';
import { StructuredData } from '@/components/StructuredData';
import { absoluteUrl } from '@/lib/seo';
import { getPublicDirectoryForPage } from '@/lib/seoData';

export const revalidate = 300;

export default async function DirectoryPage() {
  const { listings, profiles } = await getPublicDirectoryForPage();
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Directorio de boxeo y MMA en México',
    itemListElement: profiles.map((profile, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: profile.full_name,
      url: absoluteUrl(`/professionals/${profile.id}`),
    })),
  };

  return (
    <>
      <StructuredData data={itemList} />
      <DirectoryPageClient initialListings={listings} initialProfiles={profiles} />
    </>
  );
}
