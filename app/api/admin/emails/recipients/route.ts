import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest, createAdminSupabase } from '@/lib/serverAuth';
import {
  getMissingFighterRegistrationProfileFields,
  getMissingManualFighterProfileFields,
} from '@/lib/fighterRegistrationProfile';
import type { AdminEmailRecipient } from '@/lib/adminEmailRecipients';
import type { FighterWithProfile, ManualFighterWithCreator } from '@/types';

export const runtime = 'nodejs';

const BATCH_SIZE = 500;

async function loadRegisteredFighters() {
  const admin = createAdminSupabase();
  const rows: FighterWithProfile[] = [];

  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await admin
      .from('fighters')
      .select('*, profiles!inner(full_name, email, city, phone, is_banned, country, country_code, instagram, preferred_language)')
      .order('created_at', { ascending: false })
      .range(from, from + BATCH_SIZE - 1);
    if (error) throw error;
    const batch = (data as unknown as FighterWithProfile[]) ?? [];
    rows.push(...batch);
    if (batch.length < BATCH_SIZE) break;
  }

  return rows;
}

async function loadManualFighters() {
  const admin = createAdminSupabase();
  const rows: ManualFighterWithCreator[] = [];

  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await admin
      .from('manual_fighters')
      .select('*, profiles:manager_id(full_name, email, role, preferred_language, is_banned)')
      .order('created_at', { ascending: false })
      .range(from, from + BATCH_SIZE - 1);
    if (error) throw error;
    const batch = (data as unknown as ManualFighterWithCreator[]) ?? [];
    rows.push(...batch);
    if (batch.length < BATCH_SIZE) break;
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'admin') {
      return NextResponse.json({ error: 'admin_required' }, { status: 403 });
    }

    const [fighters, manualFighters] = await Promise.all([
      loadRegisteredFighters(),
      loadManualFighters(),
    ]);

    const recipients: AdminEmailRecipient[] = [
      ...fighters.map((fighter): AdminEmailRecipient => ({
        key: `registered:${fighter.id}`,
        kind: 'registered',
        targetId: fighter.id,
        fighterName: fighter.profiles.full_name,
        recipientName: fighter.profiles.full_name,
        email: fighter.profiles.email,
        language: fighter.profiles.preferred_language,
        isBanned: Boolean(fighter.profiles.is_banned),
        isHidden: Boolean(fighter.is_hidden),
        location: [fighter.profiles.city, fighter.profiles.country].filter(Boolean).join(' '),
        missingFields: getMissingFighterRegistrationProfileFields(fighter, fighter.profiles),
        createdAt: fighter.created_at,
      })),
      ...manualFighters.flatMap((fighter): AdminEmailRecipient[] => fighter.profiles ? [{
        key: `manual:${fighter.id}`,
        kind: 'manual',
        targetId: fighter.id,
        fighterName: fighter.full_name,
        recipientName: fighter.profiles.full_name,
        email: fighter.profiles.email,
        language: fighter.profiles.preferred_language,
        isBanned: Boolean(fighter.profiles.is_banned),
        isHidden: !fighter.is_public,
        location: [fighter.city, fighter.country].filter(Boolean).join(' '),
        missingFields: getMissingManualFighterProfileFields(fighter),
        managerRole: fighter.profiles.role,
        createdAt: fighter.created_at,
      }] : []),
    ]
      .filter(({ missingFields }) => missingFields.length > 0)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ recipients });
  } catch (error) {
    console.error('[admin-email-recipients]', error);
    return NextResponse.json({ error: 'recipient_load_failed' }, { status: 500 });
  }
}
