import type { Metadata } from 'next';
import { StructuredData } from '@/components/StructuredData';
import { absoluteUrl, pageMetadata, truncateDescription } from '@/lib/seo';
import { getPublicFighterSeo } from '@/lib/seoData';

interface FighterLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

function fighterDescription(fighter: NonNullable<Awaited<ReturnType<typeof getPublicFighterSeo>>>) {
  const name = fighter.profiles?.full_name || 'Peleador';
  const details = [
    fighter.experience_level === 'pro' ? 'profesional' : fighter.experience_level === 'amateur' ? 'amateur' : null,
    fighter.disciplines?.join(', '),
    fighter.weight_class ? `división ${fighter.weight_class}` : null,
    fighter.profiles?.city || fighter.state,
  ].filter(Boolean).join(' · ');
  return truncateDescription(fighter.bio || `${name}${details ? ` — ${details}` : ''}. Consulta su perfil deportivo en Strikers Match.`);
}

export async function generateMetadata({ params }: Omit<FighterLayoutProps, 'children'>): Promise<Metadata> {
  const { id } = await params;
  const fighter = await getPublicFighterSeo(id);
  const isPublic = fighter && !fighter.is_hidden && !fighter.profiles?.is_banned;
  if (!isPublic) {
    return pageMetadata({
      title: 'Perfil de peleador no disponible',
      description: 'Este perfil no está disponible públicamente.',
      path: `/fighters/${id}`,
      index: false,
    });
  }

  const location = fighter.profiles?.city ? ` — ${fighter.profiles.city}` : '';
  return pageMetadata({
    title: `${fighter.profiles?.full_name || 'Peleador'}${location}`,
    description: fighterDescription(fighter),
    path: `/fighters/${id}`,
    image: fighter.photo_url,
    type: 'profile',
  });
}

export default async function FighterLayout({ children, params }: FighterLayoutProps) {
  const { id } = await params;
  const fighter = await getPublicFighterSeo(id);
  if (!fighter || fighter.is_hidden || fighter.profiles?.is_banned) return children;

  const name = fighter.profiles?.full_name || 'Peleador';
  const profileUrl = absoluteUrl(`/fighters/${id}`);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${profileUrl}#profile`,
    url: profileUrl,
    dateCreated: fighter.created_at,
    mainEntity: {
      '@type': 'Person',
      '@id': `${profileUrl}#person`,
      name,
      alternateName: fighter.nickname || undefined,
      description: fighterDescription(fighter),
      image: fighter.photo_url || undefined,
      homeLocation: fighter.profiles?.city || fighter.state
        ? {
            '@type': 'Place',
            name: [fighter.profiles?.city, fighter.state].filter(Boolean).join(', '),
            address: { '@type': 'PostalAddress', addressCountry: 'MX' },
          }
        : undefined,
      affiliation: fighter.gym_name ? { '@type': 'SportsOrganization', name: fighter.gym_name } : undefined,
      knowsAbout: fighter.disciplines?.length ? fighter.disciplines : undefined,
    },
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Peleadores', item: absoluteUrl('/fighters') },
      { '@type': 'ListItem', position: 3, name, item: profileUrl },
    ],
  };

  return (
    <>
      <StructuredData data={[schema, breadcrumbs]} />
      {children}
    </>
  );
}
