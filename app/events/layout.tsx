import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Eventos internacionales de boxeo y deportes de combate',
  description: 'Descubre eventos de boxeo, MMA, Muay Thai, kickboxing, K-1, bare knuckle y otros deportes de combate. Consulta fechas, países, sedes y registro.',
  path: '/events',
});

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
