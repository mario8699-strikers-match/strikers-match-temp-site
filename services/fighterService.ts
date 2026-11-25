import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/storageClient';
import { isUuidIdentifier } from '@/lib/publicUrls';
import type { Fighter, FighterDisciplineRecord, FighterSearchFilters, FighterSearchResult, ServiceResponse } from '@/types';

const PAGE_SIZE = 12;

async function attachDisciplineRecords(fighters: Fighter[]) {
  if (fighters.length === 0) return fighters;
  const { data, error } = await supabase
    .from('fighter_discipline_records')
    .select('*')
    .in('fighter_id', fighters.map((fighter) => fighter.id))
    .order('discipline');
  if (error) return fighters;
  const recordsByFighter = new Map<string, FighterDisciplineRecord[]>();
  for (const record of (data ?? []) as FighterDisciplineRecord[]) {
    if (!record.fighter_id) continue;
    const existing = recordsByFighter.get(record.fighter_id) ?? [];
    existing.push(record);
    recordsByFighter.set(record.fighter_id, existing);
  }
  return fighters.map((fighter) => ({
    ...fighter,
    discipline_records: recordsByFighter.get(fighter.id) ?? [],
  }));
}

export const fighterService = {
  /**
   * Get all fighters. Hidden fighters are always excluded.
   * Admins manage visibility through the admin panel only.
   */
  async getAll(): Promise<ServiceResponse<Fighter[]>> {
    try {
      const { data, error } = await supabase
        .from('public_fighters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: await attachDisciplineRecords((data ?? []) as Fighter[]), error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getById(identifier: string): Promise<ServiceResponse<Fighter>> {
    try {
      const { data, error } = await supabase
        .from('public_fighters')
        .select('*')
        .eq(isUuidIdentifier(identifier) ? 'id' : 'slug', identifier)
        .single();

      if (error) return { data: null, error: error.message };
      const [fighter] = await attachDisciplineRecords([data as Fighter]);
      return { data: fighter, error: null };
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
      const { data: travelPreference, error: travelError } = await supabase
        .from('fighter_travel_preferences')
        .select('available_to_travel_internationally')
        .eq('fighter_id', data.id)
        .maybeSingle();

      if (travelError) return { data: null, error: travelError.message };
      const [fighterWithRecords] = await attachDisciplineRecords([{
          ...data,
          available_to_travel_internationally:
            travelPreference?.available_to_travel_internationally ?? false,
        } as Fighter]);
      return { data: fighterWithRecords, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAvailable(): Promise<ServiceResponse<Fighter[]>> {
    try {
      const { data, error } = await supabase
        .from('public_fighters')
        .select('*')
        .eq('is_available', true)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: await attachDisciplineRecords((data ?? []) as Fighter[]), error: null };
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
        .from('public_fighters')
        .select('*', { count: 'exact' });

      if (filters.manager_id) {
        const { data: rosterRows, error: rosterError } = await supabase
          .rpc('get_public_manager_fighter_ids', { target_manager_id: filters.manager_id });

        if (rosterError) return { data: null, error: rosterError.message };

        const fighterIds = ((rosterRows ?? []) as { fighter_id: string | null }[])
          .map((row) => row.fighter_id)
          .filter((fighterId): fighterId is string => Boolean(fighterId));

        if (fighterIds.length === 0) {
          return { data: { fighters: [], count: 0 }, error: null };
        }

        query = query.in('id', fighterIds);
      }

      if (filters.weight_class) query = query.eq('weight_class', filters.weight_class);
      if (filters.city) query = query.ilike('profile_city', `%${filters.city}%`);
      if (filters.short_notice_ready === true) query = query.eq('short_notice_ready', true);
      if (filters.is_available === true) query = query.eq('is_available', true);

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
    data: Partial<Omit<Fighter, 'id' | 'profile_id' | 'created_at' | 'verified' | 'is_hidden'>>
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

  async updateTravelPreference(
    fighterId: string,
    availableToTravelInternationally: boolean,
  ): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('fighter_travel_preferences')
        .upsert({
          fighter_id: fighterId,
          available_to_travel_internationally: availableToTravelInternationally,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'fighter_id' });

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async replaceDisciplineRecords(
    fighterId: string,
    records: Array<{ discipline: string; wins: number; losses: number; draws: number }>,
  ): Promise<ServiceResponse<FighterDisciplineRecord[]>> {
    try {
      if (records.length > 0) {
        const { error: upsertError } = await supabase
          .from('fighter_discipline_records')
          .upsert(
            records.map((record) => ({ ...record, fighter_id: fighterId, manual_fighter_id: null })),
            { onConflict: 'fighter_id,discipline' },
          );
        if (upsertError) return { data: null, error: upsertError.message };
      }

      const { data: existing, error: existingError } = await supabase
        .from('fighter_discipline_records')
        .select('id, discipline')
        .eq('fighter_id', fighterId);
      if (existingError) return { data: null, error: existingError.message };
      const retained = new Set(records.map((record) => record.discipline.toLocaleLowerCase()));
      const staleIds = (existing ?? [])
        .filter((record) => !retained.has(String(record.discipline).toLocaleLowerCase()))
        .map((record) => record.id);
      if (staleIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('fighter_discipline_records')
          .delete()
          .in('id', staleIds);
        if (deleteError) return { data: null, error: deleteError.message };
      }

      const { data, error } = await supabase
        .from('fighter_discipline_records')
        .select('*')
        .eq('fighter_id', fighterId)
        .order('discipline');
      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as FighterDisciplineRecord[], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
