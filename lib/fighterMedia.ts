import type { FighterMediaCategory, FighterMediaLink } from '@/types';

export type FighterMediaDraftItem = {
  category: FighterMediaCategory;
  title: string;
  url: string;
};

export function isValidFighterMediaUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function mediaDraftFromLinks(links?: FighterMediaLink[]): FighterMediaDraftItem[] {
  return (links ?? []).map((link) => ({
    category: link.category,
    title: link.title ?? '',
    url: link.url,
  }));
}

export function mediaRowsFromDraft(items: FighterMediaDraftItem[]) {
  return items
    .filter((item) => item.url.trim())
    .map((item, sortOrder) => ({
      category: item.category,
      title: item.title.trim().slice(0, 120) || null,
      url: item.url.trim(),
      sort_order: sortOrder,
    }));
}

export function mediaPlatformLabel(value: string) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, '');
    if (hostname === 'youtu.be' || hostname.endsWith('youtube.com')) return 'YouTube';
    if (hostname.endsWith('instagram.com')) return 'Instagram';
    if (hostname.endsWith('tiktok.com')) return 'TikTok';
    if (hostname.endsWith('facebook.com')) return 'Facebook';
    if (hostname === 'x.com' || hostname.endsWith('twitter.com')) return 'X';
    return hostname;
  } catch {
    return '';
  }
}
