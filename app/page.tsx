import { HomePageClient } from '@/components/HomePageClient';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Comunidad de boxeo y MMA en México',
  description: 'Donde se conecta la comunidad del boxeo y las artes marciales mixtas en México. Encuentra peleas y organiza eventos en un solo lugar.',
  path: '/',
});

export default function Home() {
  return <HomePageClient />;
}
