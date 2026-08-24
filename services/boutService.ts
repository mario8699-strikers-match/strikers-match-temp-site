import { supabase } from '@/lib/supabaseClient';
import type { Bout, EventMat, ServiceResponse } from '@/types';

export async function approveMatchAsBout(matchId: string): Promise<ServiceResponse<Bout>> {
  const { data, error } = await supabase.rpc('approve_confirmed_match_as_bout', {
    match_uuid: matchId,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as Bout, error: null };
}

export async function getBoutsForEvent(eventId: string): Promise<ServiceResponse<Bout[]>> {
  const { data, error } = await supabase
    .from('bouts')
    .select(`
      *,
      fighter_a:fighter_a_id (
        id,
        photo_url,
        exact_weight,
        weight_class,
        record_wins,
        record_losses,
        record_draws,
        gym_name,
        profiles ( full_name, city )
      ),
      fighter_b:fighter_b_id (
        id,
        photo_url,
        exact_weight,
        weight_class,
        record_wins,
        record_losses,
        record_draws,
        gym_name,
        profiles ( full_name, city )
      )
    `)
    .eq('event_id', eventId)
    .order('bout_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as Bout[], error: null };
}

export async function getMatsForEvent(eventId: string): Promise<ServiceResponse<EventMat[]>> {
  const { data, error } = await supabase
    .from('event_mats')
    .select('*')
    .eq('event_id', eventId)
    .order('mat_number');
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as EventMat[], error: null };
}

export async function createEventMat(
  eventId: string,
  name: string,
  matNumber: number
): Promise<ServiceResponse<EventMat>> {
  const { data, error } = await supabase.from('event_mats').insert({
    event_id: eventId,
    name,
    mat_number: matNumber,
  }).select().single();
  if (error) return { data: null, error: error.message };
  return { data: data as EventMat, error: null };
}

export async function generateBoutOrder(eventId: string): Promise<ServiceResponse<Bout[]>> {
  const { data, error } = await supabase.rpc('generate_event_bout_order', {
    target_event_id: eventId,
  });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as Bout[], error: null };
}

export interface BoutOperation {
  status?: Bout['status'];
  matId?: string;
  matOrder?: number;
  scheduledTime?: string;
  winnerId?: string;
  method?: string;
  elapsedSeconds?: number;
  reason?: string;
}

export async function updateBoutOperation(
  boutId: string,
  operation: BoutOperation
): Promise<ServiceResponse<Bout>> {
  const { data, error } = await supabase.rpc('update_bout_operation', {
    bout_uuid: boutId,
    next_status: operation.status ?? null,
    next_mat_id: operation.matId ?? null,
    next_mat_order: operation.matOrder ?? null,
    next_scheduled_time: operation.scheduledTime ?? null,
    next_winner_id: operation.winnerId ?? null,
    next_method: operation.method ?? null,
    next_elapsed_seconds: operation.elapsedSeconds ?? null,
    operation_reason: operation.reason ?? null,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as Bout, error: null };
}

export async function replaceBoutFighter(
  boutId: string,
  side: 'a' | 'b',
  replacementRegistrationId: string,
  reason?: string
): Promise<ServiceResponse<Bout>> {
  const { data, error } = await supabase.rpc('replace_bout_fighter', {
    bout_uuid: boutId,
    replacement_side: side,
    replacement_registration_uuid: replacementRegistrationId,
    operation_reason: reason ?? null,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as Bout, error: null };
}
