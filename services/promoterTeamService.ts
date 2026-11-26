import { supabase } from '@/lib/supabaseClient';
import type {
  PromoterOrganizationContext,
  PromoterOrganizationMember,
  PromoterOrganizationInvitationPreview,
  PromoterOrganizationInvitation,
  PromoterOrganizationPermission,
  PromoterOrganizationRole,
  ServiceResponse,
} from '@/types';

export type AssignablePromoterOrganizationRole = Exclude<PromoterOrganizationRole, 'owner'>;

const FALLBACK_ERROR = 'promoters.team.errors.requestFailed';

function teamErrorKey(message?: string | null) {
  if (!message) return FALLBACK_ERROR;
  if (message.includes('promoter_team_account_not_found')) return 'promoters.team.errors.accountNotFound';
  if (message.includes('promoter_team_invalid_role')) return 'promoters.team.errors.invalidRole';
  if (message.includes('promoter_team_owner_is_implicit')) return 'promoters.team.errors.ownerImplicit';
  if (message.includes('promoter_team_not_authorized')) return 'promoters.team.errors.notAuthorized';
  if (message.includes('promoter_team_member_not_found')) return 'promoters.team.errors.memberNotFound';
  if (message.includes('promoter_team_owner_not_allowed')) return 'promoters.team.errors.ownerNotAllowed';
  if (message.includes('promoter_team_invalid_email')) return 'promoters.team.errors.invalidEmail';
  if (message.includes('promoter_team_account_unavailable')) return 'promoters.team.errors.accountUnavailable';
  if (message.includes('promoter_team_email_unavailable')) return 'promoters.team.errors.emailUnavailable';
  if (message.includes('promoter_team_email_failed')) return 'promoters.team.errors.emailFailed';
  if (message.includes('promoter_team_invitation_expired')) return 'promoters.team.invitation.errors.expired';
  if (message.includes('promoter_team_invitation_email_mismatch')) return 'promoters.team.invitation.errors.emailMismatch';
  if (message.includes('promoter_team_invitation_invalid')) return 'promoters.team.invitation.errors.invalid';
  return message;
}

async function accessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function organizationHasPermission(
  context: PromoterOrganizationContext | null | undefined,
  permission: PromoterOrganizationPermission,
) {
  return Boolean(context?.permissions?.includes(permission));
}

export async function ensureMyPromoterOrganization(
  name?: string,
): Promise<ServiceResponse<null>> {
  try {
    const { error } = await supabase.rpc('ensure_my_promoter_organization', {
      requested_name: name?.trim() || null,
    });
    return error
      ? { data: null, error: teamErrorKey(error.message) }
      : { data: null, error: null };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function getMyPromoterOrganizations(): Promise<ServiceResponse<PromoterOrganizationContext[]>> {
  try {
    const { data, error } = await supabase.rpc('list_my_promoter_organizations');
    if (error) return { data: null, error: teamErrorKey(error.message) };
    return { data: (data ?? []) as PromoterOrganizationContext[], error: null };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function getPromoterOrganizationMembers(
  organizationId: string,
): Promise<ServiceResponse<PromoterOrganizationMember[]>> {
  try {
    const { data, error } = await supabase.rpc('list_promoter_organization_members', {
      target_organization_id: organizationId,
    });
    if (error) return { data: null, error: teamErrorKey(error.message) };
    return { data: (data ?? []) as PromoterOrganizationMember[], error: null };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function getPromoterOrganizationInvitations(
  organizationId: string,
): Promise<ServiceResponse<PromoterOrganizationInvitation[]>> {
  try {
    const { data, error } = await supabase.rpc('list_promoter_organization_invitations', {
      target_organization_id: organizationId,
    });
    if (error) return { data: null, error: teamErrorKey(error.message) };
    return { data: (data ?? []) as PromoterOrganizationInvitation[], error: null };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function addPromoterOrganizationMember(
  organizationId: string,
  email: string,
  role: AssignablePromoterOrganizationRole,
): Promise<ServiceResponse<null>> {
  try {
    const { error } = await supabase.rpc('add_promoter_organization_member_by_email', {
      target_organization_id: organizationId,
      member_email: email.trim(),
      next_organization_role: role,
    });
    return error
      ? { data: null, error: teamErrorKey(error.message) }
      : { data: null, error: null };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function invitePromoterOrganizationMember(
  organizationId: string,
  email: string,
  role: AssignablePromoterOrganizationRole,
): Promise<ServiceResponse<'member_added' | 'invitation_created'>> {
  try {
    const token = await accessToken();
    if (!token) return { data: null, error: 'promoters.team.errors.notAuthorized' };
    const response = await fetch('/api/promoter-team/invitations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId, email: email.trim(), role }),
    });
    const payload = await response.json().catch(() => ({})) as {
      action?: 'member_added' | 'invitation_created';
      error?: string;
    };
    if (!response.ok || !payload.action) {
      return { data: null, error: teamErrorKey(payload.error) };
    }
    return { data: payload.action, error: null };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function getPromoterTeamInvitation(
  invitationToken: string,
): Promise<ServiceResponse<PromoterOrganizationInvitationPreview>> {
  try {
    const response = await fetch(`/api/promoter-team/invitations/${encodeURIComponent(invitationToken)}`);
    const payload = await response.json().catch(() => ({})) as PromoterOrganizationInvitationPreview & { error?: string };
    if (!response.ok || !payload.organizationId) {
      return { data: null, error: teamErrorKey(payload.error) };
    }
    return { data: payload, error: null };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function acceptPromoterTeamInvitation(
  invitationToken: string,
): Promise<ServiceResponse<null>> {
  try {
    const token = await accessToken();
    if (!token) return { data: null, error: 'promoters.team.errors.notAuthorized' };
    const response = await fetch(`/api/promoter-team/invitations/${encodeURIComponent(invitationToken)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    return response.ok
      ? { data: null, error: null }
      : { data: null, error: teamErrorKey(payload.error) };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function removePromoterOrganizationMember(
  memberId: string,
): Promise<ServiceResponse<null>> {
  try {
    const { error } = await supabase.rpc('remove_promoter_organization_member', {
      member_uuid: memberId,
    });
    return error
      ? { data: null, error: teamErrorKey(error.message) }
      : { data: null, error: null };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function revokePromoterOrganizationInvitation(
  invitationId: string,
): Promise<ServiceResponse<null>> {
  try {
    const { error } = await supabase.rpc('revoke_promoter_organization_invitation', {
      invitation_uuid: invitationId,
    });
    return error
      ? { data: null, error: teamErrorKey(error.message) }
      : { data: null, error: null };
  } catch {
    return { data: null, error: FALLBACK_ERROR };
  }
}

export async function hasEventTeamPermission(
  eventId: string,
  permission: PromoterOrganizationPermission,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_event_team_permission', {
      target_event_id: eventId,
      requested_permission: permission,
    });
    return !error && Boolean(data);
  } catch {
    return false;
  }
}
