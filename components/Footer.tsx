'use client';

import Image from 'next/image';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation('legal');
  const { t: tCommon } = useTranslation('common');
  return (
    <footer className="bg-brand-black mt-auto">
      {/* App Store Banner */}
      <div className="border-t border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center text-center gap-4">
            <p className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: '#5A5A5A' }}>
              {tCommon('common.comingSoon')}
            </p>
            <div className="flex items-center gap-6">
              {/* Apple App Store */}
              <div className="flex items-center gap-2 px-5 py-2.5 border border-zinc-700 rounded-lg opacity-60">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="text-left">
                  <p className="text-[9px] text-zinc-500 leading-none">{tCommon('common.comingSoon')}</p>
                  <p className="text-sm font-semibold text-white leading-tight">{tCommon('common.appStore')}</p>
                </div>
              </div>
              {/* Google Play */}
              <div className="flex items-center gap-2 px-5 py-2.5 border border-zinc-700 rounded-lg opacity-60">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.18 23.75c-.36-.17-.68-.52-.82-.93-.07-.22-.11-.64-.11-1.32V2.5c0-.68.04-1.1.11-1.32.14-.41.46-.76.82-.93l10.52 11.5L3.18 23.75zm1.65.07L16.2 13.1l-2.48-2.72L4.83 23.82zm12.56-9.63l3.22-1.87c.5-.29.75-.62.75-1.07 0-.45-.25-.78-.75-1.07l-3.21-1.86-2.78 3.04 2.77 2.83zM4.83.18L13.72 13.62l2.48-2.72L4.83.18z" />
                </svg>
                <div className="text-left">
                  <p className="text-[9px] text-zinc-500 leading-none">{tCommon('common.comingSoon')}</p>
                  <p className="text-sm font-semibold text-white leading-tight">{tCommon('common.googlePlay')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-8">

          {/* Logo image */}
          <a href="/" className="flex-shrink-0">
            <Image
              src="/strikers-logo.png"
              alt="Strikers Match"
              height={128}
              width={128}
              style={{ width: 'auto', height: 128 }}
            />
          </a>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {[
              { href: '/events',    label: 'Eventos' },
              { href: '/fighters',  label: 'Atletas' },
              { href: '/promoters', label: 'Promotores' },
              { href: '/managers',  label: 'Managers' },
              { href: '/sponsors',  label: 'Patrocinadores' },
              { href: '/gallery',   label: 'Galería' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-xs font-semibold tracking-widest uppercase transition-colors hover:text-white"
                style={{ color: '#5A5A5A' }}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Social + Copyright + Legal + Contact */}
          <div className="flex flex-col items-start sm:items-end gap-2">
            {/* Instagram */}
            <a
              href="https://www.instagram.com/strikersmatch/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: '#E1306C' }}
              aria-label="Strikers Match on Instagram"
            >
              <svg className="w-5 h-5 hover:opacity-80 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
            <div className="flex gap-4">
              <a href="/privacy-policy" className="text-xs tracking-widest uppercase transition-colors hover:text-white" style={{ color: '#5A5A5A' }}>
                {t('legal.privacyPolicy')}
              </a>
              <a href="/terms" className="text-xs tracking-widest uppercase transition-colors hover:text-white" style={{ color: '#5A5A5A' }}>
                {t('legal.termsAndConditions')}
              </a>
            </div>
            <a
              href="mailto:info@strikersmatch.com"
              className="text-xs tracking-widest uppercase transition-colors hover:text-white"
              style={{ color: '#5A5A5A' }}
            >
              info@strikersmatch.com
            </a>
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#2A2A2A' }}>
              &copy; {new Date().getFullYear()} Strikers Match
            </p>
            <p className="text-[10px] tracking-widest" style={{ color: '#3A3A3A' }}>
              Designed by{' '}
              <a
                href="https://codevostudio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-colors hover:text-white"
              >
                CodevoStudio
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
