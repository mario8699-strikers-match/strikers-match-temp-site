'use client';

import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AnalyticsBody } from '@/components/AnalyticsBody';

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage="promoters" />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full">
        <AnalyticsBody />
      </main>
      <Footer />
    </div>
  );
}
