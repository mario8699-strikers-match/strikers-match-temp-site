'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import { eventService } from '@/services/eventService';
import { authService } from '@/services/authService';
import type { Event, Profile } from '@/types';

const PAGE_SIZE = 15;

const STATUS_COLORS: Record<Event['status'], string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  published: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  completed: 'bg-blue-50 text-blue-700',
};

export default function EventsPage() {
  const { t } = useTranslation('events');
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [page, setPage] = useState(1);

  const canCreateEvent = profile?.role === 'promoter' || profile?.role === 'manager' || profile?.role === 'admin';

  useEffect(() => {
    eventService.getAll().then(({ data }) => {
      setEvents(data ?? []);
      setLoading(false);
    });
    authService.getSession().then(({ data }) => {
      setProfile(data?.profile ?? null);
    });
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('events.detail.notSpecified');
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const formatPurse = (amount: number | null) => {
    if (!amount) return t('events.detail.notSpecified');
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalPages = Math.ceil(events.length / PAGE_SIZE);
  const pageEvents = useMemo(
    () => events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [events, page]
  );

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="events" />

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>Strikers Match</p>
            <h1 className="font-display font-black uppercase leading-none" style={{ fontSize: 'clamp(2.5rem,6vw,4.5rem)', letterSpacing: '-0.02em', color: '#0A0A0A' }}>
              {t('events.title')}
            </h1>
            <p className="mt-2 text-sm" style={{ color: '#5A5A5A' }}>{t('events.subtitle')}</p>
          </div>
          {canCreateEvent && (
            <a
              href="/events/create"
              className="inline-block bg-brand-red text-white px-3 py-2 text-xs sm:text-sm sm:px-4 font-semibold hover:bg-brand-red-dark transition-colors whitespace-nowrap"
            >
              + {t('events.createEvent')}
            </a>
          )}
        </div>

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">
            {t('common.loading', { ns: 'common' })}
          </div>
        ) : events.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-900 font-medium">{t('events.noEvents')}</p>
            <p className="mt-1 text-sm text-zinc-500">{t('events.noEventsSubtitle')}</p>
            {canCreateEvent ? (
              <a
                href="/events/create"
                className="mt-6 inline-block bg-zinc-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                {t('events.createEvent')}
              </a>
            ) : (
              <a
                href="/login"
                className="mt-6 inline-block border border-zinc-300 text-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 transition-colors"
              >
                {t('events.loginToCreate')}
              </a>
            )}
          </div>
        ) : (
          <>
          <div className="border border-zinc-200 divide-y divide-zinc-100">
            {pageEvents.map((event) => {
              const isLoggedIn = !!profile;

              const inner = (
                <div className="flex gap-3 w-full min-w-0">
                  {/* Flyer thumbnail — always fully visible */}
                  <div className="flex-shrink-0">
                    {event.flyer_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.flyer_url}
                        alt={event.event_name}
                        className="w-14 h-14 sm:w-16 sm:h-16 object-cover border border-zinc-100"
                      />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-100 flex items-center justify-center border border-zinc-100">
                        <svg className="w-6 h-6 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name + status */}
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <p className={`text-sm font-semibold ${isLoggedIn ? 'text-zinc-900 group-hover:underline' : 'text-zinc-400'}`}>
                        {event.event_name}
                      </p>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium flex-shrink-0 ${STATUS_COLORS[event.status]}`}>
                        {t(`events.status.${event.status}`)}
                      </span>
                    </div>

                    {/* Meta — wraps gracefully on mobile */}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                      {event.event_date && (
                        <span className="whitespace-nowrap">
                          {formatDate(event.event_date)}
                          {event.event_time ? ` · ${event.event_time.slice(0, 5)} hrs` : ''}
                        </span>
                      )}
                      {event.city && (
                        <span className="whitespace-nowrap">{event.city}{event.venue ? ` — ${event.venue}` : ''}</span>
                      )}
                      {event.weight_class_needed && (
                        <span className="whitespace-nowrap">{t(`events.weightClasses.${event.weight_class_needed}`, { defaultValue: event.weight_class_needed })}</span>
                      )}
                      {event.purse_amount && (
                        <span className="whitespace-nowrap">{formatPurse(event.purse_amount)}</span>
                      )}
                    </div>

                    {/* Disciplines needed pills */}
                    {(event.disciplines_needed ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(event.disciplines_needed ?? []).map((d) => (
                          <span key={d} className="text-xs font-bold px-2 py-0.5 uppercase tracking-wide bg-[#0A0A0A] text-white">{d}</span>
                        ))}
                      </div>
                    )}

                    {/* Mobile-only: login CTA below meta */}
                    {!isLoggedIn && (
                      <a
                        href="/login"
                        onClick={e => e.stopPropagation()}
                        className="mt-2 inline-flex items-center gap-1 sm:hidden text-xs text-zinc-400 border border-dashed border-zinc-200 px-2 py-1 hover:bg-zinc-50 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Inicia sesión
                      </a>
                    )}
                  </div>

                  {/* Desktop-only right CTA */}
                  <div className="hidden sm:flex items-center flex-shrink-0 ml-2">
                    {isLoggedIn ? (
                      profile?.role === 'fighter' ? (
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(`/events/${event.id}`); }}
                          className="text-xs font-bold tracking-widest uppercase text-white px-3 py-1.5 transition-colors whitespace-nowrap"
                          style={{ background: '#C0001E' }}>
                          Aplicar
                        </button>
                      ) : (
                        <svg className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )
                    ) : (
                      <button onClick={e => { e.preventDefault(); e.stopPropagation(); router.push('/login'); }}
                        className="text-xs text-zinc-400 border border-dashed border-zinc-200 px-2 py-1 hover:bg-zinc-50 transition-colors whitespace-nowrap">
                        Inicia sesión
                      </button>
                    )}
                  </div>
                </div>
              );

              return isLoggedIn ? (
                <a key={event.id} href={`/events/${event.id}`} className="flex items-center gap-4 px-4 sm:px-6 py-4 sm:py-5 hover:bg-zinc-50 transition-colors group">
                  {inner}
                </a>
              ) : (
                <div key={event.id} className="flex items-center gap-4 px-4 sm:px-6 py-4 sm:py-5 cursor-default">
                  {inner}
                </div>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} labels={{ prev: t('common.previous', { ns: 'common', defaultValue: 'Anterior' }), next: t('common.next', { ns: 'common', defaultValue: 'Siguiente' }) }} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
