import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { CookieBanner } from "@/components/CookieBanner";
import { RoleOnboardingModal } from "@/components/RoleOnboardingModal";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { IdleTimeout } from "@/components/IdleTimeout";
import { JsonLd } from "@/components/JsonLd";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SITE_URL } from "@/lib/seo";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Strikers Match | Comunidad de boxeo y MMA en México',
    template: '%s | Strikers Match',
  },
  description:
    'Conecta con atletas, entrenadores, gimnasios y organizadores de boxeo y artes marciales mixtas en México. Encuentra peleas y organiza eventos en un solo lugar.',
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
    url: SITE_URL,
    siteName: 'Strikers Match',
    title: 'Strikers Match | Comunidad de boxeo y MMA en México',
    description:
      'Conecta con atletas, entrenadores, gimnasios y organizadores. Desde encontrar una pelea hasta organizar un evento, todo en un solo lugar.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Strikers Match | Comunidad de boxeo y MMA en México',
    description:
      'Atletas, entrenadores, gimnasios y organizadores de boxeo y MMA en México, en un solo lugar.',
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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX">
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
            <RoleOnboardingModal />
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
