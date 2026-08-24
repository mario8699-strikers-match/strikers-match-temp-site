import { isMinor, hasValidConsent } from '@/services/consentService';
import { VENDOR_ROLES } from '@/types';
import type { Profile } from '@/types';

export function getSafeAuthNextPath(nextPath?: string | null): string | null {
  if (!nextPath || typeof window === 'undefined') return null;
  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) return null;

  try {
    const url = new URL(nextPath, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (url.pathname === '/login' || url.pathname === '/register') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Centralized post-authentication redirect.
 * Used by login (after submit + on mount guard) and register (after sign-up
 * when Supabase auto-creates a session).
 */
export async function redirectAfterAuth(profile: Profile | null, nextPath?: string | null): Promise<void> {
  const role = profile?.role;
  const safeNextPath = getSafeAuthNextPath(nextPath ?? new URLSearchParams(window.location.search).get('next'));

  if (role === 'fighter') {
    if (profile && isMinor(profile.date_of_birth)) {
      const consented = await hasValidConsent(profile.id);
      if (!consented) {
        window.location.href = '/consent';
        return;
      }
    }
  }

  if (safeNextPath) {
    window.location.href = safeNextPath;
    return;
  }

  if (role === 'admin') {
    window.location.href = '/admin';
    return;
  }
  if (role === 'promoter') {
    window.location.href = '/events';
    return;
  }
  if (role === 'manager') {
    window.location.href = '/manager/dashboard';
    return;
  }
  if (role === 'spectator') {
    window.location.href = '/spectator/dashboard';
    return;
  }
  if (role === 'fighter') {
    window.location.href = '/fighter/profile';
    return;
  }
  if (role === 'sponsor') {
    window.location.href = '/sponsor/dashboard';
    return;
  }
  if (role && VENDOR_ROLES.includes(role)) {
    window.location.href = '/vendor/profile';
    return;
  }
  window.location.href = '/';
}
