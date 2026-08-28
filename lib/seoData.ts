import 'server-only';

import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  VENDOR_ROLES,
  type BusinessListing,
  type Event,
  type FighterWithProfile,
  type ManualFighterWithCreator,
  type Profile,
  type UserRole,
} from '@/types';

export interface PublicEventSeo extends Event {
  profiles: { full_name: string } | null;
}

export interface PublicFighterSeo {
  id: string;
  nickname: string | null;
  bio: string | null;
  weight_class: string | null;
  disciplines: string[] | null;
  gym_name: string | null;
  state: string | null;
  experience_level: string | null;
  photo_url: string | null;
  is_hidden: boolean | null;
  created_at: string;
  profiles: {
    full_name: string;
    city: string | null;
    is_banned: boolean | null;
  } | null;
}

export interface PublicManualFighterSeo {
  id: string;
  full_name: string;
  nickname: string | null;
  bio: string | null;
  weight_class: string | null;
  discipline: string | null;
  city: string | null;
  state: string | null;
  gym_name: string | null;
  experience_level: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface PublicProfessionalSeo {
  id: string;
  full_name: string;
  role: UserRole;
  additional_roles: UserRole[] | null;
  city: string | null;
  state: string | null;
  country: string | null;
  bio: string | null;
  photo_url: string | null;
  is_banned: boolean | null;
  updated_at: string;
}

interface SitemapRecord {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
}

export type PublicPromoterCard = Profile & { latestFlyer: string | null; eventCount: number };
export type PublicManagerCard = Profile & { rosterCount: number };

function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export const getPublicEventSeo = cache(async (id: string): Promise<PublicEventSeo | null> => {
  const client = getPublicClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('events')
      .select('id,promoter_id,event_name,event_date,event_time,city,venue,weight_class_needed,weight_classes_needed,disciplines_needed,purse_amount,signup_fee,notes,flyer_url,status,created_at,profiles(full_name)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as PublicEventSeo;
  } catch {
    return null;
  }
});

export const getPublicFighterSeo = cache(async (id: string): Promise<PublicFighterSeo | null> => {
  const client = getPublicClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('fighters')
      .select('id,nickname,bio,weight_class,disciplines,gym_name,state,experience_level,photo_url,is_hidden,created_at,profiles(full_name,city,is_banned)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as PublicFighterSeo;
  } catch {
    return null;
  }
});

export const getPublicManualFighterSeo = cache(async (id: string): Promise<PublicManualFighterSeo | null> => {
  const client = getPublicClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('manual_fighters')
      .select('id,full_name,nickname,bio,weight_class,discipline,city,state,gym_name,experience_level,photo_url,created_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data as PublicManualFighterSeo;
  } catch {
    return null;
  }
});

export const getPublicProfessionalSeo = cache(async (id: string): Promise<PublicProfessionalSeo | null> => {
  const client = getPublicClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('profiles')
      .select('id,full_name,role,additional_roles,city,state,country,bio,photo_url,is_banned,updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;

    const profile = data as PublicProfessionalSeo;
    const roles = [profile.role, ...(profile.additional_roles ?? [])];
    if (profile.is_banned || !roles.some((role) => VENDOR_ROLES.includes(role))) return null;
    return profile;
  } catch {
    return null;
  }
});

export const getPublicEventsForPage = cache(async (): Promise<Event[]> => {
  const client = getPublicClient();
  if (!client) return [];
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await client
      .from('events')
      .select('*')
      .eq('status', 'published')
      .or(`event_date.is.null,event_date.gte.${today}`)
      .order('event_date', { ascending: true });
    if (error) return [];
    return (data ?? []) as Event[];
  } catch {
    return [];
  }
});

export const getPublicFightersForPage = cache(async (): Promise<{
  registered: FighterWithProfile[];
  manual: ManualFighterWithCreator[];
}> => {
  const client = getPublicClient();
  if (!client) return { registered: [], manual: [] };
  try {
    const [registeredResult, manualResult] = await Promise.all([
      client
        .from('fighters')
        .select('*,profiles(full_name,email,city,date_of_birth,phone,is_banned,reliability_score,total_matches,cancellations,no_shows)')
        .neq('is_hidden', true)
        .order('created_at', { ascending: false }),
      client
        .from('manual_fighters')
        .select('*,profiles:manager_id(full_name,email,role)')
        .order('created_at', { ascending: false }),
    ]);

    return {
      registered: (registeredResult.data ?? []) as unknown as FighterWithProfile[],
      manual: (manualResult.data ?? []) as unknown as ManualFighterWithCreator[],
    };
  } catch {
    return { registered: [], manual: [] };
  }
});

export const getPublicDirectoryForPage = cache(async (): Promise<{
  listings: BusinessListing[];
  profiles: Profile[];
}> => {
  const client = getPublicClient();
  if (!client) return { listings: [], profiles: [] };
  try {
    const [listingResult, primaryResult, additionalResult] = await Promise.all([
      client
        .from('business_listings')
        .select('*')
        .eq('status', 'published')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false }),
      client.from('profiles').select('*').in('role', VENDOR_ROLES).eq('is_banned', false).order('created_at', { ascending: false }),
      client.from('profiles').select('*').overlaps('additional_roles', VENDOR_ROLES).eq('is_banned', false).order('created_at', { ascending: false }),
    ]);

    const profiles = new Map<string, Profile>();
    for (const profile of [...(primaryResult.data ?? []), ...(additionalResult.data ?? [])] as Profile[]) {
      profiles.set(profile.id, profile);
    }

    return {
      listings: (listingResult.data ?? []) as BusinessListing[],
      profiles: Array.from(profiles.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
  } catch {
    return { listings: [], profiles: [] };
  }
});

export const getPublicPromotersForPage = cache(async (): Promise<PublicPromoterCard[]> => {
  const client = getPublicClient();
  if (!client) return [];
  try {
    const [profileResult, eventResult] = await Promise.all([
      client.from('profiles').select('*').eq('role', 'promoter').eq('is_banned', false).order('full_name'),
      client.from('events').select('promoter_id,flyer_url,event_date').eq('status', 'published').order('event_date', { ascending: false }),
    ]);
    if (profileResult.error) return [];

    const flyerMap = new Map<string, string>();
    const countMap = new Map<string, number>();
    for (const event of eventResult.data ?? []) {
      countMap.set(event.promoter_id, (countMap.get(event.promoter_id) ?? 0) + 1);
      if (event.flyer_url && !flyerMap.has(event.promoter_id)) flyerMap.set(event.promoter_id, event.flyer_url);
    }

    return ((profileResult.data ?? []) as Profile[]).map((profile) => ({
      ...profile,
      latestFlyer: flyerMap.get(profile.id) ?? null,
      eventCount: countMap.get(profile.id) ?? 0,
    }));
  } catch {
    return [];
  }
});

export const getPublicManagersForPage = cache(async (): Promise<PublicManagerCard[]> => {
  const client = getPublicClient();
  if (!client) return [];
  try {
    const [profileResult, rosterResult] = await Promise.all([
      client.from('profiles').select('*').eq('role', 'manager').eq('is_banned', false).order('full_name'),
      client.from('manager_fighters').select('manager_id'),
    ]);
    if (profileResult.error) return [];

    const countMap = new Map<string, number>();
    for (const row of rosterResult.data ?? []) {
      countMap.set(row.manager_id, (countMap.get(row.manager_id) ?? 0) + 1);
    }

    return ((profileResult.data ?? []) as Profile[]).map((profile) => ({
      ...profile,
      rosterCount: countMap.get(profile.id) ?? 0,
    }));
  } catch {
    return [];
  }
});

export const getPublicSponsorsForPage = cache(async (): Promise<Profile[]> => {
  const client = getPublicClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('role', 'sponsor')
      .eq('is_banned', false)
      .order('full_name');
    if (error) return [];
    return (data ?? []) as Profile[];
  } catch {
    return [];
  }
});

export async function getSitemapRecords(): Promise<{
  events: SitemapRecord[];
  fighters: SitemapRecord[];
  manualFighters: SitemapRecord[];
  professionals: SitemapRecord[];
}> {
  const client = getPublicClient();
  const empty = { events: [], fighters: [], manualFighters: [], professionals: [] };
  if (!client) return empty;

  try {
    const [eventsResult, fightersResult, manualResult, primaryProfilesResult, additionalProfilesResult] = await Promise.all([
      client.from('events').select('id,created_at').eq('status', 'published'),
      client
        .from('fighters')
        .select('id,created_at,profiles!inner(is_banned)')
        .neq('is_hidden', true)
        .eq('profiles.is_banned', false),
      client.from('manual_fighters').select('id,created_at'),
      client.from('profiles').select('id,updated_at').in('role', VENDOR_ROLES).eq('is_banned', false),
      client.from('profiles').select('id,updated_at').overlaps('additional_roles', VENDOR_ROLES).eq('is_banned', false),
    ]);

    const professionalMap = new Map<string, SitemapRecord>();
    for (const profile of [...(primaryProfilesResult.data ?? []), ...(additionalProfilesResult.data ?? [])]) {
      professionalMap.set(profile.id, profile);
    }

    return {
      events: (eventsResult.data ?? []) as SitemapRecord[],
      fighters: (fightersResult.data ?? []) as SitemapRecord[],
      manualFighters: (manualResult.data ?? []) as SitemapRecord[],
      professionals: Array.from(professionalMap.values()),
    };
  } catch {
    return empty;
  }
}
