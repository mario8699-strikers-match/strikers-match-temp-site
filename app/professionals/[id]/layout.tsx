import type { Metadata } from 'next';
import { StructuredData } from '@/components/StructuredData';
import { absoluteUrl, pageMetadata, truncateDescription } from '@/lib/seo';
import { getPublicProfessionalSeo } from '@/lib/seoData';

interface ProfessionalLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  gyms_academies: 'Gimnasio o academia',
  recovery_wellness: 'Recuperación y bienestar',
  gear_apparel: 'Ropa y equipo',
  nutrition_supplements: 'Nutrición y suplementos',
  local_business: 'Negocio local',
  other_service: 'Servicio profesional',
  ring_card_girl: 'Ring card girl',
  photographer: 'Fotógrafo',
  videographer: 'Videógrafo',
  broadcast_personality: 'Presentador o comentarista',
  catering_vendor: 'Catering y alimentos',
  venue_rental: 'Renta de venue',
  judge: 'Juez o réferi',
  ring_rental: 'Renta de ring',
  ring_announcer: 'Anunciador de ring',
  cutman: 'Cutman',
  merchandise_vendor: 'Mercancía',
  ringside_doctor: 'Médico de ringside',
  ringside_emt: 'Técnico médico de ringside',
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] || 'Profesional de deportes de combate';
}

function description(profile: NonNullable<Awaited<ReturnType<typeof getPublicProfessionalSeo>>>) {
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  return truncateDescription(profile.bio || `${profile.full_name}, ${roleLabel(profile.role).toLowerCase()}${location ? ` en ${location}` : ' en México'}. Perfil profesional en Strikers Match.`);
}

export async function generateMetadata({ params }: Omit<ProfessionalLayoutProps, 'children'>): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicProfessionalSeo(id);
  if (!profile) {
    return pageMetadata({
      title: 'Perfil profesional no disponible',
      description: 'Este perfil no está disponible públicamente.',
      path: `/professionals/${id}`,
      index: false,
    });
  }

  return pageMetadata({
    title: `${profile.full_name} — ${roleLabel(profile.role)}`,
    description: description(profile),
    path: `/professionals/${id}`,
    image: profile.photo_url,
    type: 'profile',
  });
}

export default async function ProfessionalLayout({ children, params }: ProfessionalLayoutProps) {
  const { id } = await params;
  const profile = await getPublicProfessionalSeo(id);
  if (!profile) return children;

  const profileUrl = absoluteUrl(`/professionals/${id}`);
  const entityType = profile.role === 'gyms_academies' || profile.role === 'local_business'
    ? 'Organization'
    : 'Person';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${profileUrl}#profile`,
    url: profileUrl,
    dateModified: profile.updated_at,
    mainEntity: {
      '@type': entityType,
      name: profile.full_name,
      description: description(profile),
      image: profile.photo_url || undefined,
      jobTitle: entityType === 'Person' ? roleLabel(profile.role) : undefined,
      address: profile.city || profile.state
        ? {
            '@type': 'PostalAddress',
            addressLocality: profile.city || undefined,
            addressRegion: profile.state || undefined,
            addressCountry: profile.country || 'MX',
          }
        : undefined,
    },
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Directorio', item: absoluteUrl('/directorio') },
      { '@type': 'ListItem', position: 3, name: profile.full_name, item: profileUrl },
    ],
  };

  return (
    <>
      <StructuredData data={[schema, breadcrumbs]} />
      {children}
    </>
  );
}
