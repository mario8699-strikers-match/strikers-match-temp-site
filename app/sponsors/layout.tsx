import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Patrocinadores de boxeo y MMA en México',
  description: 'Conoce patrocinadores que apoyan atletas y eventos de boxeo, MMA y otros deportes de combate en México.',
  path: '/sponsors',
});

export default function SponsorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
