import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export interface ServerAuthContext {
  userId: string;
  email: string | null;
  role: string;
  supabase: ReturnType<typeof createAuthenticatedSupabase>;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createAuthenticatedSupabase(token: string) {
  return createClient(
    requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

export function createAdminSupabase() {
  return createClient(
    requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function authenticateServerRequest(
  request: NextRequest,
): Promise<ServerAuthContext | NextResponse> {
  const header = request.headers.get('authorization');
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  if (!token) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const supabase = createAuthenticatedSupabase(token);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,is_banned')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile || profile.is_banned) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile.role,
    supabase,
  };
}

export function requestAppUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  return request.nextUrl.origin;
}
