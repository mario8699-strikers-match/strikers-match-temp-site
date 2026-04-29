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
  const [health, setHealth] = useState<{ orphan_fighters: number; checked_at: string } | null>(null);
  const [healing, setHealing] = useState(false);
  const [healMsg, setHealMsg] = useState<string | null>(null);

  const loadHealth = () => {
    adminService.getHealthChecks().then(({ data }) => setHealth(data));
  };

  useEffect(() => {
    adminService.getStats().then(({ data }) => {
      setStats(data);
      setLoading(false);
    });
    loadHealth();
  }, []);

  const handleHeal = async () => {
    setHealing(true);
    setHealMsg(null);
    const { data, error } = await adminService.healOrphanFighters();
    setHealing(false);
    if (error) {
      setHealMsg(`Error: ${error}`);
    } else {
      setHealMsg(`Healed ${data} orphan profile${data === 1 ? '' : 's'}.`);
      loadHealth();
    }
  };

  const val = (n: number | undefined) => (loading ? '—' : (n ?? 0));
  const orphanCount = health?.orphan_fighters ?? null;
  const isHealthy = orphanCount === 0;

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

      {/* System Health */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-700">System Health</h2>
          <button
            onClick={loadHealth}
            className="text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
          >
            Refresh
          </button>
        </div>
        <div
          className={`border p-4 flex items-center justify-between ${
            orphanCount === null
              ? 'bg-zinc-50 border-zinc-200'
              : isHealthy
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div>
            <p className="text-sm font-medium text-zinc-900">
              Orphan fighter profiles
              <span className="ml-2 text-xs text-zinc-500 font-normal">
                (profiles with role=fighter missing a fighters row)
              </span>
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {orphanCount === null
                ? 'Checking…'
                : isHealthy
                ? 'All fighter profiles have a matching fighters row. ✓'
                : `${orphanCount} profile${orphanCount === 1 ? '' : 's'} invisible on /fighters and cannot apply to events.`}
            </p>
            {healMsg && <p className="text-xs mt-2 text-zinc-700">{healMsg}</p>}
          </div>
          {!isHealthy && orphanCount !== null && orphanCount > 0 && (
            <button
              onClick={handleHeal}
              disabled={healing}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-[#C0001E] hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {healing ? 'Healing…' : 'Heal now'}
            </button>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/admin/users', label: t('admin.nav.users') },
          { href: '/admin/fighters', label: t('admin.nav.fighters') },
          { href: '/admin/promoters', label: t('admin.nav.promoters') },
          { href: '/admin/managers', label: t('admin.nav.managers') },
          { href: '/admin/sponsors', label: t('admin.nav.sponsors') },
          { href: '/admin/vendors', label: t('admin.nav.vendors') },
          { href: '/admin/events', label: t('admin.nav.events') },
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
