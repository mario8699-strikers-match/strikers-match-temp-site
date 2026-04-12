/**
 * Access Control Service — Role-based feature gating for Strikers Match.
 *
 * Rules:
 *   - fighter: cannot send requests, can receive requests
 *   - promoter / manager: full access (subject to subscription)
 *   - sponsor: can browse and contact, cannot send fight requests
 *   - vendors: can create profile, can be contacted, cannot initiate contact
 *   - admin: full access
 *
 * Monetization checks apply ONLY to: promoter, manager, sponsor
 * Fighters and vendors are FREE users.
 */

import type { UserRole } from '@/types';
import { VENDOR_ROLES } from '@/types';

export type Feature =
  | 'send_fight_request'
  | 'emergency_replacement'
  | 'contact_vendor'
  | 'view_profiles'
  | 'create_profile';

interface UserForAccess {
  role: UserRole;
}

const FEATURE_RULES: Record<Feature, (role: UserRole) => boolean> = {
  /**
   * send_fight_request — only promoter and manager can send fight requests.
   * Sponsor cannot. Fighter cannot (they receive, not send). Vendors cannot.
   */
  send_fight_request: (role) => role === 'promoter' || role === 'manager' || role === 'admin',

  /**
   * emergency_replacement — same as fight requests (promoter/manager action).
   */
  emergency_replacement: (role) => role === 'promoter' || role === 'manager' || role === 'admin',

  /**
   * contact_vendor — promoter, manager, sponsor can contact vendors.
   * Vendors cannot initiate contact. Fighters cannot.
   */
  contact_vendor: (role) =>
    role === 'promoter' || role === 'manager' || role === 'sponsor' || role === 'admin',

  /**
   * view_profiles — everyone can view profiles (browsing is free).
   */
  view_profiles: () => true,

  /**
   * create_profile — fighters, vendors, and all paid roles can create profiles.
   */
  create_profile: (role) =>
    role === 'fighter' ||
    role === 'promoter' ||
    role === 'manager' ||
    role === 'sponsor' ||
    role === 'admin' ||
    VENDOR_ROLES.includes(role),
};

/**
 * Check if a user can access a specific feature based on their role.
 * Returns true/false.
 */
export function canAccessFeature(user: UserForAccess, feature: Feature): boolean {
  const rule = FEATURE_RULES[feature];
  if (!rule) return false;
  return rule(user.role);
}

/**
 * Check if a role requires monetization/subscription checks.
 * Only promoter, manager, and sponsor are monetized.
 * Fighters, vendors, and admins are free.
 */
export function requiresSubscription(role: UserRole): boolean {
  if (role === 'admin') return false;
  return role === 'promoter' || role === 'manager' || role === 'sponsor';
}
