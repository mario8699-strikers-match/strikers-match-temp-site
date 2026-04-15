import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/storageClient';
import type { Fighter, FighterSearchFilters, FighterSearchResult, ServiceResponse } from '@/types';

const PAGE_SIZE = 12;

export const fighterService = {
  /**
   * Get all fighters. Hidden fighters are always excluded.
   * Admins manage visibility through the admin panel only.
   */
  async getAll(): Promise<ServiceResponse<Fighter[]>> {
    try {
      const { data, error } = await supabase
        .from('fighters')
        .select('*, profiles(full_name, city)')
        .neq('is_hidden', true)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getById(id: string): Promise<ServiceResponse<Fighter>> {
    try {
      const { data, error } = await supabase
        .from('fighters')
        .select('*, profiles(full_name, city)')
        .eq('id', id)
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getByProfileId(profileId: string): Promise<ServiceResponse<Fighter>> {
    try {
      const { data, error } = await supabase
        .from('fighters')
        .select('*')
        .eq('profile_id', profileId)
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAvailable(): Promise<ServiceResponse<Fighter[]>> {
    try {
      const { data, error } = await supabase
        .from('fighters')
        .select('*, profiles(full_name, city)')
        .eq('is_available', true)
        .neq('is_hidden', true)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async search(filters: FighterSearchFilters): Promise<ServiceResponse<FighterSearchResult>> {
    try {
      const pageSize = filters.limit ?? PAGE_SIZE;
      const page = filters.page ?? 1;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('fighters')
        .select('*, profiles(full_name, city, is_banned)', { count: 'exact' });

      if (filters.weight_class) query = query.eq('weight_class', filters.weight_class);
      if (filters.city) query = query.ilike('profiles.city', `%${filters.city}%`);
      if (filters.short_notice_ready === true) query = query.eq('short_notice_ready', true);
      if (filters.is_available === true) query = query.eq('is_available', true);

      query = query.neq('is_hidden', true);

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) return { data: null, error: error.message };
      return { data: { fighters: data ?? [], count: count ?? 0 }, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async uploadPhoto(file: File): Promise<ServiceResponse<string>> {
    try {
      const { data, error } = await uploadFile(file, 'fighter-photos');
      if (error || !data) return { data: null, error: error ?? 'An unexpected error occurred.' };
      return { data: data.url, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async create(
    profileId: string,
    data: { weight_class?: string; discipline?: string; is_available?: boolean; short_notice_ready?: boolean }
  ): Promise<ServiceResponse<Fighter>> {
    try {
      const { data: row, error } = await supabase
        .from('fighters')
        .insert({ profile_id: profileId, ...data })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: row, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async update(
    id: string,
    updates: Partial<Omit<Fighter, 'id' | 'profile_id' | 'created_at'>>
  ): Promise<ServiceResponse<Fighter>> {
    try {
      const { data, error } = await supabase
        .from('fighters')
        .update(updates)
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
