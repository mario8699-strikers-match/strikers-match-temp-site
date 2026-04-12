'use client';

import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function Home() {
  const { t } = useTranslation('navigation');
  const { t: tCommon } = useTranslation('common');

  return (
    <div className="min-h-screen bg-black font-sans flex flex-col relative">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="https://strikers-match.sfo3.digitaloceanspaces.com/videos/Cut-BG-Vid.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60 z-10" />

      {/* Content */}
      <div className="relative z-20 flex flex-col min-h-screen">
        <Navbar activePage="home" />

        <main className="flex-1 flex items-center">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-20 md:py-32">

            {/* Eyebrow */}
            <p className="text-xs font-bold tracking-[0.3em] uppercase mb-6" style={{ color: '#C0001E' }}>
              {tCommon('common.eyebrow')}
            </p>

            {/* Hero headline */}
            <h1
              className="font-display font-black uppercase leading-none mb-8"
              style={{ fontSize: 'clamp(3.5rem, 9vw, 7.5rem)', letterSpacing: '-0.02em', color: '#FFFFFF' }}
            >
              {tCommon('common.hero.line1')}<br />
              {tCommon('common.hero.line2')}<br />
              <span style={{ color: '#C0001E', fontStyle: 'italic' }}>{tCommon('common.hero.line3')}<br />{tCommon('common.hero.line4')}</span><br />
              {tCommon('common.hero.line5')}<br />{tCommon('common.hero.line6')}
            </h1>

            {/* Tagline */}
            <p className="text-base max-w-md mb-10 text-zinc-300">
              {tCommon('common.tagline')}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <a
                href="/register"
                className="px-8 py-3 text-xs font-bold tracking-widest uppercase text-white transition-colors"
                style={{ background: '#C0001E' }}
                onMouseOver={e => (e.currentTarget.style.background = '#9A0018')}
                onMouseOut={e => (e.currentTarget.style.background = '#C0001E')}
              >
                {t('nav.register')}
              </a>
              <a
                href="/login"
                className="px-8 py-3 text-xs font-bold tracking-widest uppercase transition-colors border border-white text-white hover:bg-white/10"
              >
                {t('nav.login')}
              </a>
            </div>

          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
