import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Promotores de boxeo y deportes de combate',
  description: 'Directorio internacional de promotores independientes y federados que organizan eventos de boxeo y otros deportes de combate.',
  path: '/promoters',
});

export default function PromotersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
