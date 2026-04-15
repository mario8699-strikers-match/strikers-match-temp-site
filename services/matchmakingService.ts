/**
 * Matchmaking Service — Smart fighter recommendations for events.
 *
 * Scoring system (0–100 points):
 *   Weight Match:    0–40 pts
 *   Location:        0–20 pts
 *   Availability:    0–20 pts
 *   Short Notice:    0–10 pts
 *   Experience:      0–10 pts
 *
 * Pre-filters from Supabase to reduce load, then scores in memory.
 */

import { supabase } from '@/lib/supabaseClient';
import type { FighterWithProfile, MatchResult } from '@/types';

// ── Ordered weight classes for neighbor matching ──
const WEIGHT_ORDER = [
  'minimosca', 'mosca', 'supermosca', 'gallo', 'supergallo',
  'pluma', 'superpluma', 'ligero', 'superligero', 'welter',
  'superwelter', 'medio', 'supermedio', 'semipesado', 'crucero', 'pesado',
];

// ── Types ──────────────────────────────────────
interface MatchmakingEvent {
  weight_class_needed?: string | null;
  weight_classes_needed?: string[];
  city?: string | null;
  event_date?: string | null;
}

interface MatchmakingOptions {
  min_fights?: number;
  preferred_gym?: string;
  exclude_fighters?: string[];
  only_confirmed_fighters?: string[]; // Only include these fighter IDs (from confirmed registrations)
  limit?: number;
}

// ── Helper: get neighboring weight classes ──────
function getWeightNeighbors(weightClass: string): string[] {
  const idx = WEIGHT_ORDER.indexOf(weightClass);
  if (idx === -1) return [];
  const neighbors: string[] = [];
  if (idx > 0) neighbors.push(WEIGHT_ORDER[idx - 1]);
  if (idx < WEIGHT_ORDER.length - 1) neighbors.push(WEIGHT_ORDER[idx + 1]);
  return neighbors;
}

// ── Helper: check if date is within range ───────
function isDateInRange(eventDate: string, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  const d = new Date(eventDate).getTime();
  if (from && d < new Date(from).getTime()) return false;
  if (to && d > new Date(to).getTime()) return false;
  return true;
}

function isDateNearRange(eventDate: string, from: string | null, to: string | null, daysMargin: number = 7): boolean {
  if (!from && !to) return false;
  const d = new Date(eventDate).getTime();
  const margin = daysMargin * 24 * 60 * 60 * 1000;
  if (from) {
    const fromTime = new Date(from).getTime();
    if (d >= fromTime - margin && d < fromTime) return true;
  }
  if (to) {
    const toTime = new Date(to).getTime();
    if (d > toTime && d <= toTime + margin) return true;
  }
  return false;
}

// ── Scoring Functions ───────────────────────────
function scoreWeight(fighter: FighterWithProfile, eventWeights: string[]): { score: number; reason: string | null } {
  if (!fighter.weight_class || eventWeights.length === 0) return { score: 0, reason: null };

  // Exact match
  if (eventWeights.includes(fighter.weight_class)) {
    return { score: 40, reason: 'Peso exacto' };
  }

  // Neighbor match (within +/-1 class of any event weight)
  for (const ew of eventWeights) {
    const neighbors = getWeightNeighbors(ew);
    if (neighbors.includes(fighter.weight_class)) {
      return { score: 25, reason: 'Peso cercano' };
    }
  }

  return { score: 0, reason: null };
}

function scoreLocation(fighter: FighterWithProfile, eventCity: string | null): { score: number; reason: string | null } {
  if (!eventCity || !fighter.profiles?.city) return { score: 0, reason: null };

  const fc = fighter.profiles.city.toLowerCase().trim();
  const ec = eventCity.toLowerCase().trim();

  if (fc === ec) return { score: 20, reason: 'Misma ciudad' };

  // Same state check (basic: if fighter has state field)
  if (fighter.state && fighter.state.toLowerCase() === ec) {
    return { score: 10, reason: 'Mismo estado' };
  }

  return { score: 0, reason: null };
}

function scoreAvailability(fighter: FighterWithProfile, eventDate: string | null): { score: number; reason: string | null } {
  if (!eventDate) return { score: 10, reason: null };

  if (isDateInRange(eventDate, fighter.available_from, fighter.available_to)) {
    return { score: 20, reason: 'Disponible en la fecha del evento' };
  }

  if (isDateNearRange(eventDate, fighter.available_from, fighter.available_to)) {
    return { score: 10, reason: 'Disponible cerca de la fecha' };
  }

  return { score: 0, reason: null };
}

function scoreShortNotice(fighter: FighterWithProfile): { score: number; reason: string | null } {
  if (fighter.short_notice_ready) {
    return { score: 10, reason: 'Listo con aviso corto' };
  }
  return { score: 0, reason: null };
}

function scoreExperience(fighter: FighterWithProfile): { score: number; reason: string | null } {
  const totalFights = fighter.record_wins + fighter.record_losses + fighter.record_draws;
  if (totalFights >= 10) return { score: 10, reason: `${totalFights} peleas de experiencia` };
  if (totalFights >= 5) return { score: 5, reason: `${totalFights} peleas de experiencia` };
  return { score: 2, reason: null };
}

// ── Main Function ───────────────────────────────
export async function getRecommendedFighters(
  event: MatchmakingEvent,
  options?: MatchmakingOptions
): Promise<{ data: MatchResult[]; error: string | null; executionMs: number }> {
  const start = performance.now();
  const maxResults = options?.limit ?? 20;

  try {
    // Build target weight classes
    const targetWeights: string[] = [];
    if (event.weight_classes_needed?.length) {
      targetWeights.push(...event.weight_classes_needed);
    } else if (event.weight_class_needed) {
      targetWeights.push(event.weight_class_needed);
    }

    // Pre-filter query: only available, non-hidden fighters
    let query = supabase
      .from('fighters')
      .select('*, profiles(full_name, email, city, is_banned)')
      .eq('is_available', true)
      .neq('is_hidden', true)
      .limit(100);

    // Weight class pre-filter: exact + neighbors
    if (targetWeights.length > 0) {
      const allWeights = new Set(targetWeights);
      for (const w of targetWeights) {
        for (const n of getWeightNeighbors(w)) allWeights.add(n);
      }
      query = query.in('weight_class', Array.from(allWeights));
    }

    // Timeout: abort if query takes too long
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const { data: fighters, error } = await query.abortSignal(controller.signal);
    clearTimeout(timeout);

    if (error) {
      return { data: [], error: error.message, executionMs: performance.now() - start };
    }

    if (!fighters || fighters.length === 0) {
      return { data: [], error: null, executionMs: performance.now() - start };
    }

    // Apply optional exclusions
    let candidateFighters = fighters as FighterWithProfile[];

    if (options?.exclude_fighters?.length) {
      candidateFighters = candidateFighters.filter(
        (f) => !options.exclude_fighters!.includes(f.id)
      );
    }

    // Only include confirmed-payment fighters when filter is provided
    if (options?.only_confirmed_fighters) {
      candidateFighters = candidateFighters.filter(
        (f) => options.only_confirmed_fighters!.includes(f.id)
      );
    }

    if (options?.min_fights) {
      candidateFighters = candidateFighters.filter(
        (f) => f.record_wins + f.record_losses + f.record_draws >= options.min_fights!
      );
    }

    if (options?.preferred_gym) {
      // Boost preferred gym fighters to top (handled in scoring below)
    }

    // Score each fighter
    const results: MatchResult[] = candidateFighters.map((fighter) => {
      const weight = scoreWeight(fighter, targetWeights);
      const location = scoreLocation(fighter, event.city ?? null);
      const availability = scoreAvailability(fighter, event.event_date ?? null);
      const shortNotice = scoreShortNotice(fighter);
      const experience = scoreExperience(fighter);

      const match_score = weight.score + location.score + availability.score + shortNotice.score + experience.score;

      // Gym bonus (not part of 100-point scale, just a tiebreaker)
      const gymBonus = options?.preferred_gym && fighter.gym_name?.toLowerCase().includes(options.preferred_gym.toLowerCase()) ? 1 : 0;

      const match_reasons: string[] = [];
      if (weight.reason) match_reasons.push(weight.reason);
      if (location.reason) match_reasons.push(location.reason);
      if (availability.reason) match_reasons.push(availability.reason);
      if (shortNotice.reason) match_reasons.push(shortNotice.reason);
      if (experience.reason) match_reasons.push(experience.reason);

      return {
        fighter,
        match_score: match_score + gymBonus,
        match_reasons,
      };
    });

    // Sort descending by score, take top N
    results.sort((a, b) => b.match_score - a.match_score);
    const topResults = results.slice(0, maxResults);

    const executionMs = performance.now() - start;
    if (typeof console !== 'undefined') {
      console.log(`[Matchmaking] Found ${topResults.length} fighters in ${executionMs.toFixed(1)}ms`);
    }

    return { data: topResults, error: null, executionMs };
  } catch (err) {
    const executionMs = performance.now() - start;
    const message = err instanceof Error ? err.message : 'Matchmaking error';
    return { data: [], error: message, executionMs };
  }
}
