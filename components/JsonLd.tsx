export function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://strikersmatch.com/#organization',
    name: 'Strikers Match',
    url: 'https://strikersmatch.com',
    logo: 'https://strikersmatch.com/strikers-logo.png',
    knowsAbout: ['Boxeo', 'Artes marciales mixtas', 'Kickboxing', 'Muay Thai'],
    description:
      'Plataforma que conecta a la comunidad del boxeo y las artes marciales mixtas en México: atletas, entrenadores, gimnasios, organizadores y profesionales de eventos.',
    email: 'info@strikersmatch.com',
    sameAs: ['https://www.instagram.com/strikersmatch/'],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'info@strikersmatch.com',
      contactType: 'customer support',
      availableLanguage: ['Spanish'],
      areaServed: 'MX',
    },
    areaServed: { '@type': 'Country', name: 'México' },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://strikersmatch.com/#website',
    name: 'Strikers Match',
    url: 'https://strikersmatch.com',
    inLanguage: 'es-MX',
    publisher: { '@id': 'https://strikersmatch.com/#organization' },
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
    </>
  );
}
