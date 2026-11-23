import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest, createAdminSupabase, requestAppUrl } from '@/lib/serverAuth';
import {
  getMissingFighterRegistrationProfileFields,
  getMissingManualFighterProfileFields,
} from '@/lib/fighterRegistrationProfile';
import {
  buildFighterProfileReminderEmail,
  buildManagedFighterProfileReminderEmail,
} from '@/lib/fighterProfileReminderEmail';
import { manualFighterManagementPath } from '@/lib/manualFighterManagement';
import type { Fighter, ManualFighter, Profile, UserRole } from '@/types';

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

type ReminderManualFighter = Pick<
  ManualFighter,
  | 'id'
  | 'full_name'
  | 'photo_url'
  | 'country'
  | 'country_code'
  | 'nationalities'
  | 'instagram'
  | 'disciplines'
  | 'discipline'
  | 'weight_class'
  | 'gym_name'
> & {
  profiles: {
    full_name: string;
    email: string;
    role: UserRole;
    preferred_language?: 'es' | 'en' | 'ru';
    is_banned?: boolean;
  };
};

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso exclusivo para administradores.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as {
      fighterId?: string;
      manualFighterId?: string;
    };
    if ((!body.fighterId && !body.manualFighterId) || (body.fighterId && body.manualFighterId)) {
      return NextResponse.json({ error: 'Falta el peleador.' }, { status: 400 });
    }

    const admin = createAdminSupabase();
    let recipientEmail: string;
    let missingFields: ReturnType<typeof getMissingFighterRegistrationProfileFields>;
    let idempotencyKey: string;
    let email: ReturnType<typeof buildFighterProfileReminderEmail>;

    if (body.manualFighterId) {
      const { data, error } = await admin
        .from('manual_fighters')
        .select(`
          id, full_name, photo_url, country, country_code, nationalities, instagram,
          disciplines, discipline, weight_class, gym_name,
          profiles:manager_id!inner(full_name, email, role, preferred_language, is_banned)
        `)
        .eq('id', body.manualFighterId)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ error: 'No se encontró el perfil del peleador de roster.' }, { status: 404 });
      }

      const fighter = data as unknown as ReminderManualFighter;
      if (fighter.profiles.is_banned) {
        return NextResponse.json({ error: 'No se enviaron correos a una cuenta bloqueada.' }, { status: 409 });
      }
      recipientEmail = fighter.profiles.email?.trim();
      if (!recipientEmail) {
        return NextResponse.json({ error: 'El responsable del roster no tiene un correo registrado.' }, { status: 409 });
      }
      missingFields = getMissingManualFighterProfileFields(fighter);
      if (missingFields.length === 0) {
        return NextResponse.json({ error: 'El perfil ya está completo.' }, { status: 409 });
      }
      const profilePath = manualFighterManagementPath(fighter.profiles.role, fighter.id);
      email = buildManagedFighterProfileReminderEmail({
        recipientName: fighter.profiles.full_name,
        fighterName: fighter.full_name,
        language: fighter.profiles.preferred_language,
        missingFields,
        profileUrl: `${requestAppUrl(request)}${profilePath}`,
      });
      idempotencyKey = `manual-fighter-profile-reminder-${fighter.id}-${missingFields.slice().sort().join('-')}`;
    } else {
      const { data, error } = await admin
        .from('fighters')
        .select(`
          id, photo_url, nationalities, disciplines, weight_class, gym_name,
          profiles!inner(full_name, email, country, country_code, instagram, preferred_language, is_banned)
        `)
        .eq('id', body.fighterId!)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ error: 'No se encontró el perfil del peleador.' }, { status: 404 });
      }

      const fighter = data as unknown as ReminderFighter;
      if (fighter.profiles.is_banned) {
        return NextResponse.json({ error: 'No se enviaron correos a una cuenta bloqueada.' }, { status: 409 });
      }
      recipientEmail = fighter.profiles.email?.trim();
      if (!recipientEmail) {
        return NextResponse.json({ error: 'El peleador no tiene un correo registrado.' }, { status: 409 });
      }
      missingFields = getMissingFighterRegistrationProfileFields(fighter, fighter.profiles);
      if (missingFields.length === 0) {
        return NextResponse.json({ error: 'El perfil ya está completo.' }, { status: 409 });
      }
      email = buildFighterProfileReminderEmail({
        fullName: fighter.profiles.full_name,
        language: fighter.profiles.preferred_language,
        missingFields,
        profileUrl: `${requestAppUrl(request)}/fighter/profile`,
      });
      idempotencyKey = `fighter-profile-reminder-${fighter.id}-${missingFields.slice().sort().join('-')}`;
    }

    if (missingFields.length === 0) {
      return NextResponse.json({ error: 'El perfil ya está completo.' }, { status: 409 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY no está configurada.' }, { status: 503 });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'Strikers Match <noreply@strikersmatch.com>',
        to: [recipientEmail],
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
