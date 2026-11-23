import type { UserRole } from '@/types';

export const EVENT_CREATOR_ROLES = [
  'admin',
  'manager',
  'promoter',
  'gyms_academies',
] as const satisfies readonly UserRole[];

export function canCreateEvent(role?: string | null): boolean {
  return EVENT_CREATOR_ROLES.includes(role as (typeof EVENT_CREATOR_ROLES)[number]);
}
