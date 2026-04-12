/**
 * ============================================
 *  TEST FLOW UTILITY — REMOVE BEFORE PRODUCTION
 * ============================================
 *
 * Simulates the full monetization flow:
 *   1. Promoter logs in
 *   2. Fetch fighters
 *   3. Send first fight request → should SUCCEED (free trial)
 *   4. Send second fight request → should be BLOCKED (paywall)
 *
 * Also validates:
 *   - Fighters CANNOT send requests (role check)
 *   - free_request_used flag changes correctly
 */

import { supabase } from '@/lib/supabaseClient';
import { checkCanSendRequest, recordRequestUsed } from '@/services/subscriptionService';
import { canAccessFeature } from '@/services/accessService';

export interface TestFlowResult {
  first_request: 'success' | 'failed' | 'skipped';
  second_request: 'blocked' | 'allowed' | 'skipped';
  paywall_triggered: boolean;
  fighter_blocked: boolean;
  free_request_used_before: boolean;
  free_request_used_after: boolean;
  log: string[];
  errors: string[];
}

/**
 * Run the full test flow.
 * Requires test data to be seeded first (via seedTestData).
 */
export async function runTestFlow(): Promise<TestFlowResult> {
  const result: TestFlowResult = {
    first_request: 'skipped',
    second_request: 'skipped',
    paywall_triggered: false,
    fighter_blocked: false,
    free_request_used_before: false,
    free_request_used_after: false,
    log: [],
    errors: [],
  };

  const log = (msg: string) => {
    console.log(`[TEST] ${msg}`);
    result.log.push(msg);
  };

  try {
    // ── Step 0: Validate fighter CANNOT send requests ──
    log('--- VALIDATION: Fighter role access check ---');
    const fighterCanSend = canAccessFeature({ role: 'fighter' }, 'send_fight_request');
    result.fighter_blocked = !fighterCanSend;
    log(`Fighter can send_fight_request: ${fighterCanSend} (expected: false) → ${!fighterCanSend ? 'PASS' : 'FAIL'}`);

    // ── Step 1: Log in as promoter ──
    log('--- STEP 1: Promoter login ---');
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'promoter@test.com',
      password: 'test1234',
    });

    if (authErr || !authData.user) {
      result.errors.push(`Login failed: ${authErr?.message ?? 'No user returned'}`);
      log(`ERROR: Login failed — ${authErr?.message}`);
      return result;
    }

    const promoterId = authData.user.id;
    log(`Logged in as promoter: ${promoterId}`);

    // Validate promoter CAN send requests (role check)
    const promoterCanSend = canAccessFeature({ role: 'promoter' }, 'send_fight_request');
    log(`Promoter can send_fight_request: ${promoterCanSend} (expected: true) → ${promoterCanSend ? 'PASS' : 'FAIL'}`);

    // ── Step 2: Fetch fighters ──
    log('--- STEP 2: Fetch available fighters ---');
    const { data: fighters, error: fetchErr } = await supabase
      .from('fighters')
      .select('id, weight_class, is_available, profiles(full_name, city)')
      .eq('is_available', true)
      .limit(5);

    if (fetchErr || !fighters || fighters.length === 0) {
      result.errors.push(`Fetch fighters failed: ${fetchErr?.message ?? 'No fighters found'}`);
      log(`ERROR: No fighters found. Run seed first.`);
      return result;
    }

    log(`Found ${fighters.length} available fighters`);

    // Get test event
    const { data: events } = await supabase
      .from('events')
      .select('id, event_name')
      .eq('promoter_id', promoterId)
      .limit(1);

    if (!events || events.length === 0) {
      // Try to create the event on the fly if it doesn't exist
      log('Test event not found — creating one now...');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      const dateStr = futureDate.toISOString().split('T')[0];

      const { data: newEv, error: evCreateErr } = await supabase
        .from('events')
        .insert({
          promoter_id: promoterId,
          event_name: 'Test Fight Night',
          city: 'Mexicali',
          event_date: dateStr,
          weight_class_needed: '70kg',
          weight_classes_needed: ['70kg'],
          disciplines_needed: ['Boxeo'],
          status: 'published',
          notes: '[TEST] Auto-created by test flow.',
        })
        .select()
        .single();

      if (evCreateErr || !newEv) {
        result.errors.push(`Could not find or create test event: ${evCreateErr?.message ?? 'unknown'}`);
        log(`ERROR: ${evCreateErr?.message ?? 'Event creation returned null'}`);
        return result;
      }
      events!.push(newEv);
      log(`Created test event: ${newEv.id}`);
    }

    const eventId = events![0].id;
    log(`Using event: ${events![0].event_name} (${eventId})`);

    // Check current free_request_used state
    const { data: subBefore } = await supabase
      .from('promoter_subscriptions')
      .select('free_request_used, plan_type, requests_used')
      .eq('profile_id', promoterId)
      .single();

    result.free_request_used_before = subBefore?.free_request_used ?? false;
    log(`Subscription state BEFORE: plan=${subBefore?.plan_type}, free_request_used=${subBefore?.free_request_used}, requests_used=${subBefore?.requests_used}`);

    // ── Step 3: First fight request (should succeed) ──
    log('--- STEP 3: First fight request (expect SUCCESS) ---');
    const fighter1 = fighters[0];

    const check1 = await checkCanSendRequest(promoterId);
    log(`checkCanSendRequest #1: allowed=${check1.allowed}, reason="${check1.reason}"`);

    if (check1.allowed) {
      // Send the request
      const { error: reqErr } = await supabase
        .from('match_requests')
        .insert({
          event_id: eventId,
          fighter_id: fighter1.id,
          sender_id: promoterId,
          status: 'pending',
          message: '[TEST] First request — free trial',
        });

      if (reqErr) {
        result.first_request = 'failed';
        result.errors.push(`First request insert failed: ${reqErr.message}`);
        log(`ERROR: ${reqErr.message}`);
      } else {
        await recordRequestUsed(promoterId);
        result.first_request = 'success';
        log('First request: SUCCESS — sent and recorded');
      }
    } else {
      result.first_request = 'failed';
      result.errors.push('First request was blocked unexpectedly');
      log(`FAIL: First request blocked — ${check1.reason}`);
    }

    // Check free_request_used changed
    const { data: subAfter1 } = await supabase
      .from('promoter_subscriptions')
      .select('free_request_used, requests_used')
      .eq('profile_id', promoterId)
      .single();

    log(`free_request_used after first request: ${subAfter1?.free_request_used} (expected: true)`);

    // ── Step 4: Second fight request (should be BLOCKED) ──
    log('--- STEP 4: Second fight request (expect BLOCKED) ---');
    const fighter2 = fighters.length > 1 ? fighters[1] : fighters[0];

    const check2 = await checkCanSendRequest(promoterId);
    log(`checkCanSendRequest #2: allowed=${check2.allowed}, reason="${check2.reason}"`);

    if (!check2.allowed) {
      result.second_request = 'blocked';
      result.paywall_triggered = true;
      log('Second request: BLOCKED — paywall triggered correctly');
    } else {
      result.second_request = 'allowed';
      result.errors.push('Second request was allowed — paywall FAILED');
      log('FAIL: Second request was allowed when it should have been blocked');

      // Clean up: don't actually send the second one
    }

    // Final subscription state
    const { data: subFinal } = await supabase
      .from('promoter_subscriptions')
      .select('free_request_used, plan_type, requests_used, trial_used')
      .eq('profile_id', promoterId)
      .single();

    result.free_request_used_after = subFinal?.free_request_used ?? false;
    log(`Final subscription state: plan=${subFinal?.plan_type}, free_request_used=${subFinal?.free_request_used}, trial_used=${subFinal?.trial_used}, requests_used=${subFinal?.requests_used}`);

    // ── Summary ──
    log('--- SUMMARY ---');
    log(`First request:  ${result.first_request}`);
    log(`Second request: ${result.second_request}`);
    log(`Paywall triggered: ${result.paywall_triggered}`);
    log(`Fighter blocked: ${result.fighter_blocked}`);
    log(`free_request_used changed: ${result.free_request_used_before} → ${result.free_request_used_after}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error('[TEST] Fatal error:', msg);
  }

  return result;
}

/**
 * Reset the test promoter's subscription back to fresh free state.
 * Useful for re-running tests.
 */
export async function resetTestSubscription(): Promise<{ success: boolean; error?: string }> {
  console.log('[TEST] Resetting promoter subscription...');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'promoter@test.com')
    .maybeSingle();

  if (!profile) return { success: false, error: 'Promoter test account not found' };

  // Reset subscription
  const { error } = await supabase
    .from('promoter_subscriptions')
    .update({
      plan_type: 'free',
      requests_used: 0,
      free_request_used: false,
      trial_used: false,
      is_active: true,
    })
    .eq('profile_id', profile.id);

  if (error) return { success: false, error: error.message };

  // Clean up test match_requests
  await supabase
    .from('match_requests')
    .delete()
    .eq('sender_id', profile.id)
    .like('message', '%[TEST]%');

  console.log('[TEST] Subscription reset complete');
  return { success: true };
}
