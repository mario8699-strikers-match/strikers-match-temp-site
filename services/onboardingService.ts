import { supabase } from '@/lib/supabaseClient';
import type { Profile, ServiceResponse } from '@/types';

export type GuidedOnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface GuidedOnboardingUpdate {
  step?: number;
  eventId?: string | null;
  completed?: boolean;
  dismissed?: boolean;
}

export const GUIDED_ONBOARDING_EVENT = 'sm:guided-onboarding';

export async function updateGuidedOnboarding(
  update: GuidedOnboardingUpdate
): Promise<ServiceResponse<Profile>> {
  const { data, error } = await supabase.rpc('update_guided_onboarding', {
    next_step: update.step ?? null,
    next_event_id: update.eventId ?? null,
    next_completed: update.completed ?? null,
    next_dismissed: update.dismissed ?? null,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as Profile, error: null };
}

export async function advanceGuidedOnboarding(
  step: GuidedOnboardingStep,
  eventId?: string | null,
  open = true
): Promise<ServiceResponse<Profile>> {
  const result = await updateGuidedOnboarding({ step, eventId, dismissed: false });
  if (!result.error && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GUIDED_ONBOARDING_EVENT, {
      detail: { step, eventId: eventId ?? result.data?.onboarding_event_id ?? null, open },
    }));
  }
  return result;
}
