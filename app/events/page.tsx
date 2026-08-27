import { EventsPageClient } from '@/components/EventsPageClient';
import { StructuredData } from '@/components/StructuredData';
import { absoluteUrl } from '@/lib/seo';
import { getPublicEventsForPage } from '@/lib/seoData';

export const revalidate = 300;

export default async function EventsPage() {
  const events = await getPublicEventsForPage();
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Eventos de boxeo y MMA en México',
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: event.event_name,
      url: absoluteUrl(`/events/${event.id}`),
    })),
  };

  return (
    <>
      <StructuredData data={itemList} />
      <EventsPageClient initialEvents={events} />
    </>
  );
}
