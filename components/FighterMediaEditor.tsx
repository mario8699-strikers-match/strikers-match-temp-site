'use client';

import { useTranslation } from 'react-i18next';
import type { FighterMediaCategory } from '@/types';
import type { FighterMediaDraftItem } from '@/lib/fighterMedia';

type FighterMediaEditorProps = {
  value: FighterMediaDraftItem[];
  onChange: (value: FighterMediaDraftItem[]) => void;
};

const MAX_MEDIA_LINKS = 8;

export function FighterMediaEditor({ value, onChange }: FighterMediaEditorProps) {
  const { t } = useTranslation('fighters');

  const add = (category: FighterMediaCategory) => {
    if (value.length >= MAX_MEDIA_LINKS) return;
    onChange([...value, { category, title: '', url: '' }]);
  };

  return (
    <section className="border border-zinc-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-700">{t('fighters.media.title')}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{t('fighters.media.help')}</p>
        </div>
        <span className="text-xs tabular-nums text-zinc-400">{value.length}/{MAX_MEDIA_LINKS}</span>
      </div>

      <div className="mt-4 space-y-3">
        {value.map((item, index) => (
          <div key={`${item.category}-${index}`} className="grid gap-2 border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-[150px_1fr_1.5fr_auto]">
            <select
              value={item.category}
              onChange={(event) => onChange(value.map((current, currentIndex) => currentIndex === index
                ? { ...current, category: event.target.value as FighterMediaCategory }
                : current))}
              className="border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              aria-label={t('fighters.media.type')}
            >
              <option value="recent_fight">{t('fighters.media.recentFight')}</option>
              <option value="highlight">{t('fighters.media.highlight')}</option>
            </select>
            <input
              type="text"
              value={item.title}
              onChange={(event) => onChange(value.map((current, currentIndex) => currentIndex === index
                ? { ...current, title: event.target.value }
                : current))}
              maxLength={120}
              placeholder={t('fighters.media.titlePlaceholder')}
              aria-label={t('fighters.media.linkTitle')}
              className="border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
            <input
              type="url"
              inputMode="url"
              value={item.url}
              onChange={(event) => onChange(value.map((current, currentIndex) => currentIndex === index
                ? { ...current, url: event.target.value }
                : current))}
              placeholder="https://youtube.com/..."
              aria-label={t('fighters.media.url')}
              className="border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, currentIndex) => currentIndex !== index))}
              className="border border-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-600 hover:border-red-300 hover:text-red-700"
            >
              {t('fighters.media.remove')}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={value.length >= MAX_MEDIA_LINKS} onClick={() => add('recent_fight')}
          className="border border-zinc-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-900 disabled:opacity-40">
          + {t('fighters.media.addRecentFight')}
        </button>
        <button type="button" disabled={value.length >= MAX_MEDIA_LINKS} onClick={() => add('highlight')}
          className="border border-zinc-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-900 disabled:opacity-40">
          + {t('fighters.media.addHighlight')}
        </button>
      </div>
    </section>
  );
}
