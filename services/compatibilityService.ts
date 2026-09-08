import { supabase } from '@/lib/supabaseClient';
import type {
  MatchSuggestion,
  MatchSuggestionStatus,
  RegistrationWithFighter,
  ServiceResponse,
} from '@/types';

export interface CompatibilityScoreBreakdown {
  weight: number;
  age: number;
  experience: number;
  record: number;
  knockout: number;
  skill: number;
  opponentHistory: number;
  location: number;
  availability: number;
  [key: string]: number;
}

export interface CompatibilityResult extends MatchSuggestion {
  fighterA: RegistrationWithFighter;
  fighterB: RegistrationWithFighter;
  eligible: boolean;
  totalScore: number;
  scoreBreakdown: CompatibilityScoreBreakdown;
  hardFailures: string[];
  ruleVersion: number;
}

const PARTICIPANT_JOIN = `
  *,
  fighters (
    id,
    weight_class,
    disciplines,
    photo_url,
    profiles ( full_name, city, date_of_birth )
  ),
  manual_fighters:manual_fighter_id (*)
`;

const SUGGESTION_SELECT = `
  *,
  fighter_a_registration:fighter_a_registration_id (${PARTICIPANT_JOIN}),
  fighter_b_registration:fighter_b_registration_id (${PARTICIPANT_JOIN})
`;

type SuggestionRow = MatchSuggestion & {
  fighter_a_registration: RegistrationWithFighter;
  fighter_b_registration: RegistrationWithFighter;
};

function toCompatibilityResult(row: SuggestionRow): CompatibilityResult {
  return {
    ...row,
    fighterA: row.fighter_a_registration,
    fighterB: row.fighter_b_registration,
    eligible: row.is_eligible,
    totalScore: row.compatibility_score,
    scoreBreakdown: row.score_breakdown as CompatibilityScoreBreakdown,
    hardFailures: row.hard_failures,
    ruleVersion: row.rule_version,
  };
}

export async function getEventCompatibilityPool(
  eventId: string
): Promise<ServiceResponse<CompatibilityResult[]>> {
  const { data, error } = await supabase
    .from('match_suggestions')
    .select(SUGGESTION_SELECT)
    .eq('event_id', eventId)
    .neq('status', 'stale')
    .order('is_eligible', { ascending: false })
    .order('compatibility_score', { ascending: false });

  if (error) return { data: null, error: error.message };
  return {
    data: ((data ?? []) as unknown as SuggestionRow[]).map(toCompatibilityResult),
    error: null,
  };
}

export async function regenerateEventMatchSuggestions(
  eventId: string
): Promise<ServiceResponse<number>> {
  const { data, error } = await supabase.rpc('regenerate_event_match_suggestions', {
    target_event_id: eventId,
  });
  if (error) return { data: null, error: error.message };
  return { data: Number(data ?? 0), error: null };
}

export async function reviewMatchSuggestion(
  suggestionId: string,
  action: 'reject' | 'request_changes' | 'lock' | 'restore',
  reason?: string
): Promise<ServiceResponse<MatchSuggestion>> {
  const { data, error } = await supabase.rpc('review_match_suggestion', {
    suggestion_uuid: suggestionId,
    review_action: action,
    reason: reason ?? null,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as MatchSuggestion, error: null };
}

export function participantName(registration: RegistrationWithFighter): string {
  return registration.display_name
    ?? registration.fighters?.profiles?.full_name
    ?? registration.manual_fighters?.full_name
    ?? '—';
}

export function participantPhoto(registration: RegistrationWithFighter): string | null {
  return registration.photo_url
    ?? registration.fighters?.photo_url
    ?? registration.manual_fighters?.photo_url
    ?? null;
}

export function suggestionIsVisible(status: MatchSuggestionStatus): boolean {
  return status !== 'stale' && status !== 'rejected';
}
