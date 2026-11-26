import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest, createAdminSupabase, hasPromoterTeamPermission } from '@/lib/serverAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;
    const admin = createAdminSupabase();
    const eventId = request.nextUrl.searchParams.get('eventId');
    const requestedOrganizerId = request.nextUrl.searchParams.get('organizerId');
    if (eventId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
      return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
    }
    if (requestedOrganizerId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedOrganizerId)) {
      return NextResponse.json({ error: 'Organización inválida.' }, { status: 400 });
    }

    let organizerId = requestedOrganizerId ?? auth.userId;
    if (eventId) {
      const { data: event, error: eventError } = await admin
        .from('events')
        .select('promoter_id')
        .eq('id', eventId)
        .maybeSingle();
      if (eventError || !event) return NextResponse.json({ error: 'Evento no encontrado.' }, { status: 404 });
      if (requestedOrganizerId && requestedOrganizerId !== event.promoter_id) {
        return NextResponse.json({ error: 'El evento no pertenece a esa organización.' }, { status: 400 });
      }
      organizerId = event.promoter_id;
    }

    if (!(await hasPromoterTeamPermission(auth, organizerId, 'finance'))) {
      return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 });
    }

    let query = admin
      .from('registration_payments')
      .select('*, events(event_name)')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (eventId) query = query.eq('event_id', eventId);
    const { data, error } = await query;
    if (error) throw error;

    const payments = data ?? [];
    const paid = payments.filter((payment) => payment.payment_status === 'paid');
    const collected = payments.filter((payment) => Boolean(payment.paid_at));
    const summary = {
      paid_count: paid.length,
      pending_count: payments.filter((payment) => ['unpaid', 'pending', 'processing'].includes(payment.payment_status)).length,
      failed_count: payments.filter((payment) => payment.payment_status === 'failed').length,
      refunded_count: payments.filter((payment) => ['refunded', 'partially_refunded'].includes(payment.payment_status)).length,
      gross_paid_cents: collected.reduce((total, payment) => total + payment.amount_cents, 0),
      platform_fees_cents: collected.reduce((total, payment) => total + payment.platform_fee_cents, 0),
      refunded_cents: payments.reduce((total, payment) => total + payment.amount_refunded_cents, 0),
    };
    return NextResponse.json({ payments, summary });
  } catch (error) {
    console.error('[payments:list]', error);
    return NextResponse.json({ error: 'No se pudieron cargar los pagos.' }, { status: 500 });
  }
}
