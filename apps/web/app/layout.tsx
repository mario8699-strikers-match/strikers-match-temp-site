import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strikers Match Studio",
  description: "Broadcast production control room for Strikers Match.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
