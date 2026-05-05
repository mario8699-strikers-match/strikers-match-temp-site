export function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Strikers Match',
    url: 'https://strikersmatch.com',
    logo: 'https://strikersmatch.com/strikers-logo.png',
    description:
      'All-in-one combat sports platform connecting amateur and professional fighters, promoters, managers, sponsors, and event service professionals (photographers, videographers, cutmen, judges, ring announcers, catering, venue and ring rental) across Mexico and the US Southwest.',
    email: 'info@strikersmatch.com',
    sameAs: ['https://www.instagram.com/strikersmatch/'],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'info@strikersmatch.com',
      contactType: 'customer support',
      availableLanguage: ['English', 'Spanish'],
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Strikers Match',
    url: 'https://strikersmatch.com',
    inLanguage: ['es-MX', 'en-US'],
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://strikersmatch.com/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: 'Strikers Match',
    url: 'https://strikersmatch.com',
    sport: ['Boxing', 'Mixed Martial Arts', 'Kickboxing', 'Muay Thai'],
    description:
      'Combat sports event platform for amateur and pro fighters, promoters, managers, sponsors, and event professionals including photographers, videographers, cutmen, judges, ring announcers, catering, venues, and ring rental.',
    areaServed: [
      { '@type': 'Country', name: 'Mexico' },
      { '@type': 'State', name: 'California', containedInPlace: { '@type': 'Country', name: 'United States' } },
      { '@type': 'State', name: 'Nevada', containedInPlace: { '@type': 'Country', name: 'United States' } },
      { '@type': 'State', name: 'Arizona', containedInPlace: { '@type': 'Country', name: 'United States' } },
      { '@type': 'State', name: 'Utah', containedInPlace: { '@type': 'Country', name: 'United States' } },
      { '@type': 'State', name: 'Colorado', containedInPlace: { '@type': 'Country', name: 'United States' } },
      { '@type': 'State', name: 'New Mexico', containedInPlace: { '@type': 'Country', name: 'United States' } },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
    </>
  );
}
