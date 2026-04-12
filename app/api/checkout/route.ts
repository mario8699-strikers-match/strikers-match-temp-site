/**
 * Stripe Checkout API Route
 *
 * POST /api/checkout
 * Body: { plan: 'basic' | 'pro' | 'per_request' }
 *
 * Creates a Stripe Checkout Session and returns the URL for redirect.
 * Requires authenticated Supabase session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, PLAN_CONFIG, type PlanKey } from '@/lib/stripeClient';

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  if (token) {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  }

  // Fallback: cookie-based session
  const cookieSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { cookie: req.headers.get('cookie') ?? '' } } },
  );
  const { data: { session } } = await cookieSupabase.auth.getSession();
  return session?.user ?? null;
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const planKey = body.plan as PlanKey;

    if (!planKey || !PLAN_CONFIG[planKey]) {
      return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
    }

    const config = PLAN_CONFIG[planKey];
    const origin = req.headers.get('origin') ?? '';

    // Build line item
    const lineItem: Record<string, unknown> = {
      quantity: 1,
      price_data: {
        currency: config.currency,
        unit_amount: config.amount,
        product_data: {
          name: `Strikers Match — ${config.name}`,
        },
        ...(config.mode === 'subscription' && config.interval
          ? { recurring: { interval: config.interval } }
          : {}),
      },
    };

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      payment_method_types: ['card'],
      line_items: [lineItem as never],
      metadata: {
        profile_id: user.id,
        plan_type: config.planType,
      },
      ...(config.mode === 'subscription'
        ? {
            subscription_data: {
              metadata: {
                profile_id: user.id,
                plan_type: config.planType,
              },
            },
          }
        : {}),
      success_url: `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      customer_email: user.email,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[CHECKOUT] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session.' },
      { status: 500 },
    );
  }
}
