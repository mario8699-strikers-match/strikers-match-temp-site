'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { authService } from '@/services/authService';
import { VENDOR_ROLES } from '@/types';
import type { Profile } from '@/types';

type ActivePage = 'home' | 'events' | 'fighters' | 'professionals' | 'promoters' | 'managers' | 'sponsors' | 'gallery' | 'pricing' | 'login' | 'register' | null;

interface NavbarProps {
  activePage?: ActivePage;
}

const NAV_LINKS: { href: string; key: ActivePage; label?: string }[] = [
  { href: '/events',        key: 'events' },
  { href: '/fighters',      key: 'fighters' },
  { href: '/professionals', key: 'professionals', label: 'Servicios' },
  { href: '/promoters',     key: 'promoters' },
  { href: '/managers',      key: 'managers', label: 'Managers' },
  { href: '/sponsors',      key: 'sponsors' },
  { href: '/gallery',       key: 'gallery' },
  { href: '/pricing',       key: 'pricing',  label: 'Precios' },
];

function profileLink(role: string): { label: string; href: string }[] {
  switch (role) {
    case 'fighter':  return [{ label: 'Mi Perfil', href: '/fighter/profile' }];
    case 'promoter': return [{ label: 'Mi Panel', href: '/promoter/dashboard' }, { label: 'Mi Perfil', href: '/profile' }];
    case 'manager':  return [{ label: 'Mi Panel', href: '/manager/dashboard' }, { label: 'Mi Perfil', href: '/manager/profile' }];
    case 'sponsor':  return [{ label: 'Mi Panel', href: '/sponsor/dashboard' }, { label: 'Mi Perfil', href: '/profile' }];
    case 'admin':    return [{ label: 'Admin', href: '/admin' }];
    default:
      if (VENDOR_ROLES.includes(role as typeof VENDOR_ROLES[number])) {
        return [{ label: 'Mi Perfil', href: '/vendor/profile' }];
      }
      return [];
  }
}

export function Navbar({ activePage }: NavbarProps) {
  const { t } = useTranslation('navigation');
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authService.getSession().then(({ data }) => {
      setProfile(data?.profile ?? null);
    });
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close menu on route change / resize to desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    const { supabase } = await import('@/lib/supabaseClient');
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const linkClass = (page: ActivePage) =>
    `px-3 py-2 text-sm font-semibold tracking-wide transition-colors ${
      activePage === page
        ? 'text-white border-b-2 border-[#C0001E]'
        : 'text-[#9A9A9A] hover:text-white'
    }`;

  const mobileLinkClass = (page: ActivePage) =>
    `block px-6 py-3 text-sm font-bold tracking-wide uppercase transition-colors ${
      activePage === page ? 'text-white bg-[#1A1A1A]' : 'text-[#9A9A9A] hover:text-white hover:bg-[#1A1A1A]'
    }`;

  const isLoggedIn = profile !== undefined && profile !== null;

  // Hamburger icon (renders for both logged-in desktop and all mobile)
  const hamburgerBtn = (
    <button
      onClick={() => setMobileOpen((o) => !o)}
      className="flex flex-col justify-center items-center w-9 h-9 gap-1.5 border border-[#3A3A3A] hover:border-[#5A5A5A] transition-colors flex-shrink-0"
      aria-label="Menú"
    >
      <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
      <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
      <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
    </button>
  );

  return (
    <div className="relative" ref={menuRef}>
      <header className="bg-[#0A0A0A] border-b border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Logo */}
            <a href="/" className="flex-shrink-0">
              <Image
                src="/strikers-logo.png"
                alt="Strikers Match"
                height={128}
                width={128}
                style={{ width: 'auto', height: 'auto', maxHeight: 128 }}
                priority
              />
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex space-x-1">
              {!isLoggedIn && (
                <a href="/" className={linkClass('home')}>{t('nav.home')}</a>
              )}
              {NAV_LINKS.map(({ href, key, label }) => (
                <a key={href} href={href} className={linkClass(key as ActivePage)}>
                  {label ?? t(`nav.${key}`)}
                </a>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <>
                  {/* Desktop logged-in: inline profile links + logout */}
                  <div className="hidden md:flex items-center gap-3">
                    <LanguageSwitcher variant="dark" />
                    <span className="text-xs text-[#5A5A5A]">
                      {profile.full_name || profile.role}
                      <span className="ml-1 text-[#3A3A3A]">({profile.role})</span>
                    </span>
                    {profileLink(profile.role).map(({ label, href }) => (
                      <a key={href} href={href} className="text-sm font-semibold text-[#9A9A9A] hover:text-white transition-colors">
                        {label}
                      </a>
                    ))}
                    <button onClick={handleLogout} className="text-sm font-semibold text-[#C0001E] hover:text-red-400 transition-colors">
                      {t('nav.logout')}
                    </button>
                  </div>
                  {/* Mobile logged-in: hamburger only */}
                  <div className="flex md:hidden">
                    {hamburgerBtn}
                  </div>
                </>
              ) : (
                <>
                  {/* Desktop logged-out: inline items */}
                  <div className="hidden md:flex items-center gap-3">
                    <LanguageSwitcher variant="dark" />
                    <a href="/login" className="text-sm font-semibold text-[#9A9A9A] hover:text-white transition-colors">
                      {t('nav.login')}
                    </a>
                    <a href="/register" className="px-4 py-2 text-xs font-bold tracking-widest uppercase text-white bg-[#C0001E] hover:bg-[#9A0018] transition-colors">
                      {t('nav.register')}
                    </a>
                  </div>
                  {/* Mobile logged-out: hamburger only */}
                  <div className="flex md:hidden">
                    {hamburgerBtn}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ── Mobile / logged-in dropdown menu ── */}
      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#0A0A0A] border-b border-[#2A2A2A] z-50 shadow-2xl">

          {/* Nav links — always shown in mobile, only in dropdown for logged-in on desktop too */}
          <nav className="border-b border-[#1A1A1A] md:hidden">
            {!isLoggedIn && (
              <a href="/" onClick={() => setMobileOpen(false)} className={mobileLinkClass('home')}>{t('nav.home')}</a>
            )}
            {NAV_LINKS.map(({ href, key, label }) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)} className={mobileLinkClass(key as ActivePage)}>
                {label ?? t(`nav.${key}`)}
              </a>
            ))}
          </nav>

          {/* Language switcher */}
          <div className="px-6 py-4 border-b border-[#1A1A1A]">
            <p className="text-xs font-bold tracking-widest uppercase mb-3 text-[#5A5A5A]">Idioma</p>
            <LanguageSwitcher variant="dark" />
          </div>

          {isLoggedIn ? (
            <>
              {/* Profile links */}
              <div className="py-2">
                {profileLink(profile.role).map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-6 py-3 text-sm font-bold text-white hover:bg-[#1A1A1A] transition-colors"
                  >
                    {label}
                  </a>
                ))}
              </div>
              {/* Logout */}
              <div className="border-t border-[#1A1A1A] py-2">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-6 py-3 text-sm font-bold text-[#C0001E] hover:bg-[#1A1A1A] transition-colors"
                >
                  {t('nav.logout')}
                </button>
              </div>
            </>
          ) : (
            /* Logged-out CTAs */
            <div className="px-6 py-4 flex flex-col gap-3">
              <a
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center py-3 text-xs font-bold tracking-widest uppercase text-white border border-[#3A3A3A] hover:border-white transition-colors"
              >
                {t('nav.login')}
              </a>
              <a
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center py-3 text-xs font-bold tracking-widest uppercase text-white bg-[#C0001E] hover:bg-[#9A0018] transition-colors"
              >
                {t('nav.register')}
              </a>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
