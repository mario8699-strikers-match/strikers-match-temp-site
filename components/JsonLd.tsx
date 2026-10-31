export function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://strikersmatch.com/#organization',
    name: 'Strikers Match',
    url: 'https://strikersmatch.com',
    logo: 'https://strikersmatch.com/strikers-logo.png',
    knowsAbout: ['Boxing', 'Mixed martial arts', 'Muay Thai', 'Kickboxing', 'K-1', 'Bare-knuckle boxing'],
    description:
      'Plataforma internacional que conecta a atletas, entrenadores, gimnasios, representantes, organizadores y profesionales de los deportes de combate.',
    email: 'info@strikersmatch.com',
    sameAs: ['https://www.instagram.com/strikersmatch/'],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'info@strikersmatch.com',
      contactType: 'customer support',
      availableLanguage: ['Spanish', 'English', 'Russian'],
      areaServed: 'Worldwide',
    },
    areaServed: 'Worldwide',
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://strikersmatch.com/#website',
    name: 'Strikers Match',
    url: 'https://strikersmatch.com',
    inLanguage: ['es', 'en', 'ru'],
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
