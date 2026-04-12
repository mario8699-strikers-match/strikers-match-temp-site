'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { galleryService } from '@/services/galleryService';
import type { GalleryPhoto } from '@/types';

export default function GalleryPage() {
  const { t } = useTranslation('gallery');
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GalleryPhoto | null>(null);

  useEffect(() => {
    galleryService.getAll().then(({ data }) => {
      setPhotos(data ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="gallery" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-zinc-900">{t('gallery.title')}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t('gallery.subtitle')}</p>
        </div>

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">{t('gallery.loading')}</div>
        ) : photos.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-900 font-medium">{t('gallery.empty')}</p>
            <p className="mt-1 text-sm text-zinc-500">{t('gallery.emptySubtitle')}</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="break-inside-avoid border border-zinc-200 overflow-hidden hover:border-zinc-400 transition-colors cursor-pointer group"
                onClick={() => setSelected(photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption ?? photo.event_name ?? 'Strikers Match'}
                  className="w-full object-cover group-hover:opacity-90 transition-opacity"
                />
                {(photo.caption || photo.event_name) && (
                  <div className="px-3 py-2 bg-white">
                    {photo.event_name && (
                      <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                        {photo.event_name}
                      </p>
                    )}
                    {photo.caption && (
                      <p className="text-xs text-zinc-700 mt-0.5">{photo.caption}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <button
            onClick={() => setSelected(null)}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-3xl leading-none z-10"
            aria-label="Close"
          >
            ×
          </button>
          <div
            className="max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selected.url}
              alt={selected.caption ?? ''}
              className="w-full max-h-[80vh] object-contain"
            />
            {(selected.caption || selected.event_name) && (
              <div className="bg-zinc-900/80 px-5 py-3">
                {selected.event_name && (
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {selected.event_name}
                  </p>
                )}
                {selected.caption && (
                  <p className="text-sm text-white mt-0.5">{selected.caption}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
