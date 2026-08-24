/**
 * Match Service — Fighter-vs-fighter pairings with two-sided accept/decline.
 *
 * Lifecycle:
 *   Promoter proposes match (both fighters confirmed-paid)
 *     -> match_status = 'pending', fighter_a_status = 'pending', fighter_b_status = 'pending'
 *   Fighter accepts  -> fighter_x_status = 'accepted'
 *   Both accept      -> trigger flips match_status -> 'confirmed'
 *   Either declines  -> trigger flips match_status -> 'cancelled'
 *   Promoter cancel  -> match_status -> 'cancelled' (manual)
 *
 * Only confirmed-paid fighters in the same event are eligible.
 */

import { supabase } from '@/lib/supabaseClient';
import type { ServiceResponse } from '@/types';
import { applyDeltaToFighters } from '@/services/reliabilityService';

export type MatchSide = 'a' | 'b';

export interface Match {
  id: string;
  event_id: string;
  fighter_a_id: string;
  fighter_b_id: string;
  fighter_a_status: 'pending' | 'accepted' | 'declined';
  fighter_b_status: 'pending' | 'accepted' | 'declined';
  match_status: 'pending' | 'confirmed' | 'cancelled';
  compatibility_score?: number | null;
  score_breakdown?: Record<string, number>;
  warnings?: string[];
  rule_version?: number | null;
  approved_at?: string | null;
  created_at: string;
}

export interface MatchWithContext extends Match {
  events?: {
    id: string;
    event_name: string;
    event_date: string | null;
    city: string | null;
  } | null;
  fighter_a?: {
    id: string;
    weight_class: string | null;
    profiles: { full_name: string | null; city: string | null } | null;
  } | null;
  fighter_b?: {
    id: string;
    weight_class: string | null;
    profiles: { full_name: string | null; city: string | null } | null;
  } | null;
}

const SELECT_WITH_CONTEXT = `
  *,
  events:event_id ( id, event_name, event_date, city ),
  fighter_a:fighter_a_id ( id, weight_class, profiles ( full_name, city ) ),
  fighter_b:fighter_b_id ( id, weight_class, profiles ( full_name, city ) )
`;

// ── Promoter: propose a match between two confirmed fighters ──
export async function proposeMatch(
  eventId: string,
  fighterIdX: string,
  fighterIdY: string,
  compatibility?: {
    score: number;
    scoreBreakdown: Record<string, number>;
    warnings: string[];
    ruleVersion: number;
  }
): Promise<ServiceResponse<Match>> {
  if (fighterIdX === fighterIdY) {
    return { data: null, error: 'No se puede emparejar a un peleador consigo mismo.' };
  }

  const { data, error } = await supabase.rpc('propose_event_match', {
    target_event_id: eventId,
    fighter_x_id: fighterIdX,
    fighter_y_id: fighterIdY,
    next_compatibility_score: compatibility?.score ?? null,
    next_score_breakdown: compatibility?.scoreBreakdown ?? {},
    next_warnings: compatibility?.warnings ?? [],
    next_rule_version: compatibility?.ruleVersion ?? null,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as Match, error: null };
}

// ── Fighter: accept a proposed match ──
export async function acceptMatch(
  matchId: string,
  fighterId: string
): Promise<ServiceResponse<Match>> {
  return updateFighterStatus(matchId, fighterId, 'accepted');
}

// ── Fighter: decline a proposed match ──
export async function declineMatch(
  matchId: string,
  fighterId: string
): Promise<ServiceResponse<Match>> {
  return updateFighterStatus(matchId, fighterId, 'declined');
}

async function updateFighterStatus(
  matchId: string,
  fighterId: string,
  status: 'accepted' | 'declined'
): Promise<ServiceResponse<Match>> {
  const { data: match, error: fetchErr } = await supabase
    .from('matches')
    .select('id, fighter_a_id, fighter_b_id, fighter_a_status, fighter_b_status, match_status')
    .eq('id', matchId)
    .single();

  if (fetchErr || !match) {
    return { data: null, error: 'Propuesta de pelea no encontrada.' };
  }
  if (match.match_status === 'cancelled') {
    return { data: null, error: 'Esta propuesta ya fue cancelada.' };
  }
  if (match.match_status === 'confirmed' && status === 'declined') {
    return { data: null, error: 'No puedes rechazar una pelea ya confirmada. Cancela en su lugar.' };
  }

  const side: MatchSide | null =
    fighterId === match.fighter_a_id ? 'a'
    : fighterId === match.fighter_b_id ? 'b'
    : null;

  if (!side) {
    return { data: null, error: 'No formas parte de esta propuesta.' };
  }

  const wasConfirmed = match.match_status === 'confirmed';
  const patch =
    side === 'a' ? { fighter_a_status: status } : { fighter_b_status: status };

  const { data, error } = await supabase
    .from('matches')
    .update(patch)
    .eq('id', matchId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  // ─ Reliability side-effects ─
  // accept/decline: apply to acting fighter only
  if (status === 'accepted') {
    await applyDeltaToFighters([fighterId], 'match_accepted', matchId);
  } else if (status === 'declined') {
    if (wasConfirmed) {
      // Decline after confirmation = cancel-after-accept
      await applyDeltaToFighters([fighterId], 'cancel_after_accept', matchId);
    } else {
      await applyDeltaToFighters([fighterId], 'match_declined', matchId);
    }
  }

  return { data: data as Match, error: null };
}

// ── Promoter: cancel a confirmed/pending match ──
export async function cancelMatch(matchId: string): Promise<ServiceResponse<Match>> {
  // Snapshot pre-cancel state for reliability scoring
  const { data: pre } = await supabase
    .from('matches')
    .select('fighter_a_id, fighter_b_id, match_status')
    .eq('id', matchId)
    .single();

  const { data, error } = await supabase
    .from('matches')
    .update({ match_status: 'cancelled' })
    .eq('id', matchId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  // If the match had been confirmed, both fighters get the cancel-after-accept hit
  if (pre && pre.match_status === 'confirmed') {
    await applyDeltaToFighters(
      [pre.fighter_a_id, pre.fighter_b_id],
      'cancel_after_accept',
      matchId
    );
  }

  return { data: data as Match, error: null };
}

// ── Fighter inbox: list matches involving a fighter ──
export async function getMatchesForFighter(
  fighterId: string
): Promise<ServiceResponse<MatchWithContext[]>> {
  const { data, error } = await supabase
    .from('matches')
    .select(SELECT_WITH_CONTEXT)
    .or(`fighter_a_id.eq.${fighterId},fighter_b_id.eq.${fighterId}`)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as MatchWithContext[], error: null };
}

// ── Promoter view: list matches for an event ──
export async function getMatchesForEvent(
  eventId: string
): Promise<ServiceResponse<MatchWithContext[]>> {
  const { data, error } = await supabase
    .from('matches')
    .select(SELECT_WITH_CONTEXT)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as MatchWithContext[], error: null };
}

/** Convenience: which side of a match is the given fighter on? */
export function fighterSide(match: Match, fighterId: string): MatchSide | null {
  if (match.fighter_a_id === fighterId) return 'a';
  if (match.fighter_b_id === fighterId) return 'b';
  return null;
}

/** Per-fighter status accessor. */
export function statusForFighter(match: Match, fighterId: string): Match['fighter_a_status'] | null {
  const side = fighterSide(match, fighterId);
  if (!side) return null;
  return side === 'a' ? match.fighter_a_status : match.fighter_b_status;
}
