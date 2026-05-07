'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/adminService';
import type { Event } from '@/types';

type EventWithPromoter = Event & { profiles: { full_name: string } };

const STATUS_COLORS: Record<Event['status'], string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  published: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  completed: 'bg-blue-50 text-blue-700',
};

export default function AdminEventsPage() {
  const { t } = useTranslation('admin');
  const { t: tEvents } = useTranslation('events');

  const [events, setEvents] = useState<EventWithPromoter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getAllEvents().then(({ data }) => {
      setEvents((data as EventWithPromoter[]) ?? []);
      setLoading(false);
    });
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const formatPurse = (amount: number | null) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">{t('admin.events.title')}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t('admin.events.subtitle')}</p>
        </div>
        <a
          href="/events/create"
          className="w-full sm:w-auto text-center bg-zinc-900 text-white px-4 py-2 text-sm font-medium hover:bg-zinc-800 transition-colors whitespace-nowrap"
        >
          + {tEvents('events.createEvent')}
        </a>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">—</div>
      ) : events.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200 text-zinc-500 text-sm">
          {t('admin.events.noEvents')}
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {[
                  { key: 'name', label: t('admin.events.name') },
                  { key: 'date', label: t('admin.events.date') },
                  { key: 'city', label: t('admin.events.city') },
                  { key: 'promoter', label: t('admin.events.promoter') },
                  { key: 'status', label: t('admin.events.status') },
                  { key: 'weightClass', label: t('admin.events.weightClass') },
                  { key: 'purse', label: t('admin.events.purse') },
                ].map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                    <a
                      href={`/events/${event.id}`}
                      className="hover:underline"
                    >
                      {event.event_name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {formatDate(event.event_date)}
                    {event.event_time ? <span className="text-zinc-400 ml-1">{event.event_time.slice(0, 5)}</span> : ''}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {event.city ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {event.profiles?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[event.status]}`}>
                      {tEvents(`events.status.${event.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {event.weight_class_needed
                      ? tEvents(`events.weightClasses.${event.weight_class_needed}`, { defaultValue: event.weight_class_needed })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {formatPurse(event.purse_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
