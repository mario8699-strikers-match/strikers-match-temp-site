import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Atletas de boxeo, MMA y deportes de combate',
  description: 'Encuentra atletas de boxeo, MMA y deportes de combate por disciplina, división, experiencia, ubicación y disponibilidad para viajar.',
  path: '/fighters',
});

export default function FightersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
