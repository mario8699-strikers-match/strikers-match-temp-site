import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripeClient';
import {
  authenticateServerRequest,
  createAdminSupabase,
  requestAppUrl,
} from '@/lib/serverAuth';

export const runtime = 'nodejs';

interface CheckoutRequest {
  registrationId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'fighter') {
      return NextResponse.json({ error: 'Solo el peleador registrado puede realizar este pago.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as CheckoutRequest;
    if (!body.registrationId) {
      return NextResponse.json({ error: 'Falta el registro del evento.' }, { status: 400 });
    }

    const admin = createAdminSupabase();
    const { data: registration, error: registrationError } = await admin
      .from('event_registrations')
      .select(`
        id, event_id, fighter_id, display_name, payment_status,
        fighters!inner(profile_id),
        events!inner(event_name, promoter_id, status)
      `)
      .eq('id', body.registrationId)
      .maybeSingle();

    if (registrationError || !registration) {
      return NextResponse.json({ error: 'No se encontró el registro.' }, { status: 404 });
    }

    const fighter = registration.fighters as unknown as { profile_id: string };
    const event = registration.events as unknown as {
      event_name: string;
      promoter_id: string;
      status: string;
    };
    if (fighter.profile_id !== auth.userId) {
      return NextResponse.json({ error: 'No autorizado para este registro.' }, { status: 403 });
    }
    if (event.status !== 'published') {
      return NextResponse.json({ error: 'Este evento no está abierto para pagos.' }, { status: 409 });
    }

    const [{ data: settings, error: settingsError }, { data: account, error: accountError }] = await Promise.all([
      admin
        .from('event_payment_settings')
        .select('*')
        .eq('event_id', registration.event_id)
        .maybeSingle(),
      admin
        .from('organizer_payment_accounts')
        .select('*')
        .eq('user_id', event.promoter_id)
        .maybeSingle(),
    ]);

    if (settingsError || !settings || settings.registration_type !== 'paid' || settings.payment_method !== 'stripe') {
      return NextResponse.json({ error: 'Este evento no usa pagos con Stripe.' }, { status: 409 });
    }
    if (
      accountError || !account || !account.charges_enabled || !account.payouts_enabled
      || !account.details_submitted || !account.onboarding_complete
    ) {
      return NextResponse.json({ error: 'El organizador todavía no puede recibir pagos.' }, { status: 409 });
    }
    if (
      settings.registration_fee_cents <= 0
      || settings.platform_fee_amount < 0
      || settings.platform_fee_amount >= settings.registration_fee_cents
    ) {
      return NextResponse.json({ error: 'La configuración de pago del evento no es válida.' }, { status: 409 });
    }

    const { data: existingPayment } = await admin
      .from('registration_payments')
      .select('*')
      .eq('registration_id', registration.id)
      .maybeSingle();
    if (existingPayment?.payment_status === 'paid') {
      return NextResponse.json({ error: 'Este registro ya está pagado.' }, { status: 409 });
    }
    if (existingPayment && ['refunded', 'partially_refunded', 'disputed'].includes(existingPayment.payment_status)) {
      return NextResponse.json({ error: 'Este pago requiere revisión del organizador.' }, { status: 409 });
    }

    let payerDisplayName = registration.display_name as string | null;
    if (!payerDisplayName) {
      const { data: payerProfile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', auth.userId)
        .maybeSingle();
      payerDisplayName = payerProfile?.full_name ?? null;
    }

    const paymentPayload = {
      registration_id: registration.id,
      event_id: registration.event_id,
      fighter_id: registration.fighter_id,
      organizer_id: event.promoter_id,
      payer_display_name: payerDisplayName,
      stripe_account_id: account.stripe_account_id,
      amount_cents: settings.registration_fee_cents,
      platform_fee_cents: settings.platform_fee_amount,
      currency: settings.currency,
      payment_status: 'pending',
      failure_message: null,
      updated_at: new Date().toISOString(),
    };
    const { data: payment, error: paymentError } = await admin
      .from('registration_payments')
      .upsert(paymentPayload, { onConflict: 'registration_id' })
      .select('*')
      .single();
    if (paymentError || !payment) throw paymentError ?? new Error('Payment record was not created.');

    const metadata = {
      payment_kind: 'event_registration',
      payment_id: payment.id,
      registration_id: registration.id,
      event_id: registration.event_id,
      fighter_id: registration.fighter_id,
      organizer_id: event.promoter_id,
    };
    const appUrl = requestAppUrl(request);
    const eventUrl = `${appUrl}/events/${registration.event_id}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'es',
      client_reference_id: registration.id,
      customer_email: auth.email ?? undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: settings.currency,
          unit_amount: settings.registration_fee_cents,
          product_data: {
            name: `Inscripción — ${event.event_name}`,
            description: payerDisplayName ? `Participante: ${payerDisplayName}` : undefined,
          },
        },
      }],
      payment_intent_data: {
        ...(settings.platform_fee_amount > 0
          ? { application_fee_amount: settings.platform_fee_amount }
          : {}),
        metadata,
      },
      metadata,
      success_url: `${eventUrl}?payment=success`,
      cancel_url: `${eventUrl}?payment=cancelled`,
    }, {
      stripeAccount: account.stripe_account_id,
      idempotencyKey: `event-registration-${payment.id}-${crypto.randomUUID()}`,
    });

    const { error: sessionUpdateError } = await admin
      .from('registration_payments')
      .update({ stripe_checkout_session_id: session.id, payment_status: 'pending' })
      .eq('id', payment.id);
    if (sessionUpdateError) throw sessionUpdateError;

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[event-registration-checkout]', error);
    return NextResponse.json({ error: 'No se pudo abrir el pago seguro.' }, { status: 500 });
  }
}
