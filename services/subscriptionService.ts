import { supabase } from '@/lib/supabaseClient';
import { ROLE_ALLOWED_ACTIONS } from '@/types';
import type { PaidAction, PromoterSubscription, ServiceResponse, SubscriptionCheck } from '@/types';

/**
 * Compatibility layer after removing promoter/manager payment gates.
 *
 * Promoters, managers, and admins can use their allowed operational actions.
 * Kept under the old filename so existing imports remain stable.
 */
export async function canPerformAction(
  profileId: string,
  role: string,
  action: PaidAction
): Promise<SubscriptionCheck> {
  if (role === 'admin') {
    return { allowed: true, reason: '', requestsUsed: 0, action };
  }

  const allowedActions = ROLE_ALLOWED_ACTIONS[role] ?? [];
  if (allowedActions.includes(action)) {
    return { allowed: true, reason: '', requestsUsed: 0, action };
  }

  if (profileId) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', profileId)
      .maybeSingle();

    if (data?.role === 'admin') {
      return { allowed: true, reason: '', requestsUsed: 0, action };
    }
  }

  return {
    allowed: false,
    reason: 'Esta acción no está disponible para tu tipo de cuenta.',
    requestsUsed: 0,
    action,
  };
}

export async function checkCanSendRequest(profileId: string): Promise<SubscriptionCheck> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle();

  return canPerformAction(profileId, profile?.role ?? 'fighter', 'send_fight_request');
}

export async function recordRequestUsed(_profileId: string): Promise<ServiceResponse<null>> {
  void _profileId;
  return { data: null, error: null };
}

export async function getSubscription(_profileId: string): Promise<ServiceResponse<PromoterSubscription>> {
  void _profileId;
  return { data: null, error: null };
}
