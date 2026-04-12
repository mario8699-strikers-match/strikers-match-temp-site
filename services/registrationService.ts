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

    const { data, error } = await supabase
      .from('event_registrations')
      .insert({
        event_id: eventId,
        fighter_id: fighterId,
        payment_status: 'pending',
      })
      .select()
      .single();

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
    // Fetch current status to validate
    const { data: reg } = await supabase
      .from('event_registrations')
      .select('id, payment_status')
      .eq('id', registrationId)
      .single();

    if (!reg) return { data: null, error: 'Registro no encontrado.' };
    if (reg.payment_status !== 'pending') {
      return { data: null, error: 'El pago ya fue enviado o confirmado.' };
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .update({
        payment_status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single();

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
    // Fetch current status to validate
    const { data: reg } = await supabase
      .from('event_registrations')
      .select('id, payment_status')
      .eq('id', registrationId)
      .single();

    if (!reg) return { data: null, error: 'Registro no encontrado.' };
    if (reg.payment_status !== 'submitted') {
      return { data: null, error: 'Solo se puede confirmar un pago que haya sido enviado.' };
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .update({
        payment_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single();

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
      .select('*, fighters(id, weight_class, disciplines, photo_url, profiles(full_name, city))')
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
