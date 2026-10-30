import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Representantes de atletas de deportes de combate',
  description: 'Encuentra representantes y revisa sus rosters internacionales de atletas de boxeo, MMA y otros deportes de combate.',
  path: '/managers',
});

export default function ManagersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
