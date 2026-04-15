/**
 * Delete Account API Route
 *
 * POST /api/account/delete
 *
 * Deletes the authenticated user's Supabase auth account.
 * Related data (profiles, fighters, etc.) should cascade via DB triggers/RLS.
 * Uses SUPABASE_SERVICE_ROLE_KEY because only the admin API can delete auth users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Authenticate the request and return the user ID.
 */
async function getAuthUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  if (token) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.id ?? null;
  }

  // Fallback: cookie-based session
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { cookie: req.headers.get('cookie') ?? '' } } },
  );
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const adminSupabase = getAdminSupabase();

    // Delete the profile row first (cascading will handle related tables)
    await adminSupabase.from('profiles').delete().eq('id', userId);

    // Delete the auth user
    const { error } = await adminSupabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error('[ACCOUNT/DELETE] Error deleting auth user:', error);
      return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 });
    }

    console.log(`[ACCOUNT/DELETE] Deleted user ${userId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[ACCOUNT/DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 });
  }
}
