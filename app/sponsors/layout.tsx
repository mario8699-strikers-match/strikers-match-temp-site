import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Patrocinadores de boxeo, MMA y deportes de combate',
  description: 'Conoce patrocinadores que apoyan atletas y eventos de boxeo, MMA y otros deportes de combate en distintos países.',
  path: '/sponsors',
});

export default function SponsorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
