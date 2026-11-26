import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest, requestAppUrl } from '@/lib/serverAuth';
import { buildPromoterTeamInvitationEmail } from '@/lib/promoterTeamInvitationEmail';
import type { PromoterOrganizationRole } from '@/types';

export const runtime = 'nodejs';

const ASSIGNABLE_ROLES = new Set<Exclude<PromoterOrganizationRole, 'owner'>>([
  'organization_admin',
  'event_manager',
  'matchmaker',
  'operations',
  'media_producer',
  'finance',
  'read_only',
]);

type InvitationResult = {
  invitation_id: string | null;
  organization_name: string;
  normalized_email: string;
  assigned_role: Exclude<PromoterOrganizationRole, 'owner'>;
  invitation_action: 'member_added' | 'invitation_created';
  expires_at: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({})) as {
      organizationId?: string;
      email?: string;
      role?: Exclude<PromoterOrganizationRole, 'owner'>;
    };
    const organizationId = body.organizationId?.trim() ?? '';
    const email = body.email?.trim().toLowerCase() ?? '';
    const role = body.role;
    if (!organizationId || !email || !/^\S+@\S+\.\S+$/.test(email) || !role || !ASSIGNABLE_ROLES.has(role)) {
      return NextResponse.json({ error: 'promoter_team_invalid_invitation' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'promoter_team_email_unavailable' }, { status: 503 });
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await auth.supabase.rpc('create_promoter_organization_invitation', {
      target_organization_id: organizationId,
      member_email: email,
      next_organization_role: role,
      invitation_token_hash: tokenHash,
      invitation_expires_at: expiresAt,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const result = (data?.[0] ?? null) as InvitationResult | null;
    if (!result) {
      return NextResponse.json({ error: 'promoter_team_invitation_failed' }, { status: 500 });
    }

    const existingAccount = result.invitation_action === 'member_added';
    const inviteUrl = existingAccount
      ? `${requestAppUrl(request)}/promoter/dashboard`
      : `${requestAppUrl(request)}/team/invite/${rawToken}`;
    const emailContent = buildPromoterTeamInvitationEmail({
      organizationName: result.organization_name,
      role: result.assigned_role,
      inviteUrl,
      existingAccount,
    });
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `promoter-team-${tokenHash}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'Strikers Match <noreply@strikersmatch.com>',
        to: [result.normalized_email],
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        ...(process.env.RESEND_REPLY_TO ? { reply_to: process.env.RESEND_REPLY_TO } : {}),
      }),
    });
    const resendPayload = await resendResponse.json().catch(() => ({})) as { id?: string; message?: string };
    if (!resendResponse.ok || !resendPayload.id) {
      console.error('[promoter-team-invitation] Resend rejected request', {
        status: resendResponse.status,
        message: resendPayload.message,
        invitationId: result.invitation_id,
      });
      if (!existingAccount) {
        if (result.invitation_id) {
          await auth.supabase.rpc('revoke_promoter_organization_invitation', {
            invitation_uuid: result.invitation_id,
          });
        }
        return NextResponse.json({ error: 'promoter_team_email_failed' }, { status: 502 });
      }
    }

    return NextResponse.json({
      action: result.invitation_action,
      emailSent: Boolean(resendPayload.id),
    });
  } catch (error) {
    console.error('[promoter-team-invitation]', error);
    return NextResponse.json({ error: 'promoter_team_invitation_failed' }, { status: 500 });
  }
}
