/**
 * Registration Service — Manages event registrations & external payment tracking.
 *
 * Flow:
 *   Fighter registers → pending
 *   Fighter clicks "I've Paid" → submitted
 *   Promoter confirms → confirmed
 *
 * Only "confirmed" fighters are eligible for matchmaking.
 */

import { supabase } from '@/lib/supabaseClient';
import type { EventRegistration, RegistrationWithFighter, ServiceResponse } from '@/types';

// ── Fighter: Register for an event ──
export async function registerForEvent(
  eventId: string,
  fighterId: string
): Promise<ServiceResponse<EventRegistration>> {
  try {
    // Check for existing registration (prevent duplicates)
    const { data: existing } = await supabase
      .from('event_registrations')
      .select('id, payment_status')
      .eq('event_id', eventId)
      .eq('fighter_id', fighterId)
      .maybeSingle();

    if (existing) {
      return { data: null, error: 'Ya estás registrado en este evento.' };
    }

    const { data, error } = await supabase.rpc('register_self_for_event', {
      target_event_id: eventId,
      target_fighter_id: fighterId,
    });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: 'Error al registrarse al evento.' };
  }
}

// ── Fighter: Submit payment ("I've Paid") ──
export async function submitPayment(
  registrationId: string
): Promise<ServiceResponse<EventRegistration>> {
  try {
    const { data, error } = await supabase.rpc('submit_event_registration_payment', {
      registration_uuid: registrationId,
    });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: 'Error al enviar confirmación de pago.' };
  }
}

// ── Promoter: Confirm payment ──
export async function confirmPayment(
  registrationId: string
): Promise<ServiceResponse<EventRegistration>> {
  try {
    const { data, error } = await supabase.rpc('confirm_event_registration_payment', {
      registration_uuid: registrationId,
    });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: 'Error al confirmar pago.' };
  }
}

// ── Get a fighter's registration for a specific event ──
export async function getFighterRegistration(
  eventId: string,
  fighterId: string
): Promise<ServiceResponse<EventRegistration>> {
  try {
    const { data, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .eq('fighter_id', fighterId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data ?? null, error: null };
  } catch {
    return { data: null, error: 'Error al verificar registro.' };
  }
}

// ── Promoter: Get all registrations for an event (with fighter details) ──
export async function getEventRegistrations(
  eventId: string
): Promise<ServiceResponse<RegistrationWithFighter[]>> {
  try {
    const { data, error } = await supabase
      .from('event_registrations')
      .select(`
        *,
        fighters(id, weight_class, disciplines, photo_url, profiles(full_name, city, date_of_birth)),
        manual_fighters:manual_fighter_id(*)
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as RegistrationWithFighter[], error: null };
  } catch {
    return { data: null, error: 'Error al cargar registros.' };
  }
}

// ── Get confirmed fighter IDs for an event (for matchmaking filter) ──
export async function getConfirmedFighterIds(
  eventId: string
): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('event_registrations')
      .select('fighter_id')
      .eq('event_id', eventId)
      .eq('payment_status', 'confirmed');

    return (data ?? []).map((r) => r.fighter_id);
  } catch {
    return [];
  }
}
