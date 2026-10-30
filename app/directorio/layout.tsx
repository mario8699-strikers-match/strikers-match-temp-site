import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Directorio de profesionales de deportes de combate',
  description: 'Encuentra entrenadores, gimnasios, fotógrafos, cutmen, médicos, jueces, renta de rings y otros profesionales de boxeo y MMA.',
  path: '/directorio',
});

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
