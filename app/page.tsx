import { HomePageClient } from '@/components/HomePageClient';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Comunidad internacional de deportes de combate',
  description: 'Donde se conecta la comunidad de los deportes de combate. Encuentra atletas, peleas y eventos en un solo lugar.',
  path: '/',
});

export default function Home() {
  return <HomePageClient />;
}
