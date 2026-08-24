import { supabase } from '@/lib/supabaseClient';
import type { EventDivision, EventMatchmakingSettings, ServiceResponse } from '@/types';

export type EventSettingsInput = Pick<
  EventMatchmakingSettings,
  | 'weight_tolerance_kg'
  | 'age_tolerance_years'
  | 'experience_tolerance_fights'
  | 'allow_same_team'
  | 'recent_opponent_lookback_days'
  | 'max_bouts_per_fighter'
  | 'minimum_rest_minutes'
  | 'rules_version'
  | 'registration_closes_at'
>;

export type EventDivisionInput = Omit<
  EventDivision,
  'id' | 'event_id' | 'created_at' | 'updated_at'
>;

export const DEFAULT_EVENT_SETTINGS: EventSettingsInput = {
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

export const DEFAULT_DIVISION_INPUT: EventDivisionInput = {
  name: '',
  discipline: '',
  ruleset: '',
  bout_format: '',
  weight_class: '',
  minimum_weight_kg: null,
  maximum_weight_kg: null,
  age_class: '',
  minimum_age: null,
  maximum_age: null,
  gender_division: '',
  belt_level: '',
  experience_level: '',
  is_active: true,
  sort_order: 0,
};

export async function getEventMatchmakingSettings(
  eventId: string
): Promise<ServiceResponse<EventMatchmakingSettings>> {
  const { data, error } = await supabase
    .from('event_matchmaking_settings')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };

  return {
    data: {
      ...DEFAULT_EVENT_SETTINGS,
      ...(data ?? {}),
      event_id: eventId,
      created_at: data?.created_at ?? new Date().toISOString(),
      updated_at: data?.updated_at ?? new Date().toISOString(),
    } as EventMatchmakingSettings,
    error: null,
  };
}

export async function saveEventMatchmakingSettings(
  eventId: string,
  settings: EventSettingsInput
): Promise<ServiceResponse<EventMatchmakingSettings>> {
  const { data, error } = await supabase
    .from('event_matchmaking_settings')
    .upsert({
      event_id: eventId,
      ...settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as EventMatchmakingSettings, error: null };
}

export async function getEventDivisions(
  eventId: string
): Promise<ServiceResponse<EventDivision[]>> {
  const { data, error } = await supabase
    .from('event_divisions')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as EventDivision[], error: null };
}

export async function createEventDivision(
  eventId: string,
  division: EventDivisionInput
): Promise<ServiceResponse<EventDivision>> {
  const { data, error } = await supabase
    .from('event_divisions')
    .insert({ event_id: eventId, ...division })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as EventDivision, error: null };
}

export async function updateEventDivision(
  divisionId: string,
  division: EventDivisionInput
): Promise<ServiceResponse<EventDivision>> {
  const { data, error } = await supabase
    .from('event_divisions')
    .update({ ...division, updated_at: new Date().toISOString() })
    .eq('id', divisionId)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as EventDivision, error: null };
}

export async function deleteEventDivision(divisionId: string): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from('event_divisions')
    .delete()
    .eq('id', divisionId);

  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}
