import { supabase } from '@/lib/supabaseClient';
import type { FighterFollowWithFighter, ServiceResponse } from '@/types';

export const fighterFollowService = {
  async getFollowerCounts(fighterIds: string[]): Promise<ServiceResponse<Record<string, number>>> {
    try {
      const uniqueIds = Array.from(new Set(fighterIds.filter(Boolean)));
      if (uniqueIds.length === 0) return { data: {}, error: null };

      const { data, error } = await supabase
        .rpc('get_fighter_follower_counts', { target_fighter_ids: uniqueIds });

      if (error) return { data: null, error: error.message };

      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { fighter_id: string; followers_count: number | string }[]) {
        counts[row.fighter_id] = Number(row.followers_count) || 0;
      }

      return { data: counts, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async listForSpectator(spectatorProfileId: string): Promise<ServiceResponse<FighterFollowWithFighter[]>> {
    try {
      const { data, error } = await supabase
        .from('fighter_follows')
        .select(`
          *,
          fighters:fighter_id (
            *,
            profiles:profile_id (
              full_name,
              city,
              date_of_birth,
              reliability_score,
              total_matches,
              cancellations,
              no_shows
            )
          )
        `)
        .eq('spectator_profile_id', spectatorProfileId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as unknown as FighterFollowWithFighter[], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async isFollowing(spectatorProfileId: string, fighterId: string): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .from('fighter_follows')
        .select('id')
        .eq('spectator_profile_id', spectatorProfileId)
        .eq('fighter_id', fighterId)
        .maybeSingle();

      if (error) return { data: null, error: error.message };
      return { data: !!data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async follow(spectatorProfileId: string, fighterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('fighter_follows')
        .upsert(
          {
            spectator_profile_id: spectatorProfileId,
            fighter_id: fighterId,
          },
          { onConflict: 'spectator_profile_id,fighter_id' }
        );

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async unfollow(spectatorProfileId: string, fighterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('fighter_follows')
        .delete()
        .eq('spectator_profile_id', spectatorProfileId)
        .eq('fighter_id', fighterId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
