import { supabase } from '@/lib/supabaseClient';
import { isUuidIdentifier } from '@/lib/publicUrls';
import type { ManualFighter, ManualFighterWithCreator, ServiceResponse } from '@/types';

// Fields allowed on insert/update
export type ManualFighterInput = Pick<ManualFighter, 'full_name'> & Partial<Omit<
  ManualFighter,
  'id' | 'slug' | 'manager_id' | 'created_at' | 'updated_at' | 'full_name'
>>;

function isMissingDisciplinesColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === 'PGRST204'
    && (error.message ?? '').includes("'disciplines'")
    && (error.message ?? '').includes("'manual_fighters'");
}

function isMissingInstagramColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === 'PGRST204'
    && (error.message ?? '').includes("'instagram'")
    && (error.message ?? '').includes("'manual_fighters'");
}

function withoutDisciplines<T extends { discipline?: string | null; disciplines?: string[] }>(payload: T) {
  const { disciplines, ...legacyPayload } = payload;
  return {
    ...legacyPayload,
    discipline: legacyPayload.discipline ?? disciplines?.[0] ?? null,
  };
}

function withoutInstagram<T extends { instagram?: string | null }>(payload: T) {
  const { instagram, ...legacyPayload } = payload;
  void instagram;
  return legacyPayload;
}

export const manualFighterService = {
  // Public list — intentionally excludes private medical/contact fields.
  async getAllPublic(): Promise<ServiceResponse<ManualFighterWithCreator[]>> {
    try {
      const { data, error } = await supabase
        .from('public_manual_fighters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data as ManualFighterWithCreator[]) ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getPublicByCreator(creatorId: string): Promise<ServiceResponse<ManualFighterWithCreator[]>> {
    try {
      const { data, error } = await supabase
        .from('public_manual_fighters')
        .select('*')
        .eq('manager_id', creatorId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data as ManualFighterWithCreator[]) ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  // Single manual fighter with creator info
  async getById(identifier: string): Promise<ServiceResponse<ManualFighterWithCreator>> {
    try {
      const { data, error } = await supabase
        .from('public_manual_fighters')
        .select('*')
        .eq(isUuidIdentifier(identifier) ? 'id' : 'slug', identifier)
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as ManualFighterWithCreator, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  // Fighters created by a given manager/promoter/gym owner/admin
  async getByCreator(creatorId: string): Promise<ServiceResponse<ManualFighter[]>> {
    try {
      const { data, error } = await supabase
        .from('manual_fighters')
        .select('*')
        .eq('manager_id', creatorId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      const fighters = data ?? [];
      if (fighters.length === 0) return { data: [], error: null };

      const { data: travelPreferences, error: travelError } = await supabase
        .from('manual_fighter_travel_preferences')
        .select('manual_fighter_id, available_to_travel_internationally')
        .in('manual_fighter_id', fighters.map((fighter) => fighter.id));

      if (travelError) return { data: null, error: travelError.message };
      const travelByFighterId = new Map(
        (travelPreferences ?? []).map((preference) => [
          preference.manual_fighter_id,
          preference.available_to_travel_internationally,
        ]),
      );

      return {
        data: fighters.map((fighter) => ({
          ...fighter,
          available_to_travel_internationally: travelByFighterId.get(fighter.id) ?? false,
        })),
        error: null,
      };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async add(
    creatorId: string,
    fighter: ManualFighterInput
  ): Promise<ServiceResponse<ManualFighter>> {
    try {
      const payload = { manager_id: creatorId, ...fighter };
      let { data, error } = await supabase
        .from('manual_fighters')
        .insert(payload)
        .select()
        .single();

      // Keep roster creation functional while older production schemas are
      // upgraded. The singular discipline column has always existed, so no
      // fighter data is lost; only additional disciplines wait for migration.
      if (isMissingDisciplinesColumn(error)) {
        ({ data, error } = await supabase
          .from('manual_fighters')
          .insert(withoutDisciplines(payload))
          .select()
          .single());
      }

      if (isMissingInstagramColumn(error)) {
        ({ data, error } = await supabase
          .from('manual_fighters')
          .insert(withoutInstagram(payload))
          .select()
          .single());
      }

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
      let { data, error } = await supabase
        .from('manual_fighters')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (isMissingDisciplinesColumn(error)) {
        ({ data, error } = await supabase
          .from('manual_fighters')
          .update(withoutDisciplines(patch))
          .eq('id', id)
          .select()
          .single());
      }

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async updateTravelPreference(
    manualFighterId: string,
    availableToTravelInternationally: boolean,
  ): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('manual_fighter_travel_preferences')
        .upsert({
          manual_fighter_id: manualFighterId,
          available_to_travel_internationally: availableToTravelInternationally,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'manual_fighter_id' });

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
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
