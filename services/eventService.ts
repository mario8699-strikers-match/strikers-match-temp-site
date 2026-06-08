import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/storageClient';
import type { Event, EventFormData, EventApplication, ServiceResponse } from '@/types';

export const eventService = {
  async uploadFlyer(file: File): Promise<ServiceResponse<string>> {
    try {
      const { data, error } = await uploadFile(file, 'flyers');
      if (error || !data) return { data: null, error: error ?? 'Failed to upload flyer.' };
      return { data: data.url, error: null };
    } catch {
      return { data: null, error: 'Failed to upload flyer.' };
    }
  },

  async getAll(): Promise<ServiceResponse<Event[]>> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, profiles(full_name)')
        .eq('status', 'published')
        .order('event_date', { ascending: true });
      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getById(id: string): Promise<ServiceResponse<Event>> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, profiles(full_name)')
        .eq('id', id)
        .single();
      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getByPromoter(promoterId: string): Promise<ServiceResponse<Event[]>> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('promoter_id', promoterId)
        .order('event_date', { ascending: true });
      if (error) return { data: null, error: error.message };
      return { data: data ?? [], error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async create(
    promoterId: string,
    formData: EventFormData,
    flyerUrl?: string | null
  ): Promise<ServiceResponse<Event>> {
    try {
      const payload = {
        promoter_id: promoterId,
        event_name: formData.event_name,
        event_date: formData.event_date || null,
        event_time: formData.event_time || null,
        city: formData.city || null,
        venue: formData.venue || null,
        weight_class_needed: formData.weight_class_needed || null,
        weight_classes_needed: formData.weight_classes_needed ?? [],
        disciplines_needed: formData.disciplines_needed ?? [],
        purse_amount: formData.purse_enabled && formData.purse_amount ? parseFloat(formData.purse_amount) : null,
        signup_fee: formData.signup_fee ? parseFloat(formData.signup_fee) : null,
        notes: formData.notes || null,
        status: formData.status,
        flyer_url: flyerUrl ?? null,
      };
      const { data, error } = await supabase.from('events').insert(payload).select().single();
      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async update(
    id: string,
    formData: Partial<EventFormData> & { flyer_url?: string | null }
  ): Promise<ServiceResponse<Event>> {
    try {
      const payload: Partial<Event> = {};
      if (formData.event_name !== undefined) payload.event_name = formData.event_name;
      if (formData.event_date !== undefined) payload.event_date = formData.event_date || null;
      if (formData.event_time !== undefined) payload.event_time = formData.event_time || null;
      if (formData.city !== undefined) payload.city = formData.city || null;
      if (formData.venue !== undefined) payload.venue = formData.venue || null;
      if (formData.weight_class_needed !== undefined) payload.weight_class_needed = formData.weight_class_needed || null;
      if (formData.weight_classes_needed !== undefined) payload.weight_classes_needed = formData.weight_classes_needed;
      if (formData.disciplines_needed !== undefined) payload.disciplines_needed = formData.disciplines_needed;
      if (formData.purse_amount !== undefined) payload.purse_amount = (formData.purse_enabled && formData.purse_amount) ? parseFloat(formData.purse_amount) : null;
      if (formData.signup_fee !== undefined) payload.signup_fee = formData.signup_fee ? parseFloat(formData.signup_fee) : null;
      if (formData.notes !== undefined) payload.notes = formData.notes || null;
      if (formData.status !== undefined) payload.status = formData.status;
      if (formData.flyer_url !== undefined) payload.flyer_url = formData.flyer_url ?? null;

      const { data, error } = await supabase.from('events').update(payload).eq('id', id).select().single();
      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async delete(id: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  // ── Applications ───────────────────────────────────────────────────────────

  async applyToEvent(
    eventId: string,
    fighterId: string,
    opts?: {
      message?: string;
      fighter_discipline?: string;
      fighter_weight_class?: string;
      jiu_jitsu_belt?: string;
      confirm_weight?: boolean;
      confirm_availability?: boolean;
      corner_name?: string;
    }
  ): Promise<ServiceResponse<EventApplication>> {
    try {
      const { data, error } = await supabase
        .from('event_applications')
        .insert({
          event_id: eventId,
          fighter_id: fighterId,
          message: opts?.message || null,
          fighter_discipline: opts?.fighter_discipline || null,
          fighter_weight_class: opts?.fighter_weight_class || null,
          jiu_jitsu_belt: opts?.jiu_jitsu_belt || null,
          confirm_weight: opts?.confirm_weight ?? false,
          confirm_availability: opts?.confirm_availability ?? false,
          corner_name: opts?.corner_name || null,
        })
        .select()
        .single();
      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async withdrawApplication(applicationId: string): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('event_applications')
        .update({ status: 'withdrawn' })
        .eq('id', applicationId);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getApplicationsForEvent(eventId: string): Promise<ServiceResponse<
    (EventApplication & {
      fighters: {
        profiles: { full_name: string; city: string | null };
        weight_class: string | null;
        disciplines: string[];
        photo_url: string | null;
      };
    })[]
  >> {
    try {
      const { data, error } = await supabase
        .from('event_applications')
        .select('*, fighters(weight_class, disciplines, photo_url, profiles(full_name, city))')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      if (error) return { data: null, error: error.message };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { data: (data ?? []) as any, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getMyApplications(fighterId: string): Promise<ServiceResponse<
    (EventApplication & {
      events: { event_name: string; event_date: string | null; city: string | null; promoter_id: string };
    })[]
  >> {
    try {
      const { data, error } = await supabase
        .from('event_applications')
        .select('*, events(event_name, event_date, city, promoter_id)')
        .eq('fighter_id', fighterId)
        .order('created_at', { ascending: false });
      if (error) return { data: null, error: error.message };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { data: (data ?? []) as any, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getMyApplicationForEvent(
    eventId: string,
    fighterId: string
  ): Promise<ServiceResponse<EventApplication | null>> {
    try {
      const { data, error } = await supabase
        .from('event_applications')
        .select('*')
        .eq('event_id', eventId)
        .eq('fighter_id', fighterId)
        .maybeSingle();
      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async updateApplicationStatus(
    applicationId: string,
    status: 'accepted' | 'declined'
  ): Promise<ServiceResponse<null>> {
    try {
      const { error } = await supabase
        .from('event_applications')
        .update({ status })
        .eq('id', applicationId);
      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch {
      return { data: null, error: 'An unexpected error occurred.' };
    }
  },

  async getApplicationCountsForPromoter(promoterId: string): Promise<Record<string, number>> {
    try {
      // Get all pending applications for events owned by this promoter
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('promoter_id', promoterId);
      const eventIds = (events ?? []).map((e: { id: string }) => e.id);
      if (eventIds.length === 0) return {};

      const { data } = await supabase
        .from('event_applications')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'pending');
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
      }
      return counts;
    } catch {
      return {};
    }
  },

  /**
   * Auto-complete published events whose date has passed.
   * Returns the number of events updated.
   */
  async autoCompletePastEvents(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const { data: pastEvents, error } = await supabase
        .from('events')
        .select('id')
        .eq('status', 'published')
        .lt('event_date', today)
        .not('event_date', 'is', null);
      if (error || !pastEvents || pastEvents.length === 0) return 0;

      const ids = pastEvents.map((e: { id: string }) => e.id);
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'completed' })
        .in('id', ids);
      if (updateError) return 0;
      return ids.length;
    } catch {
      return 0;
    }
  },
};
