import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest, createAdminSupabase } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'admin') {
      return NextResponse.json({ error: 'admin_required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as {
      manualFighterId?: string;
      isPublic?: boolean;
    };
    const manualFighterId = body.manualFighterId?.trim();
    if (!manualFighterId || typeof body.isPublic !== 'boolean') {
      return NextResponse.json({ error: 'invalid_visibility_request' }, { status: 400 });
    }

    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from('manual_fighters')
      .update({ is_public: body.isPublic })
      .eq('id', manualFighterId)
      .select('id,is_public')
      .maybeSingle();

    if (error) {
      console.error('[admin-roster-visibility] Update failed', {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: 'visibility_update_failed' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'manual_fighter_not_found' }, { status: 404 });
    }

    return NextResponse.json({ updated: true, isPublic: data.is_public });
  } catch (error) {
    console.error('[admin-roster-visibility]', error);
    return NextResponse.json({ error: 'visibility_update_failed' }, { status: 500 });
  }
}
