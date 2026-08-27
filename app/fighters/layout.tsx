import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Peleadores de boxeo y MMA en México',
  description: 'Encuentra atletas de boxeo, MMA y deportes de combate en México por disciplina, división, experiencia, ciudad y disponibilidad.',
  path: '/fighters',
});

export default function FightersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
