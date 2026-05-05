import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profesionales de Eventos — Fotógrafos, Cutmen, Jueces y más',
  description:
    'Directorio de profesionales de eventos de combate: fotógrafos, videógrafos, cutmen, jueces, anunciadores de ring, ring card girls, catering, renta de venues y rings. Encuentra y contrata profesionales para tu próximo evento en México y el suroeste de EE. UU.',
  alternates: {
    canonical: 'https://strikersmatch.com/professionals',
  },
  openGraph: {
    title: 'Profesionales de Eventos de Combate | Strikers Match',
    description:
      'Fotógrafos, cutmen, jueces, catering, renta de venues y más. Todos los profesionales detrás de un evento de combate, en un solo lugar.',
    url: 'https://strikersmatch.com/professionals',
  },
};

export default function ProfessionalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
