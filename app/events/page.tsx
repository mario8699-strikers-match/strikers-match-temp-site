import { Suspense } from 'react';
import { EventsPageClient } from '@/components/EventsPageClient';
import { StructuredData } from '@/components/StructuredData';
import { absoluteUrl } from '@/lib/seo';
import { getPublicEventsForPage } from '@/lib/seoData';
import { eventPublicPath } from '@/lib/publicUrls';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EventsPage() {
  const events = await getPublicEventsForPage();
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Eventos internacionales de deportes de combate',
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: event.event_name,
      url: absoluteUrl(eventPublicPath(event)),
    })),
  };

  return (
    <>
      <StructuredData data={itemList} />
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <EventsPageClient initialEvents={events} />
      </Suspense>
    </>
  );
}
