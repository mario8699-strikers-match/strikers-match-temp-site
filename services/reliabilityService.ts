/**
 * Reliability Service — Wraps the apply_reliability_delta() RPC.
 *
 * Score deltas (server-side enforced):
 *   match_accepted      +2
 *   match_completed     +5  (also increments total_matches)
 *   match_declined      -1
 *   cancel_after_accept -5  (also increments cancellations)
 *   no_show             -15 (also increments no_shows)
 *
 * Score is clamped to [0, 100]. Default starting score is 80.
 */

import { supabase } from '@/lib/supabaseClient';
import type { ServiceResponse } from '@/types';

export type ReliabilityEvent =
  | 'match_accepted'
  | 'match_completed'
  | 'match_declined'
  | 'cancel_after_accept'
  | 'no_show';

/** Fire-and-forget reliability update for a profile. Returns new score. */
export async function applyReliabilityDelta(
  profileId: string,
  eventType: ReliabilityEvent,
  matchId: string | null = null
): Promise<ServiceResponse<number>> {
  const { data, error } = await supabase.rpc('apply_reliability_delta', {
    p_profile_id: profileId,
    p_event_type: eventType,
    p_match_id: matchId,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as number, error: null };
}

/**
 * Resolve fighter ids -> profile ids and apply a delta to each.
 * Used after match-related events when only fighter ids are known.
 */
export async function applyDeltaToFighters(
  fighterIds: string[],
  eventType: ReliabilityEvent,
  matchId: string | null = null
): Promise<void> {
  if (fighterIds.length === 0) return;

  const { data: rows } = await supabase
    .from('fighters')
    .select('profile_id')
    .in('id', fighterIds);

  const profileIds = (rows ?? [])
    .map((r) => r.profile_id)
    .filter((id): id is string => Boolean(id));

  await Promise.all(
    profileIds.map((pid) => applyReliabilityDelta(pid, eventType, matchId))
  );
}

/** Tier label for UI badges. */
export function reliabilityTier(score: number | null | undefined): {
  label: 'High' | 'Solid' | 'Low' | 'Unknown';
  tone: 'emerald' | 'amber' | 'red' | 'zinc';
} {
  if (score == null) return { label: 'Unknown', tone: 'zinc' };
  if (score >= 85) return { label: 'High', tone: 'emerald' };
  if (score >= 60) return { label: 'Solid', tone: 'amber' };
  return { label: 'Low', tone: 'red' };
}
