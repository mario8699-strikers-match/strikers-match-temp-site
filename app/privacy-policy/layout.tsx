import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Aviso de privacidad',
  description: 'Consulta cómo Strikers Match recopila, utiliza y protege los datos de usuarios, atletas y profesionales de la plataforma.',
  path: '/privacy-policy',
});

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
