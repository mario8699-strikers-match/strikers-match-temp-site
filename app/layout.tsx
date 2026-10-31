import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { CookieBanner } from "@/components/CookieBanner";
import { RoleOnboardingModal } from "@/components/RoleOnboardingModal";
import { GuidedOnboardingHelp } from "@/components/GuidedOnboardingHelp";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { IdleTimeout } from "@/components/IdleTimeout";
import { JsonLd } from "@/components/JsonLd";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DEFAULT_CONTENT_LANGUAGE, DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";

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
  applicationName: 'Strikers Match',
  category: 'sports',
  title: {
    default: 'Strikers Match | Matchmaking y eventos de deportes de combate',
    template: '%s | Strikers Match',
  },
  description:
    'Plataforma internacional para conectar atletas, gimnasios, managers y promotores, encontrar peleas y organizar eventos de deportes de combate.',
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
    locale: DEFAULT_CONTENT_LANGUAGE,
    url: SITE_URL,
    siteName: 'Strikers Match',
    title: 'Strikers Match | Matchmaking y eventos de deportes de combate',
    description:
      'Conecta atletas, gimnasios, managers y promotores de boxeo, MMA, Muay Thai, kickboxing, K-1 y bare knuckle.',
    images: [{ url: DEFAULT_OG_IMAGE, alt: 'Strikers Match — Comunidad internacional de deportes de combate' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Strikers Match | Matchmaking y eventos de deportes de combate',
    description:
      'Atletas, entrenadores, gimnasios, representantes y organizadores de deportes de combate, en un solo lugar.',
    images: [DEFAULT_OG_IMAGE],
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
    'distribution': 'global',
    'rating': 'general',
  },
  verification: {
    google: 'jWJuHCcAsNFwzfMVPbgj2mo0NAqyGnIVk0umKW0F8OY',
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
            <RoleOnboardingModal />
            <GuidedOnboardingHelp />
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
