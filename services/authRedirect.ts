import { isMinor, hasValidConsent } from '@/services/consentService';
import { VENDOR_ROLES } from '@/types';
import type { Profile } from '@/types';

/**
 * Centralized post-authentication redirect.
 * Used by login (after submit + on mount guard) and register (after sign-up
 * when Supabase auto-creates a session).
 */
export async function redirectAfterAuth(profile: Profile | null): Promise<void> {
  const role = profile?.role;

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
  if (role === 'fighter') {
    if (profile && isMinor(profile.date_of_birth)) {
      const consented = await hasValidConsent(profile.id);
      if (!consented) {
        window.location.href = '/consent';
        return;
      }
    }
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
