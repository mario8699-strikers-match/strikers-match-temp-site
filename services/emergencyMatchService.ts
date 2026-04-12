/**
 * Emergency Match Service — Fast replacement finder for events.
 *
 * Priority-based scoring (different from standard matchmaking):
 *   Short Notice Ready:  0–40 pts  (highest priority)
 *   Availability:        0–30 pts
 *   Weight Match:        0–20 pts
 *   Location:            0–10 pts
 *
 * Target execution: <200ms
 */

import { supabase } from '@/lib/supabaseClient';
import type { FighterWithProfile, EmergencyMatchResult, ServiceResponse } from '@/types';

// ── Weight class order for neighbor matching ──
const WEIGHT_ORDER = [
  'minimosca', 'mosca', 'supermosca', 'gallo', 'supergallo',
  'pluma', 'superpluma', 'ligero', 'superligero', 'welter',
  'superwelter', 'medio', 'supermedio', 'semipesado', 'crucero', 'pesado',
];

interface EmergencyEvent {
  weight_class_needed?: string | null;
  weight_classes_needed?: string[];
  city?: string | null;
  event_date?: string | null;
}

function getWeightNeighbors(wc: string): string[] {
  const idx = WEIGHT_ORDER.indexOf(wc);
  if (idx === -1) return [];
  const out: string[] = [];
  if (idx > 0) out.push(WEIGHT_ORDER[idx - 1]);
  if (idx < WEIGHT_ORDER.length - 1) out.push(WEIGHT_ORDER[idx + 1]);
  return out;
}

// ── Main: Find Emergency Replacements ─────────
export async function findEmergencyReplacements(
  event: EmergencyEvent
): Promise<{ data: EmergencyMatchResult[]; error: string | null; executionMs: number }> {
  const start = performance.now();

  try {
    // Pre-filter: available fighters, prefer short_notice_ready
    const { data: fighters, error } = await supabase
      .from('fighters')
      .select('*, profiles(full_name, city, is_banned)')
      .eq('is_available', true)
      .order('short_notice_ready', { ascending: false })
      .limit(100);

    if (error) {
      return { data: [], error: error.message, executionMs: performance.now() - start };
    }

    if (!fighters || fighters.length === 0) {
      return { data: [], error: null, executionMs: performance.now() - start };
    }

    // Build target weights
    const targetWeights: string[] = [];
    if (event.weight_classes_needed?.length) {
      targetWeights.push(...event.weight_classes_needed);
    } else if (event.weight_class_needed) {
      targetWeights.push(event.weight_class_needed);
    }

    // Score each fighter
    const results: EmergencyMatchResult[] = (fighters as FighterWithProfile[]).map((fighter) => {
      let score = 0;

      // 1) Short Notice Ready (0–40)
      if (fighter.short_notice_ready) score += 40;

      // 2) Availability (0–30)
      if (event.event_date) {
        const eventTime = new Date(event.event_date).getTime();
        const from = fighter.available_from ? new Date(fighter.available_from).getTime() : 0;
        const to = fighter.available_to ? new Date(fighter.available_to).getTime() : Infinity;

        if (eventTime >= from && eventTime <= to) {
          score += 30;
        } else {
          // Within +/- 2 days
          const twoDays = 2 * 24 * 60 * 60 * 1000;
          if (Math.abs(eventTime - from) <= twoDays || Math.abs(eventTime - to) <= twoDays) {
            score += 15;
          }
        }
      } else {
        score += 15; // No date specified, partial credit
      }

      // 3) Weight Match (0–20)
      if (fighter.weight_class && targetWeights.length > 0) {
        if (targetWeights.includes(fighter.weight_class)) {
          score += 20;
        } else {
          // Close match: neighbor class
          const isClose = targetWeights.some((tw) => getWeightNeighbors(tw).includes(fighter.weight_class!));
          if (isClose) score += 10;
        }
      }

      // 4) Location (0–10)
      if (event.city && fighter.profiles?.city) {
        if (fighter.profiles.city.toLowerCase().trim() === event.city.toLowerCase().trim()) {
          score += 10;
        } else if (fighter.state) {
          score += 5;
        }
      }

      return { fighter, emergency_score: score };
    });

    // Sort descending, take top 10
    results.sort((a, b) => b.emergency_score - a.emergency_score);
    const top10 = results.slice(0, 10);

    const executionMs = performance.now() - start;
    console.log(`[Emergency] Found ${top10.length} replacements in ${executionMs.toFixed(1)}ms`);

    return { data: top10, error: null, executionMs };
  } catch (err) {
    const executionMs = performance.now() - start;
    return { data: [], error: err instanceof Error ? err.message : 'Emergency match error', executionMs };
  }
}

// ── Quick Request: minimal-click fight request ──
export async function sendQuickRequest(
  fighterId: string,
  eventId: string,
  senderId: string
): Promise<ServiceResponse<{ id: string }>> {
  try {
    // Check for existing pending request to prevent duplicates
    const { data: existing } = await supabase
      .from('match_requests')
      .select('id')
      .eq('event_id', eventId)
      .eq('fighter_id', fighterId)
      .eq('sender_id', senderId)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existing) {
      return { data: null, error: 'Ya existe una solicitud para este peleador.' };
    }

    const { data, error } = await supabase
      .from('match_requests')
      .insert({
        event_id: eventId,
        fighter_id: fighterId,
        sender_id: senderId,
        status: 'pending',
        message: 'Reemplazo urgente necesario para evento proximo. Por favor confirma tu disponibilidad.',
      })
      .select('id')
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: 'Error al enviar solicitud rapida.' };
  }
}
