import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Herramientas para organizar eventos de combate',
  description: 'Conoce las herramientas de Strikers Match para publicar eventos, registrar atletas, crear combates, gestionar pagos e imprimir hojas del evento.',
  path: '/pricing',
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
