'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Footer } from '@/components/Footer';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Navbar } from '@/components/Navbar';
import { authService } from '@/services/authService';

const ADMIN_NAV_ITEMS = [
  { href: '/admin', label: 'admin.nav.dashboard', exact: true },
  { href: '/admin/users', label: 'admin.nav.users', exact: false },
  { href: '/admin/fighters', label: 'admin.nav.fighters', exact: false },
  { href: '/admin/promoters', label: 'admin.nav.promoters', exact: false },
  { href: '/admin/managers', label: 'admin.nav.managers', exact: false },
  { href: '/admin/sponsors', label: 'admin.nav.sponsors', exact: false },
  { href: '/admin/vendors', label: 'admin.nav.vendors', exact: false },
  { href: '/admin/events', label: 'admin.nav.events', exact: false },
  { href: '/admin/matches', label: 'admin.nav.matches', exact: false },
  { href: '/admin/gallery', label: 'admin.nav.gallery', exact: false },
  { href: '/admin/analytics', label: 'admin.nav.analytics', exact: false },
];

export function EventManageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation('admin');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    authService.getSession()
      .then((result) => {
        if (!active) return;
        setIsAdmin(result.data?.profile?.role === 'admin');
      })
      .catch(() => {
        if (!active) return;
        setIsAdmin(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (window.innerWidth < 768) setSidebarOpen(false);
    });
  }, [pathname]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!sidebarOpen || !sidebarRef.current || sidebarRef.current.contains(event.target as Node)) return;
      if (window.innerWidth < 1024) setSidebarOpen(false);
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sidebarOpen]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-white font-sans text-zinc-900">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {children}
        </main>
      </div>
    );
  }

  if (isAdmin === true) {
    const isActive = (item: typeof ADMIN_NAV_ITEMS[number]) => {
      if (item.href === '/admin/events' && pathname.startsWith('/events/')) return true;
      return item.exact ? pathname === item.href : pathname.startsWith(item.href);
    };

    return (
      <div className="min-h-screen flex font-sans">
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside
          ref={sidebarRef}
          className={`fixed left-0 top-0 z-30 flex h-full w-56 flex-shrink-0 flex-col bg-zinc-950 transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-5">
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                {t('admin.title')}
              </p>
              <Link href="/" className="text-base font-bold text-white transition-colors hover:text-zinc-300">
                Strikers Match
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center text-zinc-400 transition-colors hover:text-white"
              aria-label={t('admin.closeMenu')}
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
            {ADMIN_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item)
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>

          <div className="border-t border-zinc-800 px-5 py-4">
            <button
              type="button"
              onClick={async () => {
                await authService.logout();
                window.location.href = '/login';
              }}
              className="text-xs text-zinc-500 transition-colors hover:text-white"
            >
              {t('admin.logout')}
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col lg:pl-56">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-9 w-9 items-center justify-center text-zinc-600 transition-colors hover:text-zinc-900"
              aria-label={t('admin.toggleMenu')}
            >
              <span className="text-2xl leading-none">≡</span>
            </button>
            <LanguageSwitcher />
          </div>

          <main className="flex-1 bg-zinc-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900">
      <Navbar activePage="events" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
