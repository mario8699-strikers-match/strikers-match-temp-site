import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Buscar peleadores',
  description: 'Busca peleadores dentro de Strikers Match.',
  path: '/search',
  index: false,
});

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
