import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest, createAdminSupabase, requestAppUrl } from '@/lib/serverAuth';
import { getMissingFighterRegistrationProfileFields } from '@/lib/fighterRegistrationProfile';
import { buildFighterProfileReminderEmail } from '@/lib/fighterProfileReminderEmail';
import type { Fighter, Profile } from '@/types';

export const runtime = 'nodejs';

type ReminderFighter = Pick<
  Fighter,
  'id' | 'photo_url' | 'nationalities' | 'disciplines' | 'weight_class' | 'gym_name'
> & {
  profiles: Pick<
    Profile,
    'full_name' | 'email' | 'country' | 'country_code' | 'instagram' | 'preferred_language' | 'is_banned'
  >;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso exclusivo para administradores.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as { fighterId?: string };
    if (!body.fighterId) {
      return NextResponse.json({ error: 'Falta el peleador.' }, { status: 400 });
    }

    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from('fighters')
      .select(`
        id, photo_url, nationalities, disciplines, weight_class, gym_name,
        profiles!inner(full_name, email, country, country_code, instagram, preferred_language, is_banned)
      `)
      .eq('id', body.fighterId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'No se encontró el perfil del peleador.' }, { status: 404 });
    }

    const fighter = data as unknown as ReminderFighter;
    if (fighter.profiles.is_banned) {
      return NextResponse.json({ error: 'No se enviaron correos a una cuenta bloqueada.' }, { status: 409 });
    }
    if (!fighter.profiles.email?.trim()) {
      return NextResponse.json({ error: 'El peleador no tiene un correo registrado.' }, { status: 409 });
    }

    const missingFields = getMissingFighterRegistrationProfileFields(fighter, fighter.profiles);
    if (missingFields.length === 0) {
      return NextResponse.json({ error: 'El perfil ya está completo.' }, { status: 409 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY no está configurada.' }, { status: 503 });
    }

    const email = buildFighterProfileReminderEmail({
      fullName: fighter.profiles.full_name,
      language: fighter.profiles.preferred_language,
      missingFields,
      profileUrl: `${requestAppUrl(request)}/fighter/profile`,
    });
    const idempotencyKey = `fighter-profile-reminder-${fighter.id}-${missingFields.slice().sort().join('-')}`;
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'Strikers Match <noreply@strikersmatch.com>',
        to: [fighter.profiles.email.trim()],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(process.env.RESEND_REPLY_TO ? { reply_to: process.env.RESEND_REPLY_TO } : {}),
      }),
    });
    const resendPayload = await resendResponse.json().catch(() => ({})) as { id?: string; message?: string; name?: string };

    if (!resendResponse.ok || !resendPayload.id) {
      console.error('[fighter-profile-reminder] Resend rejected request', {
        status: resendResponse.status,
        name: resendPayload.name,
        message: resendPayload.message,
      });
      return NextResponse.json({ error: 'Resend no pudo enviar el correo.' }, { status: 502 });
    }

    return NextResponse.json({ sent: true, missingFields });
  } catch (error) {
    console.error('[fighter-profile-reminder]', error);
    return NextResponse.json({ error: 'No se pudo enviar el recordatorio.' }, { status: 500 });
  }
}
