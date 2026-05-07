/**
 * Subscription Service — Role-based monetization layer.
 *
 * canPerformAction(profileId, role, action) — SINGLE entry point for ALL paywall checks.
 *
 * Roles:
 *   - fighter / vendors   → never charged, cannot access paid actions
 *   - promoter / manager  → send_fight_request, emergency_replacement, bulk_actions
 *   - sponsor             → contact_users
 *   - admin               → bypasses everything
 *
 * Free request rule:
 *   - Only promoter and manager get 1 FREE fight request (one-time)
 *   - Sponsors do NOT get a free request — always require payment
 *
 * Plan logic:
 *   - pro:          unlimited requests → always allowed
 *   - basic:        allowed if requests_used < max_requests
 *   - free:         allowed if free_request_used = false (promoter/manager only, never resets)
 *   - per_request:  allowed if requests_used < max_requests (pre-purchased credits)
 */

import { supabase } from '@/lib/supabaseClient';
import type {
  SubscriptionCheck,
  ServiceResponse,
  PromoterSubscription,
  PaidAction,
} from '@/types';
import { VENDOR_ROLES, FREE_REQUEST_ROLES, ROLE_ALLOWED_ACTIONS } from '@/types';

// ── Helpers ──────────────────────────────────────────────

async function isAdmin(profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profileId)
    .single();
  return data?.role === 'admin';
}

function isFreeRole(role: string): boolean {
  return role === 'fighter' || (VENDOR_ROLES as string[]).includes(role);
}

// ── Main: canPerformAction ───────────────────────────────

/**
 * Unified paywall gate.
 *
 * @param profileId - Supabase auth user id
 * @param role      - User's role from profile
 * @param action    - The paid action being attempted
 */
export async function canPerformAction(
  profileId: string,
  role: string,
  action: PaidAction,
): Promise<SubscriptionCheck> {
  try {
    // 1. Admin bypass — full access, no paywall
    if (role === 'admin' || (await isAdmin(profileId))) {
      return { allowed: true, reason: '', requestsUsed: 0, action };
    }

    // 2. Fighters + vendors → never charged, cannot access paid actions
    if (isFreeRole(role)) {
      return {
        allowed: false,
        reason: 'Esta acción no está disponible para tu tipo de cuenta.',
        requestsUsed: 0,
        action,
      };
    }

    // 3. Check role → action mapping
    const allowedActions = ROLE_ALLOWED_ACTIONS[role];
    if (!allowedActions || !allowedActions.includes(action)) {
      return {
        allowed: false,
        reason: 'Tu cuenta no tiene acceso a esta acción.',
        requestsUsed: 0,
        action,
      };
    }

    // 4. Subscription check
    let { data: sub, error: selectErr } = await supabase
      .from('promoter_subscriptions')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (selectErr) {
      console.error(`[SUB] SELECT error: ${selectErr.message}`);
    }

    // Auto-create free tier if no subscription exists
    if (!sub) {
      const getsFreeTrial = FREE_REQUEST_ROLES.includes(role as never);

      const { data: newSub, error: insertErr } = await supabase
        .from('promoter_subscriptions')
        .insert({
          profile_id: profileId,
          plan_type: 'free',
          requests_used: 0,
          max_requests: 1,
          is_active: true,
          trial_used: !getsFreeTrial,        // sponsors start with trial marked used
          free_request_used: !getsFreeTrial,  // sponsors don't get a free request
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`[SUB] INSERT error: ${insertErr.message}`);
        return {
          allowed: false,
          reason: `Error al crear suscripción: ${insertErr.message}`,
          requestsUsed: 0,
          action,
        };
      }
      sub = newSub;
    }

    const subscription = sub as PromoterSubscription;
    console.log(
      `[SUB] canPerformAction: role=${role}, action=${action}, plan=${subscription.plan_type}, ` +
      `free_used=${subscription.free_request_used}, used=${subscription.requests_used}, active=${subscription.is_active}`,
    );

    // Check active
    if (!subscription.is_active) {
      return {
        allowed: false,
        reason: 'Tu suscripción está inactiva.',
        requestsUsed: subscription.requests_used,
        action,
      };
    }

    // Check expiration
    if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
      return {
        allowed: false,
        reason: 'Tu plan ha expirado.',
        requestsUsed: subscription.requests_used,
        action,
      };
    }

    // ── Plan-specific logic ──
    const { plan_type } = subscription;

    // ANALYTICS DASHBOARD: Pro tier only
    if (action === 'analytics_dashboard') {
      if (plan_type === 'pro') {
        return { allowed: true, reason: '', requestsUsed: subscription.requests_used, action };
      }
      return {
        allowed: false,
        reason: 'El panel de analytics está disponible solo para el plan Pro.',
        requestsUsed: subscription.requests_used,
        action,
      };
    }

    // PRO: unlimited
    if (plan_type === 'pro') {
      return { allowed: true, reason: '', requestsUsed: subscription.requests_used, action };
    }

    // BASIC: check limit
    if (plan_type === 'basic') {
      if (subscription.requests_used < subscription.max_requests) {
        return { allowed: true, reason: '', requestsUsed: subscription.requests_used, action };
      }
      return {
        allowed: false,
        reason: 'Has alcanzado el límite de solicitudes de tu plan Basic.',
        requestsUsed: subscription.requests_used,
        action,
      };
    }

    // FREE: one-time, only for promoter/manager
    if (plan_type === 'free') {
      if (!subscription.free_request_used) {
        return { allowed: true, reason: '', requestsUsed: 0, action };
      }
      return {
        allowed: false,
        reason: 'Tu solicitud de prueba gratuita ha sido utilizada. Elige un plan para continuar.',
        requestsUsed: 1,
        action,
      };
    }

    // PER_REQUEST: pre-purchased credits
    if (plan_type === 'per_request') {
      if (subscription.requests_used < subscription.max_requests) {
        return { allowed: true, reason: '', requestsUsed: subscription.requests_used, action };
      }
      return {
        allowed: false,
        reason: 'No tienes solicitudes restantes. Compra más créditos.',
        requestsUsed: subscription.requests_used,
        action,
      };
    }

    return { allowed: false, reason: 'Tipo de plan desconocido.', requestsUsed: 0, action };
  } catch {
    return { allowed: false, reason: 'Error inesperado al verificar suscripción.', requestsUsed: 0, action };
  }
}

// ── Legacy wrapper (backward compat) ────────────────────

/**
 * @deprecated Use canPerformAction() instead.
 * Kept for any callers that haven't migrated yet.
 */
export async function checkCanSendRequest(profileId: string): Promise<SubscriptionCheck> {
  // Fetch profile role for the legacy call
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profileId)
    .single();

  const role = profile?.role ?? 'fighter';
  return canPerformAction(profileId, role, 'send_fight_request');
}

// ── Record request used ─────────────────────────────────

/**
 * Record that a request credit was consumed.
 *   - free plan: set free_request_used = true (one-time, never resets)
 *   - other plans: increment requests_used
 */
export async function recordRequestUsed(profileId: string): Promise<ServiceResponse<null>> {
  try {
    // Admins don't consume credits
    if (await isAdmin(profileId)) {
      return { data: null, error: null };
    }

    const { data: sub } = await supabase
      .from('promoter_subscriptions')
      .select('plan_type, requests_used, trial_used, free_request_used')
      .eq('profile_id', profileId)
      .single();

    if (!sub) return { data: null, error: 'Suscripción no encontrada.' };

    const updates: Record<string, unknown> = {};

    if (sub.plan_type === 'free') {
      updates.free_request_used = true;
      updates.trial_used = true;
    } else {
      updates.requests_used = (sub.requests_used ?? 0) + 1;
      if (!sub.trial_used) {
        updates.trial_used = true;
      }
    }

    const { error } = await supabase
      .from('promoter_subscriptions')
      .update(updates)
      .eq('profile_id', profileId);

    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch {
    return { data: null, error: 'Error al registrar solicitud.' };
  }
}

// ── Get subscription details ────────────────────────────

export async function getSubscription(profileId: string): Promise<ServiceResponse<PromoterSubscription>> {
  try {
    const { data, error } = await supabase
      .from('promoter_subscriptions')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data as PromoterSubscription | null, error: null };
  } catch {
    return { data: null, error: 'Error al obtener suscripción.' };
  }
}
