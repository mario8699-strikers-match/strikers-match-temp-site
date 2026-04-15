'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService, type AdminStats } from '@/services/adminService';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-zinc-200 p-6">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-3xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { t } = useTranslation('admin');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getStats().then(({ data }) => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  const val = (n: number | undefined) => (loading ? '—' : (n ?? 0));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('admin.dashboard.title')}</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('admin.dashboard.totalUsers')} value={val(stats?.totalUsers)} />
        <StatCard label={t('admin.dashboard.totalFighters')} value={val(stats?.totalFighters)} />
        <StatCard label={t('admin.dashboard.totalEvents')} value={val(stats?.totalEvents)} />
        <StatCard
          label={t('admin.dashboard.pendingVerifications')}
          value={val(stats?.pendingVerifications)}
        />
      </div>

      {/* Quick links */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/admin/users', label: t('admin.nav.users') },
          { href: '/admin/fighters', label: t('admin.nav.fighters') },
          { href: '/admin/promoters', label: t('admin.nav.promoters') },
          { href: '/admin/managers', label: t('admin.nav.managers') },
          { href: '/admin/sponsors', label: t('admin.nav.sponsors') },
          { href: '/admin/events', label: t('admin.nav.events') },
          /* TEST — REMOVE BEFORE PRODUCTION */
          { href: '/admin/test-flow', label: '⚙ Test Flow' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="bg-white border border-zinc-200 px-6 py-4 flex items-center justify-between hover:bg-zinc-50 transition-colors group"
          >
            <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900">
              {link.label}
            </span>
            <svg className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
