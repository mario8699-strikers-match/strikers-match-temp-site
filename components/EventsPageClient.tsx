'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import { authService } from '@/services/authService';
import { formatLocalizedCurrency, formatLocalizedDate } from '@/lib/locale';
import { countryFlagEmoji, getCountryName } from '@/lib/countries';
import { eventPublicPath } from '@/lib/publicUrls';
import { canCreateEvent } from '@/lib/eventPermissions';
import type { Event, Profile } from '@/types';

const PAGE_SIZE = 15;

const STATUS_COLORS: Record<Event['status'], string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  published: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  completed: 'bg-blue-50 text-blue-700',
};

interface EventsPageClientProps {
  initialEvents: Event[];
}

export function EventsPageClient({ initialEvents }: EventsPageClientProps) {
  const { t, i18n } = useTranslation('events');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [events] = useState<Event[]>(initialEvents);
  const [loading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [page, setPage] = useState(1);
  const selectedCountry = searchParams.get('country')?.toUpperCase() ?? '';

  const canCreate = canCreateEvent(profile?.role);

  useEffect(() => {
    authService.getSession().then(({ data }) => {
      setProfile(data?.profile ?? null);
    });
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('events.detail.notSpecified');
    const [year, month, day] = dateStr.split('-').map(Number);
    return formatLocalizedDate(new Date(year, month - 1, day), i18n.resolvedLanguage, {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const formatPurse = (amount: number | null, currency = 'MXN') => {
    if (!amount) return t('events.detail.notSpecified');
    return formatLocalizedCurrency(amount, currency, i18n.resolvedLanguage);
  };

  const countryOptions = useMemo(() => [...new Set(events
    .map((event) => event.country_code?.trim().toUpperCase())
    .filter((code): code is string => Boolean(code)))]
    .sort((a, b) => getCountryName(a, i18n.resolvedLanguage).localeCompare(
      getCountryName(b, i18n.resolvedLanguage),
      i18n.resolvedLanguage,
      { sensitivity: 'base' },
    )), [events, i18n.resolvedLanguage]);

  const filteredEvents = useMemo(() => {
    const visible = selectedCountry
      ? events.filter((event) => event.country_code?.toUpperCase() === selectedCountry)
      : events;
    return [...visible].sort((a, b) => {
      const countryComparison = getCountryName(a.country_code, i18n.resolvedLanguage).localeCompare(
        getCountryName(b.country_code, i18n.resolvedLanguage),
        i18n.resolvedLanguage,
        { sensitivity: 'base' },
      );
      if (countryComparison !== 0) return countryComparison;
      return (a.event_date ?? '').localeCompare(b.event_date ?? '');
    });
  }, [events, i18n.resolvedLanguage, selectedCountry]);

  const updateCountry = (countryCode: string) => {
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (countryCode) params.set('country', countryCode);
    else params.delete('country');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const totalPages = Math.ceil(filteredEvents.length / PAGE_SIZE);
  const pageEvents = useMemo(
    () => filteredEvents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredEvents, page]
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
          {canCreate && (
            <Link
              href="/events/create"
              className="inline-block bg-brand-red text-white px-3 py-2 text-xs sm:text-sm sm:px-4 font-semibold hover:bg-brand-red-dark transition-colors whitespace-nowrap"
            >
              + {t('events.createEvent')}
            </Link>
          )}
        </div>

        {events.length > 0 && (
          <div className="mb-8 max-w-sm">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-zinc-700">{t('events.countryFilter.label')}</span>
              <select
                value={selectedCountry}
                onChange={(event) => updateCountry(event.target.value)}
                className="min-h-12 w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
              >
                <option value="">{t('events.countryFilter.all')}</option>
                {countryOptions.map((code) => (
                  <option key={code} value={code}>{countryFlagEmoji(code)} {getCountryName(code, i18n.resolvedLanguage)}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">
            {t('common.loading', { ns: 'common' })}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-900 font-medium">{t('events.noEvents')}</p>
            <p className="mt-1 text-sm text-zinc-500">{t('events.noEventsSubtitle')}</p>
            {canCreate ? (
              <Link
                href="/events/create"
                className="mt-6 inline-block bg-zinc-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                {t('events.createEvent')}
              </Link>
            ) : (
              <Link
                href="/login"
                className="mt-6 inline-block border border-zinc-300 text-zinc-700 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 transition-colors"
              >
                {t('events.loginToCreate')}
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pageEvents.map((event, index) => {
              const publicPath = eventPublicPath(event);
              const participatePath = `${publicPath}?action=participate`;
              const participateHref = profile
                ? participatePath
                : `/login?next=${encodeURIComponent(participatePath)}`;
              const canManageListedEvent = Boolean(profile
                && (profile.role === 'admin' || event.promoter_id === profile.id));
              const countryCode = event.country_code?.trim().toUpperCase() ?? '';
              const previousCountryCode = index > 0
                ? pageEvents[index - 1]?.country_code?.trim().toUpperCase() ?? ''
                : null;

              return (
                <Fragment key={event.id}>
                {countryCode !== previousCountryCode && (
                  <div className="border-b-2 border-zinc-900 pb-2 sm:col-span-2 lg:col-span-3">
                    <h2 className="font-display text-2xl font-black uppercase text-zinc-950">
                      {countryCode
                        ? `${countryFlagEmoji(countryCode)} ${getCountryName(countryCode, i18n.resolvedLanguage)}`
                        : t('events.countryFilter.unspecified')}
                    </h2>
                  </div>
                )}
                <article key={event.id} className="flex h-full flex-col overflow-hidden border border-zinc-200 bg-white">
                  <Link href={publicPath} className="block bg-zinc-50">
                    <div className="flex aspect-[2/3] w-full items-center justify-center bg-zinc-50">
                      {event.flyer_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.flyer_url}
                          alt={event.event_name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center border-b border-zinc-100 px-6 text-center">
                          <span className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">
                            {t('events.public.noPoster')}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <Link href={publicPath} className="group min-w-0">
                        <h2 className="font-display text-2xl font-black uppercase leading-none text-zinc-950 group-hover:text-[#C0001E]">
                          {event.event_name}
                        </h2>
                      </Link>
                      <span className={`inline-flex shrink-0 px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[event.status]}`}>
                        {t(`events.status.${event.status}`)}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-zinc-600">
                      {event.country_code && (
                        <p>{countryFlagEmoji(event.country_code)} {getCountryName(event.country_code, i18n.resolvedLanguage)}</p>
                      )}
                      {event.event_date && (
                        <p>
                          {formatDate(event.event_date)}
                          {event.event_time ? ` · ${event.event_time.slice(0, 5)} hrs` : ''}
                        </p>
                      )}
                      {event.city && (
                        <p>{event.city}{event.venue ? ` — ${event.venue}` : ''}</p>
                      )}
                      {event.weight_class_needed && (
                        <p>{t(`events.weightClasses.${event.weight_class_needed}`, { defaultValue: event.weight_class_needed })}</p>
                      )}
                      {event.purse_amount && (
                        <p>{formatPurse(event.purse_amount, event.currency)}</p>
                      )}
                    </div>

                    {(event.disciplines_needed ?? []).length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {(event.disciplines_needed ?? []).map((d) => (
                          <span key={d} className="bg-[#0A0A0A] px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">{d}</span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto grid grid-cols-1 gap-2 pt-5 sm:grid-cols-2">
                      <Link
                        href={publicPath}
                        className="min-h-11 border border-zinc-300 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-zinc-800 transition-colors hover:bg-zinc-50"
                      >
                        {t('events.public.viewEvent')}
                      </Link>
                      <Link
                        href={canManageListedEvent
                          ? `/events/${event.id}/manage/matchmaking`
                          : participateHref}
                        className="min-h-11 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#9A0018]"
                        style={{ background: '#C0001E' }}
                      >
                        {canManageListedEvent
                          ? t('events.public.manageMatchmaking')
                          : t('events.public.participate')}
                      </Link>
                    </div>
                  </div>
                </article>
                </Fragment>
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
