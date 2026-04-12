/**
 * Stripe Webhook Route
 *
 * POST /api/webhooks/stripe
 *
 * Handles Stripe events to update promoter_subscriptions in Supabase.
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS (no user session in webhooks).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, PLAN_CONFIG } from '@/lib/stripeClient';
import type Stripe from 'stripe';

// Supabase admin client (bypasses RLS)
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  const supabase = getAdminSupabase();

  try {
    switch (event.type) {
      // ── Checkout completed (initial purchase) ──
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const profileId = session.metadata?.profile_id;
        const planType = session.metadata?.plan_type;

        if (!profileId || !planType) {
          console.warn('[WEBHOOK] Missing metadata on checkout session');
          break;
        }

        console.log(`[WEBHOOK] checkout.session.completed: profile=${profileId}, plan=${planType}`);

        if (planType === 'per_request') {
          // Pay-as-you-go: add 1 credit
          const { data: existing } = await supabase
            .from('promoter_subscriptions')
            .select('max_requests, plan_type')
            .eq('profile_id', profileId)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('promoter_subscriptions')
              .update({
                plan_type: 'per_request',
                max_requests: (existing.max_requests ?? 0) + 1,
                is_active: true,
              })
              .eq('profile_id', profileId);
          } else {
            await supabase
              .from('promoter_subscriptions')
              .insert({
                profile_id: profileId,
                plan_type: 'per_request',
                requests_used: 0,
                max_requests: 1,
                is_active: true,
                trial_used: true,
                free_request_used: true,
              });
          }
          console.log(`[WEBHOOK] Added 1 per_request credit for ${profileId}`);
        } else {
          // Basic or Pro subscription
          const config = planType === 'pro' ? PLAN_CONFIG.pro : PLAN_CONFIG.basic;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          const stripeSubId = typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as Stripe.Subscription | null)?.id ?? null;

          await supabase
            .from('promoter_subscriptions')
            .upsert({
              profile_id: profileId,
              plan_type: config.planType,
              max_requests: config.maxRequests,
              requests_used: 0,
              is_active: true,
              trial_used: true,
              free_request_used: true,
              expires_at: expiresAt.toISOString(),
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
              stripe_subscription_id: stripeSubId,
            }, { onConflict: 'profile_id' });

          console.log(`[WEBHOOK] Activated ${planType} plan for ${profileId}, expires ${expiresAt.toISOString()}`);
        }
        break;
      }

      // ── Subscription renewal (monthly payment) ──
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        // Only handle renewal invoices (not the first one)
        if (invoice.billing_reason !== 'subscription_cycle') break;

        // In newer Stripe API versions, subscription may be under subscription_details
        const invoiceAny = invoice as unknown as Record<string, unknown>;
        const rawSub = invoiceAny.subscription ?? invoiceAny.subscription_id;
        const subId = typeof rawSub === 'string' ? rawSub : null;

        if (!subId) break;

        // Look up profile by stripe_subscription_id
        const { data: sub } = await supabase
          .from('promoter_subscriptions')
          .select('profile_id, plan_type')
          .eq('stripe_subscription_id', subId)
          .maybeSingle();

        if (sub) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await supabase
            .from('promoter_subscriptions')
            .update({
              requests_used: 0,
              is_active: true,
              expires_at: expiresAt.toISOString(),
            })
            .eq('profile_id', sub.profile_id);

          console.log(`[WEBHOOK] Renewed ${sub.plan_type} for ${sub.profile_id}`);
        }
        break;
      }

      // ── Subscription cancelled ──
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subId = subscription.id;

        const { data: sub } = await supabase
          .from('promoter_subscriptions')
          .select('profile_id')
          .eq('stripe_subscription_id', subId)
          .maybeSingle();

        if (sub) {
          await supabase
            .from('promoter_subscriptions')
            .update({ is_active: false })
            .eq('profile_id', sub.profile_id);

          console.log(`[WEBHOOK] Deactivated subscription for ${sub.profile_id}`);
        }
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error('[WEBHOOK] Processing error:', err);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
