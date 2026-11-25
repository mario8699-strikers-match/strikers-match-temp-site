'use client';

import { useTranslation } from 'react-i18next';
import { mediaPlatformLabel } from '@/lib/fighterMedia';
import type { FighterMediaCategory, FighterMediaLink } from '@/types';

export function FighterMediaShowcase({ links }: { links?: FighterMediaLink[] }) {
  const { t } = useTranslation('fighters');
  if (!links?.length) return null;

  const sections: Array<{ category: FighterMediaCategory; title: string }> = [
    { category: 'recent_fight', title: t('fighters.media.recentFights') },
    { category: 'highlight', title: t('fighters.media.highlights') },
  ];

  return (
    <section className="border border-zinc-200 bg-white p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C0001E]">{t('fighters.media.title')}</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {sections.map((section) => {
          const items = links.filter((link) => link.category === section.category);
          if (items.length === 0) return null;
          return (
            <div key={section.category}>
              <h2 className="font-display text-2xl font-black uppercase text-zinc-950">{section.title}</h2>
              <div className="mt-3 space-y-2">
                {items.map((item, index) => (
                  <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                    className="group flex min-h-16 items-center justify-between gap-4 border border-zinc-200 px-4 py-3 transition-colors hover:border-[#C0001E]">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-zinc-900">
                        {item.title || `${section.title} ${index + 1}`}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500">{mediaPlatformLabel(item.url)}</span>
                    </span>
                    <span className="shrink-0 text-xl text-[#C0001E] transition-transform group-hover:translate-x-1" aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
