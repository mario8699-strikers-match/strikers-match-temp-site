import type { Metadata } from 'next';
import { StructuredData } from '@/components/StructuredData';
import { absoluteUrl, pageMetadata, truncateDescription } from '@/lib/seo';
import { getPublicEventSeo } from '@/lib/seoData';
import { EventInitialDataProvider } from './EventInitialData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface EventLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

function eventDescription(event: NonNullable<Awaited<ReturnType<typeof getPublicEventSeo>>>) {
  const details = [
    event.event_date ? `el ${event.event_date}` : null,
    event.city ? `en ${event.city}` : null,
    event.venue ? `en ${event.venue}` : null,
  ].filter(Boolean).join(' ');
  return truncateDescription(
    event.notes || `${event.event_name}${details ? `: evento de deportes de combate ${details}` : ', evento de deportes de combate en México'}. Consulta la información y el registro en Strikers Match.`
  );
}

export async function generateMetadata({ params }: Omit<EventLayoutProps, 'children'>): Promise<Metadata> {
  const { id } = await params;
  const event = await getPublicEventSeo(id);
  if (!event || event.status !== 'published') {
    return pageMetadata({
      title: 'Evento no disponible',
      description: 'Este evento no está disponible públicamente.',
      path: `/events/${id}`,
      index: false,
    });
  }

  const eventName = event.event_name.trim();
  const location = event.city ? ` en ${event.city.trim()}` : '';
  return pageMetadata({
    title: `${eventName}${location}`,
    description: eventDescription(event),
    path: `/events/${id}`,
    image: event.flyer_url,
  });
}

export default async function EventLayout({ children, params }: EventLayoutProps) {
  const { id } = await params;
  const event = await getPublicEventSeo(id);
  if (!event || event.status !== 'published') return children;

  const eventUrl = absoluteUrl(`/events/${id}`);
  const startDate = event.event_date
    ? `${event.event_date}${event.event_time ? `T${event.event_time}` : ''}`
    : undefined;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': `${eventUrl}#event`,
    name: event.event_name,
    description: eventDescription(event),
    url: eventUrl,
    startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: event.flyer_url || undefined,
    sport: event.disciplines_needed?.length ? event.disciplines_needed : ['Boxeo', 'Artes marciales mixtas'],
    location: event.city || event.venue
      ? {
          '@type': 'Place',
          name: event.venue || event.city,
          address: {
            '@type': 'PostalAddress',
            addressLocality: event.city || undefined,
            addressCountry: 'MX',
          },
        }
      : undefined,
    organizer: {
      '@type': 'Organization',
      name: event.profiles?.full_name || 'Strikers Match',
      url: absoluteUrl('/promoters'),
    },
  };
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Eventos', item: absoluteUrl('/events') },
      { '@type': 'ListItem', position: 3, name: event.event_name, item: eventUrl },
    ],
  };
  const structuredData = event.event_date && (event.city || event.venue)
    ? [schema, breadcrumbs]
    : [breadcrumbs];

  return (
    <>
      <StructuredData data={structuredData} />
      <EventInitialDataProvider event={event}>
        {children}
      </EventInitialDataProvider>
    </>
  );
}
