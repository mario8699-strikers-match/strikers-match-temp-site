import { supabase } from '@/lib/supabaseClient';
import type { EventRegistration, ServiceResponse } from '@/types';

export interface EventParticipantHistoryItem {
  bout_id: string;
  event_id: string;
  event_name: string;
  event_date: string | null;
  opponent_name: string;
  bout_status: string;
  scheduled_time: string | null;
  result: string | null;
}

export interface EventParticipantPayload {
  full_name?: string;
  nickname?: string;
  photo_url?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  country?: string;
  date_of_birth?: string;
  gender_division?: string;
  weight_class?: string;
  exact_weight?: number;
  requested_weight_kg?: number;
  acceptable_weight_min_kg?: number;
  acceptable_weight_max_kg?: number;
  discipline?: string;
  ruleset?: string;
  preferred_rulesets?: string[];
  bout_format?: string;
  experience_level?: 'amateur' | 'pro';
  skill_rating?: number;
  record_wins?: number;
  record_losses?: number;
  record_draws?: number;
  ko_wins?: number;
  tko_wins?: number;
  ko_losses?: number;
  tko_losses?: number;
  gym_name?: string;
  special_restrictions?: string[];
  available_from?: string;
  available_to?: string;
  medical_clearance_date?: string;
  last_fight_at?: string;
  last_ko_loss_at?: string;
  is_available?: boolean;
  payment_status?: EventRegistration['payment_status'];
  availability_confirmed?: boolean;
  weight_confirmed?: boolean;
  representative_confirmed: boolean;
  representative_confirmation_note?: string;
  minor_consent_confirmed?: boolean;
}

export async function createManualEventParticipant(
  eventId: string,
  payload: EventParticipantPayload,
  publishToRoster: boolean
): Promise<ServiceResponse<EventRegistration>> {
  const { data, error } = await supabase.rpc('create_manual_event_registration', {
    target_event_id: eventId,
    fighter_payload: payload,
    publish_to_roster: publishToRoster,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as EventRegistration, error: null };
}

export async function registerRosterParticipant(
  eventId: string,
  manualFighterId: string,
  payload: EventParticipantPayload
): Promise<ServiceResponse<EventRegistration>> {
  const { data, error } = await supabase.rpc('register_manual_fighter_for_event', {
    target_event_id: eventId,
    target_manual_fighter_id: manualFighterId,
    registration_payload: payload,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as EventRegistration, error: null };
}

export async function registerPlatformParticipant(
  eventId: string,
  fighterId: string,
  payload: EventParticipantPayload
): Promise<ServiceResponse<EventRegistration>> {
  const { data, error } = await supabase.rpc('register_platform_fighter_for_event', {
    target_event_id: eventId,
    target_fighter_id: fighterId,
    registration_payload: payload,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as EventRegistration, error: null };
}

export async function updateEventParticipant(
  registrationId: string,
  patch: Partial<EventRegistration>
): Promise<ServiceResponse<EventRegistration>> {
  const protectedFields = new Set([
    'id', 'event_id', 'fighter_id', 'manual_fighter_id', 'application_id',
    'created_at', 'created_by', 'eligibility_status', 'eligibility_reasons',
    'eligibility_evaluated_at', 'eligibility_rule_version',
    'representative_confirmed_by',
  ]);
  const safePatch = Object.fromEntries(
    Object.entries(patch).filter(([key]) => !protectedFields.has(key))
  );
  if (patch.representative_confirmed_at) {
    const { data: authData } = await supabase.auth.getUser();
    safePatch.representative_confirmed_by = authData.user?.id ?? null;
  }
  const { data, error } = await supabase
    .from('event_registrations')
    .update(safePatch)
    .eq('id', registrationId)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as EventRegistration, error: null };
}

export async function removeEventParticipant(
  registrationId: string
): Promise<ServiceResponse<null>> {
  const { error } = await supabase
    .from('event_registrations')
    .delete()
    .eq('id', registrationId);
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

export async function getEventParticipantHistory(
  registrationId: string
): Promise<ServiceResponse<EventParticipantHistoryItem[]>> {
  const { data, error } = await supabase.rpc('get_event_registration_opponent_history', {
    registration_uuid: registrationId,
  });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as EventParticipantHistoryItem[], error: null };
}
