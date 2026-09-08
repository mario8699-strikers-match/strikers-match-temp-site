import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const storageConfigured = Boolean(
    process.env.DO_SPACES_REGION
    && process.env.DO_SPACES_BUCKET
    && process.env.DO_SPACES_ACCESS_KEY
    && process.env.DO_SPACES_SECRET_KEY
    && process.env.DO_SPACES_ENDPOINT
  );

  if (!supabaseUrl || !anonKey || !storageConfigured) {
    return NextResponse.json(
      { status: 'unhealthy', database: 'not_configured', storage: storageConfigured ? 'configured' : 'not_configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from('events').select('id', { head: true, count: 'estimated' });
  const healthy = !error;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'unhealthy',
      database: healthy ? 'reachable' : 'unreachable',
      storage: 'configured',
      responseTimeMs: Date.now() - startedAt,
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
