import { supabase } from '@/lib/supabaseClient';
import type { Profile, FighterWithProfile, ManualFighterWithCreator, Event, Bout, ServiceResponse, PromoterFederationStatus } from '@/types';
import type { MatchWithContext } from '@/services/matchService';

export interface AdminStats {
  totalUsers: number;
  totalFighters: number;
  totalEvents: number;
  pendingVerifications: number;
  totalMatches: number;
  totalBouts: number;
}

const ADMIN_LIST_LIMIT = 200;

export const adminService = {
  async getStats(): Promise<ServiceResponse<AdminStats>> {
    try {
      const [usersRes, fightersRes, eventsRes, pendingRes, matchesRes, boutsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'estimated', head: true }),
        supabase.from('fighters').select('id', { count: 'estimated', head: true }),
        supabase.from('events').select('id', { count: 'estimated', head: true }),
        supabase.from('fighters').select('id', { count: 'estimated', head: true }).eq('verified', false),
        supabase.from('matches').select('id', { count: 'estimated', head: true }),
        supabase.from('bouts').select('id', { count: 'estimated', head: true }),
      ]);

      return {
        data: {
          totalUsers: usersRes.count ?? 0,
          totalFighters: fightersRes.count ?? 0,
          totalEvents: eventsRes.count ?? 0,
          pendingVerifications: pendingRes.count ?? 0,
          totalMatches: matchesRes.count ?? 0,
          totalBouts: boutsRes.count ?? 0,
        },
        error: null,
      };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAllUsers(): Promise<ServiceResponse<Profile[]>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(ADMIN_LIST_LIMIT);

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async banUser(userId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', userId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async unbanUser(userId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: false })
        .eq('id', userId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAllFighters(): Promise<ServiceResponse<FighterWithProfile[]>> {
    try {
      const { data, error } = await supabase
        .from('fighters')
        .select('*, profiles(full_name, email, city, phone, is_banned)')
        .order('created_at', { ascending: false })
        .limit(ADMIN_LIST_LIMIT);

      if (error) return { data: null, error: error.message };
      return { data: (data as FighterWithProfile[]) ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async verifyFighter(fighterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('fighters')
        .update({ verified: true })
        .eq('id', fighterId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async unverifyFighter(fighterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('fighters')
        .update({ verified: false })
        .eq('id', fighterId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async hideFighter(fighterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('fighters')
        .update({ is_hidden: true })
        .eq('id', fighterId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async unhideFighter(fighterId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('fighters')
        .update({ is_hidden: false })
        .eq('id', fighterId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getProfilesByRole(role: string): Promise<ServiceResponse<Profile[]>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', role)
        .order('full_name', { ascending: true })
        .limit(ADMIN_LIST_LIMIT);

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async updatePromoterFederationStatus(
    promoterId: string,
    status: PromoterFederationStatus
  ): Promise<ServiceResponse<Profile>> {
    try {
      const { data, error } = await supabase.rpc('admin_update_promoter_federation_status', {
        target_profile_id: promoterId,
        new_status: status,
      });

      if (error) return { data: null, error: error.message };
      return { data: data as Profile, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAllManualFighters(): Promise<ServiceResponse<ManualFighterWithCreator[]>> {
    try {
      const { data, error } = await supabase
        .from('manual_fighters')
        .select('*, profiles:manager_id(full_name, email, role)')
        .order('created_at', { ascending: false })
        .limit(ADMIN_LIST_LIMIT);

      if (error) return { data: null, error: error.message };
      return { data: (data as ManualFighterWithCreator[]) ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAllEvents(): Promise<ServiceResponse<(Event & { profiles: { full_name: string } })[]>> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, profiles(full_name)')
        .order('event_date', { ascending: false })
        .limit(ADMIN_LIST_LIMIT);

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAllMatches(): Promise<ServiceResponse<MatchWithContext[]>> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id, event_id, fighter_a_id, fighter_b_id, fighter_a_status, fighter_b_status,
          match_status, compatibility_score, created_at,
          events:event_id ( id, event_name, event_date, city ),
          fighter_a:fighter_a_id ( id, weight_class, profiles ( full_name, city ) ),
          fighter_b:fighter_b_id ( id, weight_class, profiles ( full_name, city ) )
        `)
        .order('created_at', { ascending: false })
        .limit(ADMIN_LIST_LIMIT);
      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as unknown as MatchWithContext[], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAllBouts(): Promise<ServiceResponse<(Bout & { events?: { id: string; event_name: string } | null; event_mats?: { name: string; mat_number: number } | null })[]>> {
    try {
      const { data, error } = await supabase
        .from('bouts')
        .select(`
          id, event_id, match_id, division_id, fighter_a_registration_id, fighter_b_registration_id,
          fighter_a_id, fighter_b_id, fighter_a_snapshot, fighter_b_snapshot, discipline, ruleset,
          bout_format, weight_class, age_class, belt_level, experience_level, mat_id, bout_number,
          mat_order, scheduled_time, status, winner_id, result, method, elapsed_seconds, notes,
          cancellation_reason, replacement_notes, approved_by, approved_at, completed_at, created_at, updated_at,
          events:event_id(id, event_name),
          event_mats:mat_id(name, mat_number)
        `)
        .order('created_at', { ascending: false })
        .limit(ADMIN_LIST_LIMIT);
      if (error) return { data: null, error: error.message };
      return {
        data: (data ?? []) as unknown as (Bout & {
          events?: { id: string; event_name: string } | null;
          event_mats?: { name: string; mat_number: number } | null;
        })[],
        error: null,
      };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  /** System health check (admin only). */
  async getHealthChecks(): Promise<ServiceResponse<{ orphan_fighters: number; checked_at: string }>> {
    try {
      const { data, error } = await supabase.rpc('admin_health_checks');
      if (error) return { data: null, error: error.message };
      return { data: data as { orphan_fighters: number; checked_at: string }, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  /** Create missing fighters rows for orphan fighter profiles. Returns number inserted. */
  async healOrphanFighters(): Promise<ServiceResponse<number>> {
    try {
      const { data, error } = await supabase.rpc('admin_heal_orphan_fighters');
      if (error) return { data: null, error: error.message };
      return { data: (data as number) ?? 0, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
