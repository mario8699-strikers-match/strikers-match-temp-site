/**
 * Subscription Service — Monetization layer for fight requests.
 *
 * Plan logic:
 *   - pro:          unlimited requests → always allowed
 *   - basic:        allowed if requests_used < max_requests
 *   - free:         allowed if free_request_used = false (ONE TIME ONLY, never resets)
 *   - per_request:  allowed if requests_used < max_requests
 *
 * Monetization applies ONLY to: promoter, manager, sponsor
 * Fighters and vendors are FREE users (never hit this service).
 */

import { supabase } from '@/lib/supabaseClient';
import type { SubscriptionCheck, ServiceResponse, PromoterSubscription } from '@/types';

/**
 * Check if a profile belongs to an admin (bypasses all paywall checks).
 */
async function isAdmin(profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profileId)
    .single();
  return data?.role === 'admin';
}

/**
 * Check if a user can send a fight request.
 * Admins always pass. Others go through subscription logic.
 * Auto-creates a free-tier subscription row if none exists.
 */
export async function checkCanSendRequest(profileId: string): Promise<SubscriptionCheck> {
  try {
    // Admin bypass — full access, no paywall
    if (await isAdmin(profileId)) {
      return { allowed: true, reason: '', requestsUsed: 0 };
    }

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
      const { data: newSub, error: insertErr } = await supabase
        .from('promoter_subscriptions')
        .insert({
          profile_id: profileId,
          plan_type: 'free',
          requests_used: 0,
          max_requests: 1,
          is_active: true,
          trial_used: false,
          free_request_used: false,
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`[SUB] INSERT error: ${insertErr.message} (code: ${insertErr.code}, details: ${insertErr.details})`);
        return { allowed: false, reason: `Error al crear suscripcion: ${insertErr.message}`, requestsUsed: 0 };
      }
      sub = newSub;
    }

    const subscription = sub as PromoterSubscription;
    console.log(`[SUB] Subscription state: plan=${subscription.plan_type}, free_request_used=${subscription.free_request_used}, requests_used=${subscription.requests_used}, is_active=${subscription.is_active}`);

    // Check if subscription is active
    if (!subscription.is_active) {
      return {
        allowed: false,
        reason: 'Tu suscripcion esta inactiva.',
        requestsUsed: subscription.requests_used,
      };
    }

    // Check expiration (for monthly plans)
    if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
      return {
        allowed: false,
        reason: 'Tu plan ha expirado.',
        requestsUsed: subscription.requests_used,
      };
    }

    // ── Plan-specific logic ──
    const { plan_type } = subscription;

    // PRO: unlimited
    if (plan_type === 'pro') {
      console.log('[SUB] Result: ALLOWED (pro — unlimited)');
      return { allowed: true, reason: '', requestsUsed: subscription.requests_used };
    }

    // BASIC: check request limit
    if (plan_type === 'basic') {
      if (subscription.requests_used < subscription.max_requests) {
        console.log(`[SUB] Result: ALLOWED (basic — ${subscription.requests_used}/${subscription.max_requests})`);
        return { allowed: true, reason: '', requestsUsed: subscription.requests_used };
      }
      console.log(`[SUB] Result: BLOCKED (basic — limit reached ${subscription.requests_used}/${subscription.max_requests})`);
      return {
        allowed: false,
        reason: 'Has alcanzado el limite de solicitudes de tu plan Basic.',
        requestsUsed: subscription.requests_used,
      };
    }

    // FREE: one-time only, never resets
    if (plan_type === 'free') {
      if (!subscription.free_request_used) {
        console.log('[SUB] Result: ALLOWED (free — first request)');
        return { allowed: true, reason: '', requestsUsed: 0 };
      }
      console.log('[SUB] Result: BLOCKED (free — request already used)');
      return {
        allowed: false,
        reason: 'Tu solicitud de prueba gratuita ha sido utilizada. Elige un plan para continuar.',
        requestsUsed: 1,
      };
    }

    // PER_REQUEST: check limit (pre-purchased credits)
    if (plan_type === 'per_request') {
      if (subscription.requests_used < subscription.max_requests) {
        return { allowed: true, reason: '', requestsUsed: subscription.requests_used };
      }
      return {
        allowed: false,
        reason: 'No tienes solicitudes restantes. Compra mas creditos.',
        requestsUsed: subscription.requests_used,
      };
    }

    return { allowed: false, reason: 'Tipo de plan desconocido.', requestsUsed: 0 };
  } catch {
    return { allowed: false, reason: 'Error inesperado al verificar suscripcion.', requestsUsed: 0 };
  }
}

/**
 * Record that a request was used.
 *   - free plan: set free_request_used = true (one-time, never resets)
 *   - other plans: increment requests_used
 */
export async function recordRequestUsed(profileId: string): Promise<ServiceResponse<null>> {
  try {
    // Admins don't consume request credits
    if (await isAdmin(profileId)) {
      return { data: null, error: null };
    }

    const { data: sub } = await supabase
      .from('promoter_subscriptions')
      .select('plan_type, requests_used, trial_used, free_request_used')
      .eq('profile_id', profileId)
      .single();

    if (!sub) return { data: null, error: 'Suscripcion no encontrada.' };

    const updates: Record<string, unknown> = {};

    if (sub.plan_type === 'free') {
      // Free plan: mark the one-time request as used
      updates.free_request_used = true;
      updates.trial_used = true;
      console.log(`[SUB] Recording: free_request_used = true for profile ${profileId}`);
    } else {
      // All other plans: increment counter
      updates.requests_used = (sub.requests_used ?? 0) + 1;
      console.log(`[SUB] Recording: requests_used incremented to ${updates.requests_used} for profile ${profileId}`);
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

/**
 * Get subscription details for display.
 */
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
    return { data: null, error: 'Error al obtener suscripcion.' };
  }
}
