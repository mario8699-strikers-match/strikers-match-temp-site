import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { CookieBanner } from "@/components/CookieBanner";

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
  title: "Strikers Match - Combat Sports Platform",
  description: "Connect fighters, promoters, managers, and sponsors for combat sports events in Mexico",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}
      >
        <I18nProvider>
          <QueryProvider>
            {children}
            <CookieBanner />
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
