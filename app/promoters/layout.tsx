import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Promotores de boxeo y deportes de combate en México',
  description: 'Directorio de promotores independientes y federados que organizan eventos de boxeo y deportes de combate en México.',
  path: '/promoters',
});

export default function PromotersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
