'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { directoryService } from '@/services/directoryService';
import type { BusinessListing, BusinessListingStatus } from '@/types';

type StatusFilter = BusinessListingStatus | 'all';

const STATUS_OPTIONS: StatusFilter[] = ['all', 'pending_review', 'published', 'rejected', 'expired', 'draft'];

export default function AdminGalleryPage() {
  const { t } = useTranslation('gallery');
  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending_review');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error } = await directoryService.getAllForAdmin();
      if (!active) return;
      if (error) setError(error);
      setListings(data ?? []);
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, []);

  const filteredListings = useMemo(() => {
    if (filter === 'all') return listings;
    return listings.filter((listing) => listing.status === filter);
  }, [filter, listings]);

  const updateStatus = async (listing: BusinessListing, status: BusinessListingStatus) => {
    setUpdatingId(listing.id);
    setError(null);
    const { data, error } = await directoryService.updateStatus(listing.id, status);
    if (error || !data) {
      setError(error ?? t('gallery.admin.errors.updateFailed'));
    } else {
      setListings((prev) => prev.map((item) => item.id === listing.id ? data : item));
    }
    setUpdatingId(null);
  };

  const updateFeatured = async (listing: BusinessListing, isFeatured: boolean) => {
    setUpdatingId(listing.id);
    setError(null);
    const { data, error } = await directoryService.setFeatured(listing.id, isFeatured);
    if (error || !data) {
      setError(error ?? t('gallery.admin.errors.updateFailed'));
    } else {
      setListings((prev) => prev.map((item) => item.id === listing.id ? data : item));
    }
    setUpdatingId(null);
  };

  const deleteListing = async (listing: BusinessListing) => {
    if (!confirm(t('gallery.admin.deleteConfirm'))) return;

    setUpdatingId(listing.id);
    setError(null);
    const { error } = await directoryService.delete(listing.id, listing.image_storage_path);
    if (error) {
      setError(error);
    } else {
      setListings((prev) => prev.filter((item) => item.id !== listing.id));
    }
    setUpdatingId(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('gallery.adminTitle')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('gallery.adminSubtitle')}</p>
      </div>

      {error && (
        <div className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`min-h-10 border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              filter === status
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500'
            }`}
          >
            {status === 'all' ? t('gallery.admin.status.all') : t(`gallery.admin.status.${status}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">{t('gallery.loading')}</div>
      ) : filteredListings.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200">
          <p className="text-zinc-500 text-sm">{t('gallery.admin.empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredListings.map((listing) => (
            <article key={listing.id} className="border border-zinc-200 bg-white p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[140px_minmax(0,1fr)_auto]">
                {listing.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.image_url} alt={listing.title} className="h-36 w-full object-cover lg:w-36" />
                ) : (
                  <div className="flex h-36 w-full items-center justify-center bg-zinc-100 text-center text-xs font-bold uppercase tracking-widest text-zinc-400 lg:w-36">
                    {t(`gallery.categories.${listing.category}`)}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="bg-zinc-100 px-2 py-1 text-xs font-bold uppercase tracking-widest text-zinc-600">
                      {t(`gallery.admin.status.${listing.status}`)}
                    </span>
                    <span className="bg-zinc-100 px-2 py-1 text-xs font-bold uppercase tracking-widest text-zinc-600">
                      {t(`gallery.categories.${listing.category}`)}
                    </span>
                    {listing.is_featured && (
                      <span className="bg-zinc-900 px-2 py-1 text-xs font-bold uppercase tracking-widest text-white">
                        {t('gallery.featured')}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-black uppercase text-zinc-950">{listing.title}</h2>
                  {(listing.city || listing.state) && (
                    <p className="mt-1 text-sm text-zinc-500">{[listing.city, listing.state].filter(Boolean).join(', ')}</p>
                  )}
                  {listing.description && (
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-700">{listing.description}</p>
                  )}
                  <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    {listing.phone && <DirectoryMeta label={t('gallery.form.fields.phone')} value={listing.phone} />}
                    {listing.email && <DirectoryMeta label={t('gallery.form.fields.email')} value={listing.email} />}
                    {listing.website_url && <DirectoryMeta label={t('gallery.form.fields.website')} value={listing.website_url} />}
                    {listing.instagram && <DirectoryMeta label={t('gallery.form.fields.instagram')} value={`@${listing.instagram}`} />}
                  </dl>
                </div>

                <div className="flex flex-col gap-2 lg:min-w-40">
                  {listing.status !== 'published' && (
                    <button
                      type="button"
                      disabled={updatingId === listing.id}
                      onClick={() => void updateStatus(listing, 'published')}
                      className="min-h-10 bg-zinc-900 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                    >
                      {t('gallery.admin.actions.publish')}
                    </button>
                  )}
                  {listing.status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={updatingId === listing.id}
                      onClick={() => void updateStatus(listing, 'rejected')}
                      className="min-h-10 border border-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700 disabled:opacity-50"
                    >
                      {t('gallery.admin.actions.reject')}
                    </button>
                  )}
                  {listing.status === 'published' && (
                    <button
                      type="button"
                      disabled={updatingId === listing.id}
                      onClick={() => void updateFeatured(listing, !listing.is_featured)}
                      className="min-h-10 border border-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700 disabled:opacity-50"
                    >
                      {listing.is_featured ? t('gallery.admin.actions.unfeature') : t('gallery.admin.actions.feature')}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={updatingId === listing.id}
                    onClick={() => void deleteListing(listing)}
                    className="min-h-10 border border-red-200 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-600 disabled:opacity-50"
                  >
                    {t('gallery.admin.actions.delete')}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function DirectoryMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words text-zinc-800">{value}</dd>
    </div>
  );
}
