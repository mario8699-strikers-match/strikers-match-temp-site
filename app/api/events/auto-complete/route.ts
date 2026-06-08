import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * POST /api/events/auto-complete
 *
 * Auto-completes published events whose date has passed.
 * Secured by CRON_SECRET env var for Vercel Cron invocation.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Find published events with a past date
    const { data: pastEvents, error: selectError } = await supabase
      .from('events')
      .select('id')
      .eq('status', 'published')
      .lt('event_date', today)
      .not('event_date', 'is', null);

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (!pastEvents || pastEvents.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const ids = pastEvents.map((e: { id: string }) => e.id);
    const { error: updateError } = await supabase
      .from('events')
      .update({ status: 'completed' })
      .in('id', ids);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ updated: ids.length });
  } catch (err) {
    console.error('[auto-complete]', err);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
