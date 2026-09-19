import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripeClient';
import { authenticateServerRequest, createAdminSupabase } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (!['promoter', 'manager', 'admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as { paymentId?: string };
    if (!body.paymentId) {
      return NextResponse.json({ error: 'Falta el pago.' }, { status: 400 });
    }

    const admin = createAdminSupabase();
    const { data: payment, error } = await admin
      .from('registration_payments')
      .select('*')
      .eq('id', body.paymentId)
      .maybeSingle();
    if (error || !payment) {
      return NextResponse.json({ error: 'No se encontró el pago.' }, { status: 404 });
    }
    if (payment.organizer_id !== auth.userId && auth.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado para reembolsar este pago.' }, { status: 403 });
    }
    if (!payment.stripe_charge_id || !['paid', 'partially_refunded'].includes(payment.payment_status)) {
      return NextResponse.json({ error: 'Este pago no se puede reembolsar desde la plataforma.' }, { status: 409 });
    }

    const remaining = payment.amount_cents - payment.amount_refunded_cents;
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Este pago ya fue reembolsado.' }, { status: 409 });
    }

    const refund = await stripe.refunds.create({
      charge: payment.stripe_charge_id,
      amount: remaining,
      refund_application_fee: payment.platform_fee_cents > 0,
      metadata: {
        payment_kind: 'event_registration',
        payment_id: payment.id,
        registration_id: payment.registration_id,
        organizer_id: payment.organizer_id,
      },
    }, {
      stripeAccount: payment.stripe_account_id,
      idempotencyKey: `event-registration-refund-${payment.id}-${payment.amount_refunded_cents}`,
    });

    return NextResponse.json({ refundId: refund.id, status: refund.status });
  } catch (error) {
    console.error('[payments:refund]', error);
    return NextResponse.json({ error: 'No se pudo solicitar el reembolso.' }, { status: 500 });
  }
}
