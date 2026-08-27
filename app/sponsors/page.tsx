import { SponsorsPageClient } from '@/components/SponsorsPageClient';
import { getPublicSponsorsForPage } from '@/lib/seoData';

export const revalidate = 300;

export default async function SponsorsPage() {
  const sponsors = await getPublicSponsorsForPage();
  return <SponsorsPageClient initialSponsors={sponsors} />;
}
