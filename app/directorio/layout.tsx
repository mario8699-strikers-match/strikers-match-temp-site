import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Directorio de profesionales de deportes de combate',
  description: 'Encuentra gimnasios, entrenadores, cutmen, médicos, jueces, fotógrafos, servicios de recuperación y profesionales para eventos de deportes de combate.',
  path: '/directorio',
});

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
