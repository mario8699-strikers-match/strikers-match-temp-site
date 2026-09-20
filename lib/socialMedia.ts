export const SOCIAL_MEDIA_PLATFORMS = [
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: '@usuario o instagram.com/usuario',
    baseUrl: 'https://www.instagram.com/',
    hosts: ['instagram.com', 'www.instagram.com'],
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: '@usuario o tiktok.com/@usuario',
    baseUrl: 'https://www.tiktok.com/@',
    hosts: ['tiktok.com', 'www.tiktok.com'],
  },
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'usuario o facebook.com/usuario',
    baseUrl: 'https://www.facebook.com/',
    hosts: ['facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com'],
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: '@canal o youtube.com/@canal',
    baseUrl: 'https://www.youtube.com/@',
    hosts: ['youtube.com', 'www.youtube.com'],
  },
  {
    key: 'x_handle',
    label: 'X',
    placeholder: '@usuario o x.com/usuario',
    baseUrl: 'https://x.com/',
    hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
  },
] as const;

export type SocialMediaPlatform = (typeof SOCIAL_MEDIA_PLATFORMS)[number]['key'];

export type SocialMediaHandles = Record<SocialMediaPlatform, string | null>;

function getPlatform(platform: SocialMediaPlatform) {
  return SOCIAL_MEDIA_PLATFORMS.find((item) => item.key === platform)!;
}

function parseProfileUrl(value: string): URL | null {
  const trimmed = value.trim();
  const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed) || trimmed.includes('/');
  if (!looksLikeUrl) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function isValidSocialMediaIdentifier(platform: SocialMediaPlatform, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.length > 255) return false;

  const url = parseProfileUrl(trimmed);
  if (url) {
    const hosts: readonly string[] = getPlatform(platform).hosts;
    return hosts.includes(url.hostname.toLowerCase()) && url.pathname !== '/';
  }

  return /^[A-Za-z0-9._-]{1,100}$/.test(trimmed.replace(/^@/, ''));
}

export function normalizeSocialMediaIdentifier(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const url = parseProfileUrl(trimmed);
  if (url) {
    url.protocol = 'https:';
    url.hash = '';
    return url.toString();
  }

  return trimmed.replace(/^@/, '');
}

export function getSocialMediaHref(platform: SocialMediaPlatform, value: string): string | null {
  if (!isValidSocialMediaIdentifier(platform, value)) return null;

  const normalized = normalizeSocialMediaIdentifier(value);
  if (!normalized) return null;

  const url = parseProfileUrl(normalized);
  return url?.toString() ?? `${getPlatform(platform).baseUrl}${encodeURIComponent(normalized)}`;
}

export function getSocialMediaDisplayValue(value: string): string {
  const normalized = normalizeSocialMediaIdentifier(value);
  if (!normalized) return '';

  const url = parseProfileUrl(normalized);
  if (!url) return `@${normalized}`;

  const lastPathPart = url.pathname.split('/').filter(Boolean).at(-1);
  if (!lastPathPart || lastPathPart === 'profile.php') return 'Ver perfil';
  return `@${decodeURIComponent(lastPathPart).replace(/^@/, '')}`;
}
