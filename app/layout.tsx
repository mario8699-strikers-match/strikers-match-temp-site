import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { CookieBanner } from "@/components/CookieBanner";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { IdleTimeout } from "@/components/IdleTimeout";
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
    default: 'Strikers Match - Combat Sports Platform | Mexico & US Southwest',
    template: '%s | Strikers Match',
  },
  description:
    'All-in-one combat sports platform for amateur and pro fighters, promoters, managers, sponsors, and event professionals — photographers, videographers, cutmen, judges, ring announcers, catering, venues and more — across Mexico and the US Southwest.',
  keywords: [
    'combat sports', 'boxing events', 'MMA events', 'kickboxing',
    'amateur boxing', 'pro boxing', 'combat sports platform',
    'fight promoters', 'boxing Mexico', 'MMA Mexico',
    'boxing California', 'boxing Nevada', 'boxing Arizona',
    'boxing Utah', 'boxing Colorado', 'boxing New Mexico',
    'peleas de boxeo', 'eventos MMA', 'deportes de combate',
    'promotores de boxeo', 'peleadores', 'artes marciales mixtas',
    'eventos de boxeo Mexico', 'fight card',
    'fighter profiles', 'boxing promoter platform',
    'boxing photographers', 'fight videographers', 'cutman services',
    'boxing judges', 'ring announcers', 'ring card girls',
    'fight venue rental', 'boxing ring rental', 'boxing event catering',
    'merchandise vendors', 'broadcast personalities',
    'combat sports professionals', 'fotografos de boxeo', 'juez de boxeo',
    'renta de ring', 'renta de venue', 'catering para eventos',
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
    title: 'Strikers Match - All-in-one Combat Sports Platform',
    description:
      'From amateur and pro fighters to promoters, sponsors, photographers, cutmen, judges and catering — one platform for everyone behind a combat sports event in Mexico and the US Southwest.',
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
    title: 'Strikers Match - All-in-one Combat Sports Platform',
    description:
      'Fighters, promoters, sponsors and event professionals — all in one place. Mexico & US Southwest.',
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
            <WhatsNewModal />
            <IdleTimeout />
            <Analytics />
            <SpeedInsights />
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
