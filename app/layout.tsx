import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { CookieBanner } from "@/components/CookieBanner";
import { JsonLd } from "@/components/JsonLd";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const SITE_URL = 'https://strikersmatch.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Strikers Match - Combat Sports Platform | Boxing & MMA Events in Mexico & Southwest USA',
    template: '%s | Strikers Match',
  },
  description:
    'The premier combat sports platform connecting fighters, promoters, managers, and sponsors across Mexico, California, Nevada, Arizona, Utah, Colorado, and New Mexico. Find boxing, MMA, and kickboxing events near you.',
  keywords: [
    'combat sports', 'boxing events', 'MMA events', 'kickboxing',
    'fight promoters', 'boxing Mexico', 'MMA Mexico',
    'boxing California', 'boxing Nevada', 'boxing Arizona',
    'boxing Utah', 'boxing Colorado', 'boxing New Mexico',
    'peleas de boxeo', 'eventos MMA', 'deportes de combate',
    'promotores de boxeo', 'peleadores', 'artes marciales mixtas',
    'eventos de boxeo Mexico', 'fight card', 'combat sports platform',
    'fighter profiles', 'boxing promoter platform',
  ],
  authors: [{ name: 'Strikers Match', url: SITE_URL }],
  creator: 'Strikers Match',
  publisher: 'Strikers Match',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    alternateLocale: 'en_US',
    url: SITE_URL,
    siteName: 'Strikers Match',
    title: 'Strikers Match - Combat Sports Platform',
    description:
      'Connect fighters, promoters, managers & sponsors for combat sports events across Mexico and the US Southwest.',
    images: [
      {
        url: '/strikers-logo.png',
        width: 512,
        height: 512,
        alt: 'Strikers Match Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Strikers Match - Combat Sports Platform',
    description:
      'The premier platform connecting fighters, promoters & sponsors for combat sports events in Mexico & Southwest USA.',
    images: ['/strikers-logo.png'],
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'google-site-verification': 'jWJuHCcAsNFwzfMVPbgj2mo0NAqyGnIVk0umKW0F8OY',
    'geo.region': 'MX',
    'geo.placename': 'Mexico',
    'ICBM': '23.6345, -102.5528',
    'distribution': 'global',
    'rating': 'general',
    'revisit-after': '3 days',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <JsonLd />
      </head>
      <body
        className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}
      >
        <I18nProvider>
          <QueryProvider>
            {children}
            <CookieBanner />
            <Analytics />
            <SpeedInsights />
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
