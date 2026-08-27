import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Eventos de boxeo y MMA en México',
  description: 'Consulta eventos publicados de boxeo, MMA y otros deportes de combate en México. Revisa fechas, sedes, disciplinas y opciones de registro.',
  path: '/events',
});

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
