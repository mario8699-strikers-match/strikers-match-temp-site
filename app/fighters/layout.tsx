import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Peleadores internacionales de boxeo y deportes de combate',
  description: 'Encuentra peleadores de boxeo, MMA, Muay Thai, kickboxing, K-1 y bare knuckle por disciplina, división, experiencia, país y disponibilidad.',
  path: '/fighters',
});

export default function FightersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
