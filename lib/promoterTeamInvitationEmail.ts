import type { PromoterOrganizationRole } from '@/types';

const ROLE_LABELS: Record<Exclude<PromoterOrganizationRole, 'owner'>, string> = {
  organization_admin: 'Organization administrator',
  event_manager: 'Event manager',
  matchmaker: 'Matchmaker',
  operations: 'Operations',
  media_producer: 'Media / producer',
  finance: 'Finance',
  read_only: 'Read only',
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildPromoterTeamInvitationEmail(input: {
  organizationName: string;
  role: Exclude<PromoterOrganizationRole, 'owner'>;
  inviteUrl?: string;
  existingAccount: boolean;
}) {
  const organizationName = escapeHtml(input.organizationName);
  const role = escapeHtml(ROLE_LABELS[input.role]);
  const actionUrl = escapeHtml(input.inviteUrl ?? 'https://strikersmatch.com/promoter/dashboard');
  const subject = input.existingAccount
    ? `You were added to ${input.organizationName} on Strikers Match`
    : `Invitation to join ${input.organizationName} on Strikers Match`;
  const actionLabel = input.existingAccount ? 'Open organization dashboard' : 'Accept invitation and create account';
  const intro = input.existingAccount
    ? `Your existing Strikers Match account now has the <strong>${role}</strong> access level for <strong>${organizationName}</strong>.`
    : `You were invited to join <strong>${organizationName}</strong> as <strong>${role}</strong>. Your role is already assigned and cannot be changed during registration.`;

  const html = `
    <div style="background:#f4f4f5;padding:32px 16px;font-family:Arial,sans-serif;color:#18181b">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-top:5px solid #c0001e;padding:32px">
        <p style="margin:0 0 10px;color:#c0001e;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Strikers Match</p>
        <h1 style="margin:0 0 18px;font-size:26px;line-height:1.2">Organization team access</h1>
        <p style="margin:0 0 22px;font-size:16px;line-height:1.6">${intro}</p>
        <a href="${actionUrl}" style="display:inline-block;background:#c0001e;color:#fff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:14px 20px">${actionLabel}</a>
        <p style="margin:24px 0 0;color:#71717a;font-size:13px;line-height:1.5">Only use this link if you recognize the organization. New-account invitation links expire after seven days.</p>
      </div>
    </div>
  `;
  const text = input.existingAccount
    ? `Strikers Match\n\nYour existing account was added to ${input.organizationName} as ${ROLE_LABELS[input.role]}.\n\nOpen your dashboard: ${actionUrl}`
    : `Strikers Match\n\nYou were invited to join ${input.organizationName} as ${ROLE_LABELS[input.role]}.\n\nAccept the invitation and create your account: ${actionUrl}\n\nThis link expires after seven days.`;

  return { subject, html, text };
}
