import type { Metadata } from 'next';
import { StructuredData } from '@/components/StructuredData';
import { absoluteUrl, joinLocationParts, pageMetadata, truncateDescription } from '@/lib/seo';
import { getPublicManualFighterSeo } from '@/lib/seoData';
import { normalizeDisciplineList } from '@/lib/disciplines';

interface ManualFighterLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

function description(fighter: NonNullable<Awaited<ReturnType<typeof getPublicManualFighterSeo>>>) {
  const disciplines = normalizeDisciplineList(fighter.disciplines, fighter.discipline).join(', ');
  const country = fighter.country;
  const details = [disciplines, fighter.weight_class, joinLocationParts([fighter.city, fighter.state, country])].filter(Boolean).join(' · ');
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
  const country = fighter.country;
  const locationName = joinLocationParts([fighter.city, fighter.state, country]);
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
      homeLocation: locationName
        ? {
            '@type': 'Place',
            name: locationName,
            address: {
              '@type': 'PostalAddress',
              addressLocality: fighter.city || undefined,
              addressRegion: fighter.state || undefined,
              addressCountry: fighter.country || undefined,
            },
          }
        : undefined,
      affiliation: fighter.gym_name ? { '@type': 'SportsOrganization', name: fighter.gym_name } : undefined,
      knowsAbout: normalizeDisciplineList(fighter.disciplines, fighter.discipline),
    },
    isPartOf: { '@id': 'https://strikersmatch.com/#website' },
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Peleadores', item: absoluteUrl('/fighters') },
      { '@type': 'ListItem', position: 3, name: fighter.full_name, item: profileUrl },
    ],
  };

  return (
    <>
      <StructuredData data={[schema, breadcrumbs]} />
      {children}
    </>
  );
}
