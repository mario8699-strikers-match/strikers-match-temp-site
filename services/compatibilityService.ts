import { supabase } from '@/lib/supabaseClient';
import type { RegistrationWithFighter, ServiceResponse } from '@/types';

export interface MatchmakingSettings {
  event_id: string;
  weight_tolerance_kg: number;
  age_tolerance_years: number;
  experience_tolerance_fights: number;
  allow_same_team: boolean;
  recent_opponent_lookback_days: number;
  max_bouts_per_fighter: number;
  minimum_rest_minutes: number;
  rules_version: number;
  registration_closes_at: string | null;
}

export interface CompatibilityScoreBreakdown {
  weight: number;
  age: number;
  experience: number;
  rank: number;
  opponentHistory: number;
}

export interface CompatibilityResult {
  fighterA: RegistrationWithFighter;
  fighterB: RegistrationWithFighter;
  eligible: boolean;
  hardFailures: string[];
  warnings: string[];
  totalScore: number;
  scoreBreakdown: CompatibilityScoreBreakdown;
  ruleVersion: number;
}

const DEFAULT_SETTINGS: Omit<MatchmakingSettings, 'event_id'> = {
  weight_tolerance_kg: 2,
  age_tolerance_years: 3,
  experience_tolerance_fights: 5,
  allow_same_team: false,
  recent_opponent_lookback_days: 365,
  max_bouts_per_fighter: 1,
  minimum_rest_minutes: 30,
  rules_version: 1,
  registration_closes_at: null,
};

function totalFights(registration: RegistrationWithFighter): number {
  return (registration.record_wins ?? 0)
    + (registration.record_losses ?? 0)
    + (registration.record_draws ?? 0);
}

function differenceScore(difference: number, tolerance: number, maximum: number): number {
  if (difference <= 0) return maximum;
  if (tolerance <= 0 || difference > tolerance) return 0;
  return Math.max(0, Math.round(maximum * (1 - difference / tolerance)));
}

function normalizeDiscipline(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function getDisciplineSet(registration: RegistrationWithFighter): Set<string> {
  const disciplines = new Set<string>();
  const registered = normalizeDiscipline(registration.registered_discipline);
  if (registered) disciplines.add(registered);

  for (const discipline of registration.fighters?.disciplines ?? []) {
    const normalized = normalizeDiscipline(discipline);
    if (normalized) disciplines.add(normalized);
  }

  return disciplines;
}

function disciplinesMatch(
  fighterA: RegistrationWithFighter,
  fighterB: RegistrationWithFighter
): boolean {
  const registeredA = normalizeDiscipline(fighterA.registered_discipline);
  const registeredB = normalizeDiscipline(fighterB.registered_discipline);
  const disciplinesA = getDisciplineSet(fighterA);
  const disciplinesB = getDisciplineSet(fighterB);

  if (registeredA && registeredB) return registeredA === registeredB;
  if (registeredA) return disciplinesB.has(registeredA);
  if (registeredB) return disciplinesA.has(registeredB);

  for (const discipline of disciplinesA) {
    if (disciplinesB.has(discipline)) return true;
  }
  return false;
}

export function calculateCompatibility(
  fighterA: RegistrationWithFighter,
  fighterB: RegistrationWithFighter,
  settings: MatchmakingSettings,
  assignedFighterIds: ReadonlySet<string> = new Set(),
  recentPairKeys: ReadonlySet<string> = new Set()
): CompatibilityResult {
  const hardFailures: string[] = [];
  const warnings: string[] = [];

  if (fighterA.id === fighterB.id || fighterA.fighter_id === fighterB.fighter_id) {
    hardFailures.push('same_fighter');
  }
  if (fighterA.event_id !== fighterB.event_id || fighterA.event_id !== settings.event_id) {
    hardFailures.push('different_event');
  }
  if (fighterA.eligibility_status !== 'eligible') hardFailures.push('fighter_a_not_eligible');
  if (fighterB.eligibility_status !== 'eligible') hardFailures.push('fighter_b_not_eligible');
  if (assignedFighterIds.has(fighterA.fighter_id)) hardFailures.push('fighter_a_already_assigned');
  if (assignedFighterIds.has(fighterB.fighter_id)) hardFailures.push('fighter_b_already_assigned');

  if (!disciplinesMatch(fighterA, fighterB)) {
    hardFailures.push('discipline_mismatch');
  }
  if (fighterA.ruleset && fighterB.ruleset && fighterA.ruleset !== fighterB.ruleset) {
    hardFailures.push('ruleset_mismatch');
  }
  if (fighterA.gender_division && fighterB.gender_division && fighterA.gender_division !== fighterB.gender_division) {
    hardFailures.push('gender_division_mismatch');
  }
  if (!settings.allow_same_team && fighterA.team_name && fighterB.team_name
      && fighterA.team_name.trim().toLowerCase() === fighterB.team_name.trim().toLowerCase()) {
    hardFailures.push('same_team');
  }

  const weightA = fighterA.weigh_in_weight;
  const weightB = fighterB.weigh_in_weight;
  const weightDifference = weightA !== null && weightB !== null ? Math.abs(weightA - weightB) : null;
  if (weightDifference === null) {
    warnings.push('exact_weight_missing');
  } else if (weightDifference > settings.weight_tolerance_kg) {
    hardFailures.push('weight_tolerance_exceeded');
  }

  const ageA = fighterA.age_at_event;
  const ageB = fighterB.age_at_event;
  const ageDifference = ageA !== null && ageB !== null ? Math.abs(ageA - ageB) : null;
  if (ageDifference === null) {
    warnings.push('age_missing');
  } else if (ageDifference > settings.age_tolerance_years) {
    hardFailures.push('age_tolerance_exceeded');
  }

  const experienceDifference = Math.abs(totalFights(fighterA) - totalFights(fighterB));
  if (experienceDifference > settings.experience_tolerance_fights) {
    hardFailures.push('experience_tolerance_exceeded');
  }

  const pairKey = [fighterA.fighter_id, fighterB.fighter_id].sort().join(':');
  if (recentPairKeys.has(pairKey)) hardFailures.push('recent_opponent');

  const rankMatches = fighterA.belt_level && fighterB.belt_level
    ? fighterA.belt_level === fighterB.belt_level
    : false;
  if (!fighterA.belt_level || !fighterB.belt_level) warnings.push('rank_missing');

  const scoreBreakdown: CompatibilityScoreBreakdown = {
    weight: weightDifference === null ? 15 : differenceScore(weightDifference, settings.weight_tolerance_kg, 30),
    age: ageDifference === null ? 8 : differenceScore(ageDifference, settings.age_tolerance_years, 15),
    experience: differenceScore(experienceDifference, settings.experience_tolerance_fights, 25),
    rank: rankMatches ? 20 : (!fighterA.belt_level || !fighterB.belt_level ? 10 : 0),
    opponentHistory: recentPairKeys.has(pairKey) ? 0 : 10,
  };

  return {
    fighterA,
    fighterB,
    eligible: hardFailures.length === 0,
    hardFailures,
    warnings,
    totalScore: hardFailures.length === 0
      ? Object.values(scoreBreakdown).reduce((sum, score) => sum + score, 0)
      : 0,
    scoreBreakdown,
    ruleVersion: settings.rules_version,
  };
}

export async function getEventCompatibilityPool(
  eventId: string
): Promise<ServiceResponse<CompatibilityResult[]>> {
  const [settingsResult, registrationsResult, matchesResult, boutsResult] = await Promise.all([
    supabase.from('event_matchmaking_settings').select('*').eq('event_id', eventId).maybeSingle(),
    supabase
      .from('event_registrations')
      .select('*, fighters(id, weight_class, disciplines, photo_url, profiles(full_name, city, date_of_birth))')
      .eq('event_id', eventId),
    supabase
      .from('matches')
      .select('fighter_a_id, fighter_b_id, match_status, created_at')
      .eq('event_id', eventId),
    supabase
      .from('bouts')
      .select('fighter_a_id, fighter_b_id, status')
      .eq('event_id', eventId)
      .not('status', 'in', '(cancelled,no_show)'),
  ]);

  const error = settingsResult.error || registrationsResult.error || matchesResult.error || boutsResult.error;
  if (error) return { data: null, error: error.message };

  const settings: MatchmakingSettings = {
    ...DEFAULT_SETTINGS,
    ...(settingsResult.data ?? {}),
    event_id: eventId,
  };
  const registrations = (registrationsResult.data ?? []) as RegistrationWithFighter[];
  const assigned = new Set<string>();
  for (const bout of boutsResult.data ?? []) {
    assigned.add(bout.fighter_a_id);
    assigned.add(bout.fighter_b_id);
  }

  const lookbackStart = Date.now() - settings.recent_opponent_lookback_days * 86_400_000;
  const recentPairs = new Set<string>();
  for (const match of matchesResult.data ?? []) {
    if (match.match_status === 'cancelled') continue;
    if (new Date(match.created_at).getTime() < lookbackStart) continue;
    recentPairs.add([match.fighter_a_id, match.fighter_b_id].sort().join(':'));
  }

  const results: CompatibilityResult[] = [];
  for (let a = 0; a < registrations.length; a += 1) {
    for (let b = a + 1; b < registrations.length; b += 1) {
      results.push(calculateCompatibility(registrations[a], registrations[b], settings, assigned, recentPairs));
    }
  }

  results.sort((left, right) => {
    if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
    return right.totalScore - left.totalScore;
  });
  return { data: results, error: null };
}
