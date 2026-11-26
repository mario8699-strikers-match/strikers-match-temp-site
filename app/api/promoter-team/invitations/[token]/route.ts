import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest, createAdminSupabase } from '@/lib/serverAuth';

export const runtime = 'nodejs';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function validToken(token: string) {
  return /^[0-9a-f]{64}$/.test(token);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!validToken(token)) {
    return NextResponse.json({ error: 'promoter_team_invitation_invalid' }, { status: 404 });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from('promoter_organization_invitations')
    .select(`
      id, email, organization_role, invitation_status, expires_at,
      organization:organization_id!inner(id, name)
    `)
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error || !data || data.invitation_status !== 'pending') {
    return NextResponse.json({ error: 'promoter_team_invitation_invalid' }, { status: 404 });
  }
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'promoter_team_invitation_expired' }, { status: 410 });
  }

  const organization = data.organization as unknown as { id: string; name: string };
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', data.email)
    .maybeSingle();

  return NextResponse.json({
    email: data.email,
    role: data.organization_role,
    organizationId: organization.id,
    organizationName: organization.name,
    accountExists: Boolean(profile),
    expiresAt: data.expires_at,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!validToken(token)) {
    return NextResponse.json({ error: 'promoter_team_invitation_invalid' }, { status: 404 });
  }
  const auth = await authenticateServerRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase.rpc('accept_promoter_organization_invitation', {
    invitation_token_hash: hashToken(token),
  });
  if (error) {
    const status = error.message.includes('email_mismatch') ? 403 : 409;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ organization: data?.[0] ?? null });
}
