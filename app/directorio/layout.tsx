import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Directorio de boxeo y MMA en México',
  description: 'Encuentra entrenadores, gimnasios, fotógrafos, cutmen, médicos, jueces, renta de rings y otros profesionales de boxeo y MMA en México.',
  path: '/directorio',
});

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
