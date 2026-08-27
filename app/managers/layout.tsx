import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Representantes de peleadores en México',
  description: 'Encuentra representantes y revisa sus rosters de peleadores de boxeo, MMA y otros deportes de combate en México.',
  path: '/managers',
});

export default function ManagersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
