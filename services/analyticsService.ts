/**
 * Analytics Service — Event-health metrics for promoters.
 *
 * Focused on operational signals (registration progress, payment health,
 * matchmaking gaps, no-show risks) rather than vanity counts.
 *
 * All queries are scoped to a single event.
 */

import { supabase } from '@/lib/supabaseClient';
import { MIN_MATCHES_FOR_SCORE } from '@/services/reliabilityService';
import type { ServiceResponse } from '@/types';

export interface EventHealth {
  event_id: string;
  event_name: string;
  event_date: string | null;

  totalRegistered: number;
  pending: number;       // not yet submitted payment
  submitted: number;     // payment submitted, awaiting promoter confirmation
  confirmed: number;     // confirmed-paid

  matchesProposed: number;
  matchesConfirmed: number;
  unmatchedConfirmed: number; // confirmed fighters with no confirmed match yet

  weightClassesNeeded: string[];
  weightClassesCovered: string[]; // weight classes present among confirmed-paid fighters
  missingWeightClasses: string[];

  highReliabilityFighters: number; // confirmed fighters with reliability_score >= 85
  noShowRisks: number;             // confirmed fighters with reliability_score < 60

  registrationProgress: number;    // 0..1, confirmed / max(needed, totalRegistered)
}

export async function getEventHealth(
  eventId: string
): Promise<ServiceResponse<EventHealth>> {
  // Event base
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id, event_name, event_date, weight_class_needed, weight_classes_needed')
    .eq('id', eventId)
    .single();

  if (evErr || !event) {
    return { data: null, error: evErr?.message ?? 'Evento no encontrado.' };
  }

  // Registrations + fighter context
  const { data: regs, error: regErr } = await supabase
    .from('event_registrations')
    .select(`
      id,
      payment_status,
      fighter_id,
      fighters:fighter_id (
        id,
        weight_class,
        profile_id,
        profiles:profile_id ( reliability_score, total_matches )
      )
    `)
    .eq('event_id', eventId);

  if (regErr) {
    return { data: null, error: regErr.message };
  }

  type RegRow = {
    id: string;
    payment_status: string;
    fighter_id: string;
    fighters: {
      id: string;
      weight_class: string | null;
      profile_id: string | null;
      profiles: { reliability_score: number | null; total_matches: number | null } | null;
    } | null;
  };

  const rows = (regs ?? []) as unknown as RegRow[];

  const confirmedRows = rows.filter((r) => r.payment_status === 'confirmed');
  const pending = rows.filter((r) => r.payment_status === 'pending').length;
  const submitted = rows.filter((r) => r.payment_status === 'submitted').length;
  const confirmed = confirmedRows.length;

  // Matches
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, match_status, fighter_a_id, fighter_b_id')
    .eq('event_id', eventId);

  if (matchErr) {
    return { data: null, error: matchErr.message };
  }

  const proposed = matches ?? [];
  const matchesProposed = proposed.filter((m) => m.match_status !== 'cancelled').length;
  const confirmedMatches = proposed.filter((m) => m.match_status === 'confirmed');
  const matchesConfirmed = confirmedMatches.length;

  const fightersInConfirmedMatches = new Set<string>();
  confirmedMatches.forEach((m) => {
    fightersInConfirmedMatches.add(m.fighter_a_id);
    fightersInConfirmedMatches.add(m.fighter_b_id);
  });

  const confirmedFighterIds = new Set(confirmedRows.map((r) => r.fighter_id));
  const unmatchedConfirmed = [...confirmedFighterIds].filter(
    (id) => !fightersInConfirmedMatches.has(id)
  ).length;

  // Weight class coverage (against confirmed-paid roster)
  const weightClassesNeeded: string[] =
    (event.weight_classes_needed && event.weight_classes_needed.length > 0)
      ? (event.weight_classes_needed as string[])
      : event.weight_class_needed
      ? [event.weight_class_needed as string]
      : [];

  const weightClassesCovered = Array.from(
    new Set(
      confirmedRows
        .map((r) => r.fighters?.weight_class)
        .filter((w): w is string => Boolean(w))
    )
  );

  const missingWeightClasses = weightClassesNeeded.filter(
    (w: string) => !weightClassesCovered.includes(w)
  );

  // Reliability buckets among confirmed.
  // Only count fighters with enough completed matches (>= MIN_MATCHES_FOR_SCORE)
  // so the default 80 baseline doesn't inflate either bucket for unproven athletes.
  let highReliabilityFighters = 0;
  let noShowRisks = 0;
  for (const r of confirmedRows) {
    const score = r.fighters?.profiles?.reliability_score;
    const totalMatches = r.fighters?.profiles?.total_matches ?? 0;
    if (score == null) continue;
    if (totalMatches < MIN_MATCHES_FOR_SCORE) continue; // 'New' fighter — no track record yet
    if (score >= 85) highReliabilityFighters++;
    else if (score < 60) noShowRisks++;
  }

  // Registration progress (relative to needed weight classes if defined, else just totalRegistered)
  const denom = Math.max(weightClassesNeeded.length * 2, rows.length, 1);
  const registrationProgress = Math.min(1, confirmed / denom);

  return {
    data: {
      event_id: event.id,
      event_name: event.event_name,
      event_date: event.event_date,
      totalRegistered: rows.length,
      pending,
      submitted,
      confirmed,
      matchesProposed,
      matchesConfirmed,
      unmatchedConfirmed,
      weightClassesNeeded,
      weightClassesCovered,
      missingWeightClasses,
      highReliabilityFighters,
      noShowRisks,
      registrationProgress,
    },
    error: null,
  };
}

/** List events owned by promoter for analytics selection. */
export async function getPromoterEvents(
  promoterId: string
): Promise<ServiceResponse<{ id: string; event_name: string; event_date: string | null; status: string }[]>> {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_name, event_date, status')
    .eq('promoter_id', promoterId)
    .order('event_date', { ascending: false, nullsFirst: false });

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

/**
 * List events created by any admin — used by the admin analytics view so
 * admins share visibility on admin-owned events (not on regular promoter
 * events, which remain private to their promoter).
 */
export async function getAdminAnalyticsEvents(): Promise<
  ServiceResponse<{ id: string; event_name: string; event_date: string | null; status: string }[]>
> {
  // Step 1: resolve admin profile ids (small set).
  const { data: admins, error: aErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');
  if (aErr) return { data: null, error: aErr.message };
  const adminIds = (admins ?? []).map((r) => r.id);
  if (adminIds.length === 0) return { data: [], error: null };

  // Step 2: fetch events owned by any of those admins.
  const { data, error } = await supabase
    .from('events')
    .select('id, event_name, event_date, status')
    .in('promoter_id', adminIds)
    .order('event_date', { ascending: false, nullsFirst: false });

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}
