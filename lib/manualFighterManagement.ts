import type { UserRole } from '@/types';

export function manualFighterManagementPath(role: UserRole | string | null | undefined, fighterId: string) {
  const query = `rosterFighter=${encodeURIComponent(fighterId)}`;
  const fragment = `manual-fighter-${encodeURIComponent(fighterId)}`;

  if (role === 'manager') return `/manager/dashboard?${query}#${fragment}`;
  if (role === 'promoter') return `/promoter/dashboard?${query}#${fragment}`;
  if (role === 'gyms_academies') return `/vendor/profile?${query}#${fragment}`;
  return `/admin/fighters?${query}#${fragment}`;
}
