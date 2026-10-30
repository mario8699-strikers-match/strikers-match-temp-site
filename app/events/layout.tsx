import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Eventos de boxeo, MMA y deportes de combate',
  description: 'Consulta eventos publicados de boxeo, MMA y otros deportes de combate. Revisa fechas, sedes, países, disciplinas y opciones de registro.',
  path: '/events',
});

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
