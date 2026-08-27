import type { Metadata } from 'next';
import { StructuredData } from '@/components/StructuredData';
import { absoluteUrl, pageMetadata, truncateDescription } from '@/lib/seo';
import { getPublicManualFighterSeo } from '@/lib/seoData';

interface ManualFighterLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

function description(fighter: NonNullable<Awaited<ReturnType<typeof getPublicManualFighterSeo>>>) {
  const details = [fighter.discipline, fighter.weight_class, fighter.city || fighter.state].filter(Boolean).join(' · ');
  return truncateDescription(fighter.bio || `${fighter.full_name}${details ? ` — ${details}` : ''}. Peleador de roster en Strikers Match.`);
}

export async function generateMetadata({ params }: Omit<ManualFighterLayoutProps, 'children'>): Promise<Metadata> {
  const { id } = await params;
  const fighter = await getPublicManualFighterSeo(id);
  if (!fighter) {
    return pageMetadata({
      title: 'Perfil de peleador no disponible',
      description: 'Este perfil no está disponible públicamente.',
      path: `/fighters/manual/${id}`,
      index: false,
    });
  }

  return pageMetadata({
    title: `${fighter.full_name} — Peleador de roster`,
    description: description(fighter),
    path: `/fighters/manual/${id}`,
    image: fighter.photo_url,
    type: 'profile',
  });
}

export default async function ManualFighterLayout({ children, params }: ManualFighterLayoutProps) {
  const { id } = await params;
  const fighter = await getPublicManualFighterSeo(id);
  if (!fighter) return children;

  const profileUrl = absoluteUrl(`/fighters/manual/${id}`);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${profileUrl}#profile`,
    url: profileUrl,
    dateCreated: fighter.created_at,
    mainEntity: {
      '@type': 'Person',
      name: fighter.full_name,
      alternateName: fighter.nickname || undefined,
      description: description(fighter),
      image: fighter.photo_url || undefined,
      affiliation: fighter.gym_name ? { '@type': 'SportsOrganization', name: fighter.gym_name } : undefined,
      knowsAbout: fighter.discipline || undefined,
    },
  };

  return (
    <>
      <StructuredData data={schema} />
      {children}
    </>
  );
}
