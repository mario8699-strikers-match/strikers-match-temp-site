import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Managers y representantes de peleadores',
  description: 'Encuentra managers y representantes con rosters internacionales de peleadores de boxeo, MMA, Muay Thai, kickboxing y otros deportes de combate.',
  path: '/managers',
});

export default function ManagersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
