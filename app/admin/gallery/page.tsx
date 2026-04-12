'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { galleryService } from '@/services/galleryService';
import { authService } from '@/services/authService';
import type { GalleryPhoto, Profile } from '@/types';

export default function AdminGalleryPage() {
  const { t } = useTranslation('gallery');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [eventName, setEventName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authService.getSession().then(({ data }) => {
      setProfile(data?.profile ?? null);
    });
    galleryService.getAll().then(({ data }) => {
      setPhotos(data ?? []);
      setLoading(false);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setUploadSuccess(false);
    setUploadError(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !profile) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    const { data, error } = await galleryService.upload(file, caption, eventName, profile.id);
    setUploading(false);

    if (error) {
      setUploadError(error);
    } else {
      setUploadSuccess(true);
      setFile(null);
      setPreview(null);
      setCaption('');
      setEventName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (data) setPhotos((prev) => [data, ...prev]);
    }
  };

  const handleDelete = async (photo: GalleryPhoto) => {
    if (!confirm(t('gallery.deleteConfirm'))) return;
    await galleryService.delete(photo.id, photo.storage_path);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">{t('gallery.adminTitle')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('gallery.adminSubtitle')}</p>
      </div>

      {/* ── Upload Form ───────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200 p-6 mb-10 max-w-xl">
        <h2 className="text-sm font-semibold text-zinc-900 mb-5">{t('gallery.uploadTitle')}</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          {uploadSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
              {t('gallery.uploadSuccess')}
            </div>
          )}
          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {uploadError}
            </div>
          )}

          {/* File picker */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {t('gallery.uploadFile')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              required
              className="block w-full text-sm text-zinc-500
                file:mr-3 file:py-1.5 file:px-4
                file:border-0 file:bg-zinc-900 file:text-white
                file:text-xs file:font-medium
                hover:file:bg-zinc-700 cursor-pointer"
            />
          </div>

          {/* Preview */}
          {preview && (
            <img
              src={preview}
              alt="preview"
              className="w-full max-h-56 object-cover border border-zinc-200"
            />
          )}

          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {t('gallery.uploadEventName')}
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder={t('gallery.uploadEventNamePlaceholder')}
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              {t('gallery.uploadCaption')}
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t('gallery.uploadCaptionPlaceholder')}
              rows={2}
              className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 text-sm resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="bg-zinc-900 text-white px-6 py-2 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? t('gallery.uploading') : t('gallery.uploadSubmit')}
          </button>
        </form>
      </div>

      {/* ── Photo Grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">{t('gallery.loading')}</div>
      ) : photos.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-200">
          <p className="text-zinc-500 text-sm">{t('gallery.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group border border-zinc-200 overflow-hidden bg-zinc-50"
            >
              <img
                src={photo.url}
                alt={photo.caption ?? ''}
                className="w-full h-40 object-cover"
              />
              {/* Delete overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                <button
                  onClick={() => handleDelete(photo)}
                  className="opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 font-medium transition-all"
                >
                  {t('gallery.delete')}
                </button>
              </div>
              {/* Meta */}
              {(photo.event_name || photo.caption) && (
                <div className="px-2 py-1.5 bg-white border-t border-zinc-100">
                  {photo.event_name && (
                    <p className="text-[10px] text-zinc-500 font-semibold truncate uppercase tracking-wider">
                      {photo.event_name}
                    </p>
                  )}
                  {photo.caption && (
                    <p className="text-[11px] text-zinc-700 truncate">{photo.caption}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
