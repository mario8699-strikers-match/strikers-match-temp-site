import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Event Display | Strikers Match',
  robots: { index: false, follow: false, nocache: true },
};

export default function EventDisplayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
