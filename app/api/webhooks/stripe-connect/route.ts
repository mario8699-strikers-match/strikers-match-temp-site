import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripeClient';
import { createAdminSupabase } from '@/lib/serverAuth';

export const runtime = 'nodejs';

type AdminClient = ReturnType<typeof createAdminSupabase>;

function connectedAccountId(event: Stripe.Event): string | null {
  return typeof event.account === 'string' ? event.account : null;
}

function objectId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

async function paymentByReference(
  admin: AdminClient,
  references: { paymentId?: string | null; paymentIntentId?: string | null; chargeId?: string | null },
) {
  let query = admin.from('registration_payments').select('*');
  if (references.paymentId) query = query.eq('id', references.paymentId);
  else if (references.paymentIntentId) query = query.eq('stripe_payment_intent_id', references.paymentIntentId);
  else if (references.chargeId) query = query.eq('stripe_charge_id', references.chargeId);
  else return null;
  const { data } = await query.maybeSingle();
  return data;
}

async function markPaymentPaid(
  admin: AdminClient,
  paymentId: string,
  accountId: string,
  paymentIntentId: string | null,
  chargeId: string | null,
) {
  const paidAt = new Date().toISOString();
  const { data: payment, error } = await admin
    .from('registration_payments')
    .update({
      payment_status: 'paid',
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      paid_at: paidAt,
      failure_message: null,
    })
    .eq('id', paymentId)
    .eq('stripe_account_id', accountId)
    .select('registration_id')
    .maybeSingle();
  if (error) throw error;
  if (!payment) throw new Error('Connected-account payment did not match the webhook.');

  const { error: registrationError } = await admin
    .from('event_registrations')
    .update({
      payment_status: 'confirmed',
      registration_status: 'confirmed',
      confirmed_at: paidAt,
      updated_at: paidAt,
    })
    .eq('id', payment.registration_id);
  if (registrationError) throw registrationError;
}

async function checkoutPaymentDetails(
  session: Stripe.Checkout.Session,
  accountId: string,
) {
  const paymentIntentId = objectId(session.payment_intent);
  if (!paymentIntentId) return { paymentIntentId: null, chargeId: null };
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {}, { stripeAccount: accountId });
  return {
    paymentIntentId,
    chargeId: objectId(paymentIntent.latest_charge),
  };
}

async function processConnectEvent(admin: AdminClient, event: Stripe.Event) {
  const accountId = connectedAccountId(event);

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    const userId = account.metadata?.strikersmatch_profile_id;
    const payload = {
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      onboarding_complete: Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled),
      account_display_name: account.business_profile?.name ?? account.company?.name ?? null,
      updated_at: new Date().toISOString(),
    };
    const query = admin.from('organizer_payment_accounts').update(payload);
    const { error } = userId
      ? await query.eq('user_id', userId).eq('stripe_account_id', account.id)
      : await query.eq('stripe_account_id', account.id);
    if (error) throw error;
    return;
  }

  if (!accountId) return;

  if (
    event.type === 'checkout.session.completed'
    || event.type === 'checkout.session.async_payment_succeeded'
    || event.type === 'checkout.session.async_payment_failed'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.payment_kind !== 'event_registration') return;
    const paymentId = session.metadata.payment_id;
    if (!paymentId) throw new Error('Registration Checkout is missing payment metadata.');
    const payment = await paymentByReference(admin, { paymentId });
    if (
      !payment
      || payment.stripe_account_id !== accountId
      || payment.stripe_checkout_session_id !== session.id
      || payment.registration_id !== session.metadata.registration_id
      || payment.amount_cents !== session.amount_total
      || payment.currency !== session.currency
    ) {
      throw new Error('Registration Checkout did not match the stored payment.');
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      const { error } = await admin
        .from('registration_payments')
        .update({ payment_status: 'failed', failure_message: 'Stripe reported that the payment failed.' })
        .eq('id', paymentId)
        .eq('stripe_account_id', accountId);
      if (error) throw error;
      return;
    }

    if (session.payment_status !== 'paid' && event.type !== 'checkout.session.async_payment_succeeded') {
      const { error } = await admin
        .from('registration_payments')
        .update({ payment_status: 'processing' })
        .eq('id', paymentId)
        .eq('stripe_account_id', accountId);
      if (error) throw error;
      return;
    }

    const details = await checkoutPaymentDetails(session, accountId);
    await markPaymentPaid(admin, paymentId, accountId, details.paymentIntentId, details.chargeId);
    return;
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.metadata?.payment_kind !== 'event_registration') return;
    const { error } = await admin
      .from('registration_payments')
      .update({
        payment_status: 'failed',
        stripe_payment_intent_id: intent.id,
        failure_message: intent.last_payment_error?.message ?? 'Stripe reported that the payment failed.',
      })
      .eq('id', intent.metadata.payment_id)
      .eq('stripe_account_id', accountId);
    if (error) throw error;
    return;
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const payment = await paymentByReference(admin, {
      paymentId: charge.metadata?.payment_id,
      paymentIntentId: objectId(charge.payment_intent),
      chargeId: charge.id,
    });
    if (!payment || payment.stripe_account_id !== accountId) return;
    const fullyRefunded = charge.amount_refunded >= charge.amount;
    const refundedAt = new Date().toISOString();
    const { error: paymentError } = await admin
      .from('registration_payments')
      .update({
        payment_status: fullyRefunded ? 'refunded' : 'partially_refunded',
        amount_refunded_cents: charge.amount_refunded,
        refunded_at: refundedAt,
        stripe_charge_id: charge.id,
      })
      .eq('id', payment.id)
      .eq('stripe_account_id', accountId);
    if (paymentError) throw paymentError;
    if (fullyRefunded) {
      const { error: registrationError } = await admin
        .from('event_registrations')
        .update({
          payment_status: 'pending',
          registration_status: 'submitted',
          confirmed_at: null,
          updated_at: refundedAt,
        })
        .eq('id', payment.registration_id);
      if (registrationError) throw registrationError;
    }
    return;
  }

  if (event.type === 'charge.dispute.created' || event.type === 'charge.dispute.closed') {
    const dispute = event.data.object as Stripe.Dispute;
    const chargeId = objectId(dispute.charge);
    const payment = await paymentByReference(admin, { chargeId });
    if (!payment || payment.stripe_account_id !== accountId) return;
    const restoredStatus = payment.amount_refunded_cents >= payment.amount_cents
      ? 'refunded'
      : payment.amount_refunded_cents > 0 ? 'partially_refunded' : 'paid';
    const paymentStatus = event.type === 'charge.dispute.closed' && dispute.status === 'won'
      ? restoredStatus
      : 'disputed';
    const { error } = await admin
      .from('registration_payments')
      .update({ payment_status: paymentStatus })
      .eq('id', payment.id)
      .eq('stripe_account_id', accountId);
    if (error) throw error;
    const registrationUpdate = paymentStatus === 'paid'
      ? { payment_status: 'confirmed', registration_status: 'confirmed', confirmed_at: new Date().toISOString() }
      : { payment_status: 'pending', registration_status: 'submitted', confirmed_at: null };
    const { error: registrationError } = await admin
      .from('event_registrations')
      .update({ ...registrationUpdate, updated_at: new Date().toISOString() })
      .eq('id', payment.registration_id);
    if (registrationError) throw registrationError;
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: 'Webhook no configurado.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.error('[stripe-connect:webhook-signature]', error);
    return NextResponse.json({ error: 'Firma inválida.' }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: processed } = await admin
    .from('stripe_connect_webhook_events')
    .select('stripe_event_id')
    .eq('stripe_event_id', event.id)
    .maybeSingle();
  if (processed) return NextResponse.json({ received: true, duplicate: true });

  try {
    await processConnectEvent(admin, event);
    const { error } = await admin.from('stripe_connect_webhook_events').insert({
      stripe_event_id: event.id,
      stripe_account_id: connectedAccountId(event),
      event_type: event.type,
    });
    if (error && error.code !== '23505') throw error;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe-connect:webhook-processing]', error);
    return NextResponse.json({ error: 'No se pudo procesar el webhook.' }, { status: 500 });
  }
}
