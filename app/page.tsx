import { HomePageClient } from '@/components/HomePageClient';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Matchmaking y eventos internacionales de deportes de combate',
  description: 'Conecta atletas, gimnasios, representantes y promotores de boxeo, MMA, Muay Thai, kickboxing, K-1 y bare knuckle. Encuentra peleas y organiza eventos.',
  path: '/',
});

export default function Home() {
  return <HomePageClient />;
}
