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

export type MatchSide = 'a' | 'b';

export interface Match {
  id: string;
  event_id: string;
  fighter_a_id: string;
  fighter_b_id: string;
  fighter_a_status: 'pending' | 'accepted' | 'declined';
  fighter_b_status: 'pending' | 'accepted' | 'declined';
  match_status: 'pending' | 'confirmed' | 'cancelled';
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

/** Order ids so fighter_a_id < fighter_b_id (DB constraint). */
function orderPair(idX: string, idY: string): { a: string; b: string } {
  return idX < idY ? { a: idX, b: idY } : { a: idY, b: idX };
}

// ── Promoter: propose a match between two confirmed fighters ──
export async function proposeMatch(
  eventId: string,
  fighterIdX: string,
  fighterIdY: string
): Promise<ServiceResponse<Match>> {
  if (fighterIdX === fighterIdY) {
    return { data: null, error: 'No se puede emparejar a un peleador consigo mismo.' };
  }

  const { a, b } = orderPair(fighterIdX, fighterIdY);

  // Both must be confirmed-paid for this event
  const { data: regs, error: regErr } = await supabase
    .from('event_registrations')
    .select('fighter_id, payment_status')
    .eq('event_id', eventId)
    .in('fighter_id', [a, b]);

  if (regErr) return { data: null, error: regErr.message };

  const okA = regs?.find((r) => r.fighter_id === a)?.payment_status === 'confirmed';
  const okB = regs?.find((r) => r.fighter_id === b)?.payment_status === 'confirmed';
  if (!okA || !okB) {
    return { data: null, error: 'Ambos peleadores deben tener pago confirmado para emparejarse.' };
  }

  // Block duplicate pairings (DB constraint also enforces this)
  const { data: existing } = await supabase
    .from('matches')
    .select('id, match_status')
    .eq('event_id', eventId)
    .eq('fighter_a_id', a)
    .eq('fighter_b_id', b)
    .maybeSingle();

  if (existing && existing.match_status !== 'cancelled') {
    return { data: null, error: 'Ya existe una propuesta de pelea para estos atletas.' };
  }

  const { data, error } = await supabase
    .from('matches')
    .insert({
      event_id: eventId,
      fighter_a_id: a,
      fighter_b_id: b,
      fighter_a_status: 'pending',
      fighter_b_status: 'pending',
      match_status: 'pending',
    })
    .select()
    .single();

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
    .select('id, fighter_a_id, fighter_b_id, match_status')
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

  const patch =
    side === 'a' ? { fighter_a_status: status } : { fighter_b_status: status };

  const { data, error } = await supabase
    .from('matches')
    .update(patch)
    .eq('id', matchId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Match, error: null };
}

// ── Promoter: cancel a confirmed/pending match ──
export async function cancelMatch(matchId: string): Promise<ServiceResponse<Match>> {
  const { data, error } = await supabase
    .from('matches')
    .update({ match_status: 'cancelled' })
    .eq('id', matchId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
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
