import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Software para organizar eventos de deportes de combate',
  description: 'Publica eventos, registra atletas, crea emparejamientos, confirma combates, gestiona pagos y genera gráficos y hojas operativas con Strikers Match.',
  path: '/pricing',
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
