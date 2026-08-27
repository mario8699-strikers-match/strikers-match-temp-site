import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Términos y condiciones',
  description: 'Consulta los términos y condiciones para utilizar la plataforma Strikers Match.',
  path: '/terms',
});

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
