import { supabase } from '@/lib/supabaseClient';
import type { Event, EventStaff, EventStaffRole, Profile, ServiceResponse } from '@/types';

export type EventStaffFeature = 'settings' | 'matchmaking' | 'bouts' | 'print' | 'operation' | 'production';

const EVENT_STAFF_ERROR_KEYS = {
  loadFailed: 'events.engine.settings.errors.staffLoadFailed',
  addFailed: 'events.engine.settings.errors.staffAddFailed',
  removeFailed: 'events.engine.settings.errors.staffRemoveFailed',
  accountNotFound: 'events.engine.settings.errors.staffAccountNotFound',
  invalidRole: 'events.engine.settings.errors.staffInvalidRole',
  notAuthorized: 'events.engine.settings.errors.staffNotAuthorized',
};

function eventStaffErrorKey(message: string | undefined, fallback: string) {
  if (!message) return fallback;
  if (message.includes('event_staff_account_not_found')) return EVENT_STAFF_ERROR_KEYS.accountNotFound;
  if (message.includes('event_staff_invalid_role')) return EVENT_STAFF_ERROR_KEYS.invalidRole;
  if (message.includes('not_authorized') || message.includes('Not authorized')) return EVENT_STAFF_ERROR_KEYS.notAuthorized;
  return message;
}

export async function canOperateEvent(
  eventId: string,
  profile?: Profile | null,
  event?: Event | null
): Promise<boolean> {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (event && event.promoter_id === profile.id) return true;

  try {
    const { data, error } = await supabase.rpc('is_event_operator', { target_event_id: eventId });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function canAccessEventTools(
  eventId: string,
  profile?: Profile | null,
  event?: Event | null
): Promise<boolean> {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (event && event.promoter_id === profile.id) return true;

  try {
    const { data, error } = await supabase.rpc('is_event_staff_member', { target_event_id: eventId });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function canUseEventFeature(
  eventId: string,
  feature: EventStaffFeature,
  profile?: Profile | null,
  event?: Event | null
): Promise<boolean> {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (event && event.promoter_id === profile.id) return true;

  if (feature === 'settings') return false;

  const roleMap: Record<Exclude<EventStaffFeature, 'settings'>, EventStaffRole[]> = {
    matchmaking: ['manager'],
    bouts: ['manager'],
    print: ['manager'],
    operation: ['operator'],
    production: ['producer'],
  };

  try {
    const { data, error } = await supabase.rpc('has_event_staff_role', {
      target_event_id: eventId,
      allowed_roles: roleMap[feature],
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function canManageEventStaff(
  eventId: string,
  profile?: Profile | null,
  event?: Event | null
): Promise<boolean> {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (event && event.promoter_id === profile.id) return true;

  try {
    const { data, error } = await supabase.rpc('is_event_owner_or_admin', { target_event_id: eventId });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function getEventStaff(eventId: string): Promise<ServiceResponse<EventStaff[]>> {
  try {
    const { data, error } = await supabase
      .from('event_staff')
      .select('*, profiles:profile_id(full_name,email,role)')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: eventStaffErrorKey(error.message, EVENT_STAFF_ERROR_KEYS.loadFailed) };
    return { data: (data ?? []) as EventStaff[], error: null };
  } catch {
    return { data: null, error: EVENT_STAFF_ERROR_KEYS.loadFailed };
  }
}

export async function addEventStaffByEmail(
  eventId: string,
  email: string,
  staffRole: EventStaffRole = 'manager'
): Promise<ServiceResponse<EventStaff>> {
  try {
    const { data, error } = await supabase.rpc('add_event_staff_by_email', {
      target_event_id: eventId,
      staff_email: email,
      next_staff_role: staffRole,
    });

    if (error) return { data: null, error: eventStaffErrorKey(error.message, EVENT_STAFF_ERROR_KEYS.addFailed) };
    return { data: data as EventStaff, error: null };
  } catch {
    return { data: null, error: EVENT_STAFF_ERROR_KEYS.addFailed };
  }
}

export async function removeEventStaff(staffId: string): Promise<ServiceResponse<EventStaff>> {
  try {
    const { data, error } = await supabase.rpc('remove_event_staff', { staff_uuid: staffId });
    if (error) return { data: null, error: eventStaffErrorKey(error.message, EVENT_STAFF_ERROR_KEYS.removeFailed) };
    return { data: data as EventStaff, error: null };
  } catch {
    return { data: null, error: EVENT_STAFF_ERROR_KEYS.removeFailed };
  }
}
