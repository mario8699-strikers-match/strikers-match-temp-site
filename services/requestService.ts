import { supabase } from '@/lib/supabaseClient';
import type { MatchRequest, ServiceResponse } from '@/types';

export const requestService = {
  async getByFighter(fighterId: string): Promise<ServiceResponse<MatchRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('match_requests')
        .select('*, events(title, event_date, city), profiles!sender_id(full_name)')
        .eq('fighter_id', fighterId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getByManualFighter(manualFighterId: string): Promise<ServiceResponse<MatchRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('match_requests')
        .select('*, events(title, event_date, city), profiles!sender_id(full_name)')
        .eq('manual_fighter_id', manualFighterId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getByEvent(eventId: string): Promise<ServiceResponse<MatchRequest[]>> {
    try {
      const { data, error } = await supabase
        .from('match_requests')
        .select('*, fighters(*, profiles(full_name, city))')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async create(
    request: Omit<MatchRequest, 'id' | 'created_at'>
  ): Promise<ServiceResponse<MatchRequest>> {
    try {
      const { data, error } = await supabase
        .from('match_requests')
        .insert(request)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async updateStatus(
    id: string,
    status: MatchRequest['status']
  ): Promise<ServiceResponse<MatchRequest>> {
    try {
      const { data, error } = await supabase
        .from('match_requests')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
