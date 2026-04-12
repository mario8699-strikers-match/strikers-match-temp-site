import { supabase } from '@/lib/supabaseClient';
import type { ManagerFighter, Fighter, ServiceResponse } from '@/types';

type FighterWithProfile = Fighter & { profiles: { full_name: string; city: string | null } };

export const managerService = {
  async getRoster(managerId: string): Promise<ServiceResponse<FighterWithProfile[]>> {
    try {
      const { data, error } = await supabase
        .from('manager_fighters')
        .select('fighter_id, fighters(*, profiles(full_name, city))')
        .eq('manager_id', managerId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      const fighters = (data ?? []).map((row: { fighters: unknown }) => row.fighters) as FighterWithProfile[];
      return { data: fighters, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async addFighter(managerId: string, fighterId: string): Promise<ServiceResponse<ManagerFighter>> {
    try {
      const { data, error } = await supabase
        .from('manager_fighters')
        .insert({ manager_id: managerId, fighter_id: fighterId })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async removeFighter(managerId: string, fighterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('manager_fighters')
        .delete()
        .eq('manager_id', managerId)
        .eq('fighter_id', fighterId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async searchFighters(query: string): Promise<ServiceResponse<FighterWithProfile[]>> {
    try {
      const { data, error } = await supabase
        .from('fighters')
        .select('*, profiles(full_name, city)')
        .ilike('profiles.full_name', `%${query}%`)
        .limit(10);

      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as FighterWithProfile[], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
