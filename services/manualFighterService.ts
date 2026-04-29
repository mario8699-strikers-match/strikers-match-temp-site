import { supabase } from '@/lib/supabaseClient';
import type { ManualFighter, ManualFighterWithCreator, ServiceResponse } from '@/types';

// Fields allowed on insert/update
export type ManualFighterInput = Omit<
  ManualFighter,
  'id' | 'manager_id' | 'created_at'
>;

export const manualFighterService = {
  // Public list — anyone can read (RLS allows public select).
  async getAllPublic(): Promise<ServiceResponse<ManualFighterWithCreator[]>> {
    try {
      const { data, error } = await supabase
        .from('manual_fighters')
        .select('*, profiles:manager_id(full_name, email, role)')
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data as ManualFighterWithCreator[]) ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  // Single manual fighter with creator info
  async getById(id: string): Promise<ServiceResponse<ManualFighterWithCreator>> {
    try {
      const { data, error } = await supabase
        .from('manual_fighters')
        .select('*, profiles:manager_id(full_name, email, role)')
        .eq('id', id)
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as ManualFighterWithCreator, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  // Fighters created by a given manager/promoter/admin
  async getByCreator(creatorId: string): Promise<ServiceResponse<ManualFighter[]>> {
    try {
      const { data, error } = await supabase
        .from('manual_fighters')
        .select('*')
        .eq('manager_id', creatorId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async add(
    creatorId: string,
    fighter: ManualFighterInput
  ): Promise<ServiceResponse<ManualFighter>> {
    try {
      const { data, error } = await supabase
        .from('manual_fighters')
        .insert({ manager_id: creatorId, ...fighter })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async update(
    id: string,
    patch: Partial<ManualFighterInput>
  ): Promise<ServiceResponse<ManualFighter>> {
    try {
      const { data, error } = await supabase
        .from('manual_fighters')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async remove(id: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('manual_fighters')
        .delete()
        .eq('id', id);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
