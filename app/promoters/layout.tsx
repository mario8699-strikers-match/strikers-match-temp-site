import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Promotores internacionales de deportes de combate',
  description: 'Directorio de promotores independientes y federados que organizan eventos de boxeo, MMA, Muay Thai, kickboxing y otros deportes de combate.',
  path: '/promoters',
});

export default function PromotersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
