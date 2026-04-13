export function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Strikers Match',
    url: 'https://strikersmatch.com',
    logo: 'https://strikersmatch.com/strikers-logo.png',
    description:
      'The premier combat sports platform connecting fighters, promoters, managers, and sponsors across Mexico and the US Southwest.',
    email: 'info@strikersmatch.com',
    sameAs: [],
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
      'Combat sports event platform connecting fighters with promoters for boxing, MMA, and kickboxing events.',
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
