import { supabase } from '@/lib/supabaseClient';
import type { SponsorshipOffer, Fighter, ServiceResponse } from '@/types';

type FighterWithProfile = Fighter & { profiles: { full_name: string; city: string | null } };

type OfferWithFighter = SponsorshipOffer & {
  fighters: { profile_id: string; weight_class: string | null; profiles: { full_name: string; city: string | null } };
};

export const sponsorService = {
  async getMyOffers(sponsorId: string): Promise<ServiceResponse<OfferWithFighter[]>> {
    try {
      const { data, error } = await supabase
        .from('sponsorship_offers')
        .select('*, fighters(profile_id, weight_class, photo_url, profiles(full_name, city))')
        .eq('sponsor_id', sponsorId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as OfferWithFighter[], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async sendOffer(offer: {
    sponsor_id: string;
    fighter_id: string;
    amount: number | null;
    message: string | null;
  }): Promise<ServiceResponse<SponsorshipOffer>> {
    try {
      const { data, error } = await supabase
        .from('sponsorship_offers')
        .insert({ ...offer, status: 'pending' })
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
    status: SponsorshipOffer['status']
  ): Promise<ServiceResponse<SponsorshipOffer>> {
    try {
      const { data, error } = await supabase
        .from('sponsorship_offers')
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

  async browseFighters(): Promise<ServiceResponse<FighterWithProfile[]>> {
    try {
      const { data, error } = await supabase
        .from('fighters')
        .select('*, profiles(full_name, city)')
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as FighterWithProfile[], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },
};
