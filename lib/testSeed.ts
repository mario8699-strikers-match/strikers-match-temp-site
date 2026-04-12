/**
 * ============================================
 *  TEST SEED DATA — REMOVE BEFORE PRODUCTION
 * ============================================
 *
 * Seeds the database with test users, fighters, and an event
 * for internal testing of matchmaking + monetization flows.
 */

import { supabase } from '@/lib/supabaseClient';

// ── Test fighter data (10-20 fighters across cities/weights) ──
const TEST_FIGHTERS = [
  { name: 'Carlos Mendoza',   city: 'Mexicali',  weight: '70kg',  short_notice: true,  available: true,  discipline: 'Boxeo' },
  { name: 'Luis Ramirez',     city: 'Mexicali',  weight: '70kg',  short_notice: false, available: true,  discipline: 'MMA' },
  { name: 'Diego Torres',     city: 'Mexicali',  weight: '75kg',  short_notice: true,  available: true,  discipline: 'Muay Thai' },
  { name: 'Miguel Reyes',     city: 'Mexicali',  weight: '65kg',  short_notice: false, available: true,  discipline: 'Kickboxing' },
  { name: 'Andres Vega',      city: 'Mexicali',  weight: '70kg',  short_notice: true,  available: false, discipline: 'Boxeo' },
  { name: 'Ricardo Flores',   city: 'Tijuana',   weight: '70kg',  short_notice: true,  available: true,  discipline: 'Boxeo' },
  { name: 'Fernando Lopez',   city: 'Tijuana',   weight: '80kg',  short_notice: false, available: true,  discipline: 'MMA' },
  { name: 'Jorge Castillo',   city: 'Tijuana',   weight: '70kg',  short_notice: false, available: false, discipline: 'Muay Thai' },
  { name: 'Alejandro Ruiz',   city: 'Tijuana',   weight: '65kg',  short_notice: true,  available: true,  discipline: 'K1' },
  { name: 'Pablo Herrera',    city: 'Ensenada',  weight: '70kg',  short_notice: true,  available: true,  discipline: 'Boxeo' },
  { name: 'Oscar Gutierrez',  city: 'Ensenada',  weight: '75kg',  short_notice: false, available: true,  discipline: 'Kickboxing' },
  { name: 'Raul Morales',     city: 'Ensenada',  weight: '60kg',  short_notice: true,  available: true,  discipline: 'MMA' },
  { name: 'Ivan Navarro',     city: 'Mexicali',  weight: '80kg',  short_notice: true,  available: true,  discipline: 'Boxeo' },
  { name: 'Sergio Delgado',   city: 'Mexicali',  weight: '70kg',  short_notice: false, available: true,  discipline: 'Muay Thai' },
  { name: 'Hugo Salazar',     city: 'Tijuana',   weight: '75kg',  short_notice: true,  available: true,  discipline: 'MMA' },
];

interface SeedResult {
  success: boolean;
  promoterProfileId: string | null;
  fighterProfileIds: string[];
  eventId: string | null;
  errors: string[];
  log: string[];
}

/**
 * Seeds the database with test data.
 * Call this from a dev-only UI button.
 *
 * NOTE: This uses supabase.auth.signUp which creates real auth users.
 * The test users can log in with email/password after seeding.
 */
export async function seedTestData(): Promise<SeedResult> {
  const result: SeedResult = {
    success: false,
    promoterProfileId: null,
    fighterProfileIds: [],
    eventId: null,
    errors: [],
    log: [],
  };

  const log = (msg: string) => {
    console.log(`[SEED] ${msg}`);
    result.log.push(msg);
  };

  try {
    // ── 1. Create promoter test account ──
    log('Creating promoter test account...');
    const { data: promoterAuth, error: promoterErr } = await supabase.auth.signUp({
      email: 'promoter@test.com',
      password: 'test1234',
    });

    if (promoterErr && !promoterErr.message.includes('already registered')) {
      result.errors.push(`Promoter signup: ${promoterErr.message}`);
      log(`ERROR: ${promoterErr.message}`);
    }

    let promoterUserId = promoterAuth?.user?.id;

    // If already registered, try to get the profile directly
    if (!promoterUserId) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'promoter@test.com')
        .maybeSingle();
      promoterUserId = existingProfile?.id;
    }

    if (promoterUserId) {
      // Upsert profile
      await supabase.from('profiles').upsert({
        id: promoterUserId,
        full_name: 'Promotor Test',
        email: 'promoter@test.com',
        role: 'promoter',
        city: 'Mexicali',
        country: 'MX',
      }, { onConflict: 'id' });

      // Upsert subscription (free plan, unused)
      await supabase.from('promoter_subscriptions').upsert({
        profile_id: promoterUserId,
        plan_type: 'free',
        requests_used: 0,
        max_requests: 1,
        is_active: true,
        trial_used: false,
        free_request_used: false,
      }, { onConflict: 'profile_id' });

      result.promoterProfileId = promoterUserId;
      log(`Promoter created: ${promoterUserId}`);
    }

    // ── 2. Create main fighter test account ──
    log('Creating main fighter test account...');
    const { data: fighterAuth, error: fighterErr } = await supabase.auth.signUp({
      email: 'fighter@test.com',
      password: 'test1234',
    });

    if (fighterErr && !fighterErr.message.includes('already registered')) {
      result.errors.push(`Fighter signup: ${fighterErr.message}`);
      log(`ERROR: ${fighterErr.message}`);
    }

    let fighterUserId = fighterAuth?.user?.id;

    if (!fighterUserId) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'fighter@test.com')
        .maybeSingle();
      fighterUserId = existingProfile?.id;
    }

    if (fighterUserId) {
      await supabase.from('profiles').upsert({
        id: fighterUserId,
        full_name: 'Peleador Test',
        email: 'fighter@test.com',
        role: 'fighter',
        city: 'Mexicali',
        country: 'MX',
      }, { onConflict: 'id' });

      await supabase.from('fighters').upsert({
        profile_id: fighterUserId,
        weight_class: '70kg',
        disciplines: ['Boxeo'],
        is_available: true,
        short_notice_ready: true,
        record_wins: 5,
        record_losses: 2,
        record_draws: 0,
        experience_level: 'amateur',
      }, { onConflict: 'profile_id' });

      result.fighterProfileIds.push(fighterUserId);
      log(`Main fighter created: ${fighterUserId}`);
    }

    // ── 3. Seed 15 additional fighters ──
    log('Seeding additional test fighters...');
    for (const f of TEST_FIGHTERS) {
      const email = `${f.name.toLowerCase().replace(/\s+/g, '.')}@test.com`;

      const { data: fAuth, error: fErr } = await supabase.auth.signUp({
        email,
        password: 'test1234',
      });

      if (fErr && !fErr.message.includes('already registered')) {
        result.errors.push(`Fighter ${f.name}: ${fErr.message}`);
        continue;
      }

      let userId = fAuth?.user?.id;
      if (!userId) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        userId = existing?.id;
      }

      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          full_name: f.name,
          email,
          role: 'fighter',
          city: f.city,
          country: 'MX',
        }, { onConflict: 'id' });

        await supabase.from('fighters').upsert({
          profile_id: userId,
          weight_class: f.weight,
          disciplines: [f.discipline],
          is_available: f.available,
          short_notice_ready: f.short_notice,
          record_wins: Math.floor(Math.random() * 15),
          record_losses: Math.floor(Math.random() * 5),
          record_draws: Math.floor(Math.random() * 3),
          experience_level: Math.random() > 0.5 ? 'pro' : 'amateur',
        }, { onConflict: 'profile_id' });

        result.fighterProfileIds.push(userId);
        log(`Fighter seeded: ${f.name} (${f.city}, ${f.weight})`);
      }
    }

    // ── 4. Create test event for promoter ──
    if (promoterUserId) {
      log('Signing in as promoter to create event (RLS requires auth.uid = promoter_id)...');
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: 'promoter@test.com',
        password: 'test1234',
      });

      if (signInErr) {
        result.errors.push(`Promoter sign-in failed: ${signInErr.message}`);
        log(`ERROR: Could not sign in as promoter: ${signInErr.message}`);
      } else {
        log('Creating test event...');

      // Calculate a near-future date (2 weeks from now)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      const dateStr = futureDate.toISOString().split('T')[0];

      const { data: ev, error: evErr } = await supabase
        .from('events')
        .insert({
          promoter_id: promoterUserId,
          event_name: 'Test Fight Night',
          city: 'Mexicali',
          event_date: dateStr,
          weight_class_needed: '70kg',
          weight_classes_needed: ['70kg'],
          disciplines_needed: ['Boxeo'],
          status: 'published',
          notes: 'Evento de prueba para validar flujo de matchmaking y monetizacion.',
        })
        .select()
        .single();

      if (evErr) {
        result.errors.push(`Event create: ${evErr.message}`);
        log(`ERROR creating event: ${evErr.message}`);
      } else {
        result.eventId = ev.id;
        log(`Test event created: ${ev.id} — ${ev.event_name}`);
      }

      // Ensure subscription row exists (signed in as promoter, so RLS passes)
      log('Ensuring promoter subscription row...');
      const { error: subErr } = await supabase.from('promoter_subscriptions').upsert({
        profile_id: promoterUserId,
        plan_type: 'free',
        requests_used: 0,
        max_requests: 1,
        is_active: true,
        trial_used: false,
        free_request_used: false,
      }, { onConflict: 'profile_id' });

      if (subErr) {
        result.errors.push(`Subscription upsert: ${subErr.message}`);
        log(`ERROR: Subscription upsert failed: ${subErr.message}`);
      } else {
        log('Subscription row created/verified.');
      }
      } // end sign-in else
    }

    result.success = result.errors.length === 0;
    log(`Seed complete. ${result.fighterProfileIds.length} fighters, ${result.errors.length} errors.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error('[SEED] Fatal error:', msg);
  }

  return result;
}

// ── Test Flow Result ──
export interface TestFlowResult {
  first_request: 'success' | 'failed';
  second_request: 'blocked' | 'allowed' | 'error';
  paywall_triggered: boolean;
  fighter_attempt: 'blocked' | 'allowed' | 'skipped';
  log: string[];
  errors: string[];
}

/**
 * ============================================
 *  TEST FLOW VALIDATOR — REMOVE BEFORE PRODUCTION
 * ============================================
 *
 * Simulates the full promoter → fight request → paywall flow:
 *   1. Promoter logs in
 *   2. Fetch available fighters
 *   3. Send first fight request → EXPECT: success
 *   4. Send second fight request → EXPECT: BLOCKED
 *   5. Verify fighter CANNOT send requests
 *
 * Call from a dev-only UI button.
 */
export async function runTestFlow(): Promise<TestFlowResult> {
  const result: TestFlowResult = {
    first_request: 'failed',
    second_request: 'error',
    paywall_triggered: false,
    fighter_attempt: 'skipped',
    log: [],
    errors: [],
  };

  const log = (msg: string) => {
    console.log(`[TEST-FLOW] ${msg}`);
    result.log.push(msg);
  };

  try {
    // ── Step 1: Sign in as promoter ──
    log('Step 1 — Signing in as promoter@test.com...');
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: 'promoter@test.com',
      password: 'test1234',
    });
    if (signInErr || !signInData.user) {
      result.errors.push(`Promoter login failed: ${signInErr?.message ?? 'no user returned'}`);
      log(`ERROR: ${signInErr?.message ?? 'no user returned'}`);
      return result;
    }
    const promoterId = signInData.user.id;
    log(`Promoter signed in: ${promoterId}`);

    // ── Step 2: Fetch fighters ──
    log('Step 2 — Fetching available fighters...');
    const { data: fighters, error: fErr } = await supabase
      .from('fighters')
      .select('id, profile_id, weight_class, is_available, profiles(full_name, city)')
      .eq('is_available', true)
      .limit(5);
    if (fErr) {
      result.errors.push(`Fetch fighters: ${fErr.message}`);
      log(`ERROR fetching fighters: ${fErr.message}`);
      return result;
    }
    log(`Found ${fighters?.length ?? 0} available fighters`);

    if (!fighters || fighters.length === 0) {
      result.errors.push('No fighters found. Run seed first.');
      return result;
    }

    // Grab event
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('promoter_id', promoterId)
      .limit(1);
    if (!events || events.length === 0) {
      result.errors.push('No test event found. Run seed first.');
      return result;
    }
    const eventId = events[0].id;
    log(`Using event: ${eventId}`);

    // Reset subscription to fresh free state before testing
    log('Resetting promoter subscription to fresh free state...');
    await supabase.from('promoter_subscriptions').upsert({
      profile_id: promoterId,
      plan_type: 'free',
      requests_used: 0,
      max_requests: 1,
      is_active: true,
      trial_used: false,
      free_request_used: false,
    }, { onConflict: 'profile_id' });
    log('Subscription reset: free plan, free_request_used=false');

    // Clean up any previous test match_requests
    await supabase.from('match_requests').delete().eq('event_id', eventId).eq('sender_id', promoterId);
    log('Cleaned previous test requests.');

    // ── Step 3: First fight request → should SUCCEED ──
    log('Step 3 — Sending FIRST fight request...');
    const { checkCanSendRequest, recordRequestUsed } = await import('@/services/subscriptionService');

    const check1 = await checkCanSendRequest(promoterId);
    log(`  checkCanSendRequest result: allowed=${check1.allowed}, reason="${check1.reason}"`);

    if (check1.allowed) {
      const targetFighter = fighters[0];
      const { error: reqErr } = await supabase.from('match_requests').insert({
        event_id: eventId,
        fighter_id: targetFighter.id,
        sender_id: promoterId,
        status: 'pending',
        message: '[TEST] First request — should succeed',
      });
      if (reqErr) {
        result.errors.push(`First request insert: ${reqErr.message}`);
        log(`  ERROR inserting request: ${reqErr.message}`);
      } else {
        await recordRequestUsed(promoterId);
        result.first_request = 'success';
        log('  FIRST REQUEST: SUCCESS ✓');
        log('  free_request_used changed: false → true');
      }
    } else {
      result.first_request = 'failed';
      log(`  FIRST REQUEST: FAILED — ${check1.reason}`);
    }

    // ── Step 4: Second fight request → should be BLOCKED ──
    log('Step 4 — Sending SECOND fight request (should be blocked)...');
    const check2 = await checkCanSendRequest(promoterId);
    log(`  checkCanSendRequest result: allowed=${check2.allowed}, reason="${check2.reason}"`);

    if (check2.allowed) {
      result.second_request = 'allowed';
      log('  SECOND REQUEST: ALLOWED (UNEXPECTED — paywall not working!)');
    } else {
      result.second_request = 'blocked';
      result.paywall_triggered = true;
      log('  SECOND REQUEST: BLOCKED ✓');
      log(`  Paywall reason: ${check2.reason}`);
    }

    // ── Step 5: Verify fighter CANNOT send requests ──
    log('Step 5 — Verifying fighter cannot send requests...');
    const { canAccessFeature } = await import('@/services/accessService');
    const fighterCanSend = canAccessFeature({ role: 'fighter' }, 'send_fight_request');
    result.fighter_attempt = fighterCanSend ? 'allowed' : 'blocked';
    log(`  Fighter send_fight_request access: ${fighterCanSend ? 'ALLOWED (BUG!)' : 'BLOCKED ✓'}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error('[TEST-FLOW] Fatal error:', msg);
  }

  // Summary
  console.log('[TEST-FLOW] ═══ RESULTS ═══');
  console.log(`[TEST-FLOW]   first_request:    ${result.first_request}`);
  console.log(`[TEST-FLOW]   second_request:   ${result.second_request}`);
  console.log(`[TEST-FLOW]   paywall_triggered: ${result.paywall_triggered}`);
  console.log(`[TEST-FLOW]   fighter_attempt:   ${result.fighter_attempt}`);
  console.log('[TEST-FLOW] ════════════════');

  return result;
}
