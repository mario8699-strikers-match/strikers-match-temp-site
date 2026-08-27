import { PromotersPageClient } from '@/components/PromotersPageClient';
import { getPublicPromotersForPage } from '@/lib/seoData';

export const revalidate = 300;

export default async function PromotersPage() {
  const promoters = await getPublicPromotersForPage();
  return <PromotersPageClient initialPromoters={promoters} />;
}
