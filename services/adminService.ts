import { supabase } from '@/lib/supabaseClient';
import type { Profile, FighterWithProfile, ManualFighterWithCreator, Event, ServiceResponse } from '@/types';

export interface AdminStats {
  totalUsers: number;
  totalFighters: number;
  totalEvents: number;
  pendingVerifications: number;
}

export const adminService = {
  async getStats(): Promise<ServiceResponse<AdminStats>> {
    try {
      const [usersRes, fightersRes, eventsRes, pendingRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('fighters').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('fighters').select('id', { count: 'exact', head: true }).eq('verified', false),
      ]);

      return {
        data: {
          totalUsers: usersRes.count ?? 0,
          totalFighters: fightersRes.count ?? 0,
          totalEvents: eventsRes.count ?? 0,
          pendingVerifications: pendingRes.count ?? 0,
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
        .order('created_at', { ascending: false });

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
        .order('created_at', { ascending: false });

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
        .order('full_name', { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getAllManualFighters(): Promise<ServiceResponse<ManualFighterWithCreator[]>> {
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

  async getAllEvents(): Promise<ServiceResponse<(Event & { profiles: { full_name: string } })[]>> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, profiles(full_name)')
        .order('event_date', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
