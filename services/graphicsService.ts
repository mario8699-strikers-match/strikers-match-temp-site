import { supabase } from '@/lib/supabaseClient';
import { uploadFile } from '@/lib/storageClient';
import type {
  BoutGraphic,
  EventDisplayState,
  EventDisplayToken,
  EventGraphicsSettings,
  PublicEventDisplay,
  ServiceResponse,
} from '@/types';

export const DEFAULT_GRAPHICS_SETTINGS: Omit<EventGraphicsSettings, 'event_id' | 'created_at' | 'updated_at'> = {
  template_key: 'strikers-classic',
  template_version: 1,
  primary_color: '#0A0A0A',
  secondary_color: '#FFFFFF',
  accent_color: '#C0001E',
  logo_url: null,
  background_url: null,
  sponsor_logo_urls: [],
  display_duration_seconds: 12,
};

export const INVALID_DISPLAY_TOKEN_ERROR = 'Enlace de pantalla inválido, vencido o revocado.';

const GRAPHICS_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_GRAPHICS_IMAGE_BYTES = 10 * 1024 * 1024;

export async function uploadEventGraphicImage(
  eventId: string,
  file: File,
  assetType: 'logo' | 'background' | 'sponsor'
): Promise<ServiceResponse<string>> {
  if (!GRAPHICS_IMAGE_TYPES.has(file.type)) {
    return { data: null, error: 'Usa una imagen JPG, PNG o WebP.' };
  }
  if (file.size > MAX_GRAPHICS_IMAGE_BYTES) {
    return { data: null, error: 'La imagen no puede superar 10 MB.' };
  }

  const safeEventId = eventId.replace(/[^a-zA-Z0-9-]/g, '');
  if (!safeEventId) return { data: null, error: 'El evento no es válido.' };

  const result = await uploadFile(file, `event-graphics/${safeEventId}/${assetType}`);
  if (result.error || !result.data) {
    return { data: null, error: result.error ?? 'No se pudo subir la imagen.' };
  }
  return { data: result.data.url, error: null };
}

export async function getEventGraphics(eventId: string): Promise<ServiceResponse<BoutGraphic[]>> {
  const { data, error } = await supabase.from('bout_graphics').select('*').eq('event_id', eventId).order('created_at');
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as BoutGraphic[], error: null };
}

export async function getEventGraphicsSettings(eventId: string): Promise<ServiceResponse<EventGraphicsSettings>> {
  const { data, error } = await supabase.from('event_graphics_settings').select('*').eq('event_id', eventId).maybeSingle();
  if (error) return { data: null, error: error.message };
  return {
    data: {
      event_id: eventId,
      ...DEFAULT_GRAPHICS_SETTINGS,
      ...(data ?? {}),
      created_at: data?.created_at ?? new Date().toISOString(),
      updated_at: data?.updated_at ?? new Date().toISOString(),
    } as EventGraphicsSettings,
    error: null,
  };
}

export async function saveEventGraphicsSettings(
  eventId: string,
  settings: Omit<EventGraphicsSettings, 'event_id' | 'created_at' | 'updated_at'>
): Promise<ServiceResponse<EventGraphicsSettings>> {
  const { data, error } = await supabase.from('event_graphics_settings').upsert({ event_id: eventId, ...settings, updated_at: new Date().toISOString() }, { onConflict: 'event_id' }).select().single();
  if (error) return { data: null, error: error.message };
  return { data: data as EventGraphicsSettings, error: null };
}

export async function reviewBoutGraphic(graphicId: string, action: 'approve' | 'publish' | 'return_to_draft'): Promise<ServiceResponse<BoutGraphic>> {
  const { data, error } = await supabase.rpc('review_bout_graphic', { graphic_uuid: graphicId, review_action: action });
  if (error) return { data: null, error: error.message };
  return { data: data as BoutGraphic, error: null };
}

export async function setEventDisplay(
  eventId: string,
  graphicId: string | null,
  mode: 'manual' | 'sequence',
  isLive: boolean
): Promise<ServiceResponse<EventDisplayState>> {
  const { data, error } = await supabase.rpc('set_event_display_state', {
    target_event_id: eventId,
    target_graphic_id: graphicId,
    next_mode: mode,
    next_is_live: isLive,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as EventDisplayState, error: null };
}

export async function getEventDisplayState(eventId: string): Promise<ServiceResponse<EventDisplayState>> {
  const { data, error } = await supabase.from('event_display_state').select('*').eq('event_id', eventId).maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data as EventDisplayState | null, error: null };
}

export async function getManagedEventDisplay(eventId: string): Promise<ServiceResponse<PublicEventDisplay>> {
  const [graphicsResult, settingsResult, stateResult] = await Promise.all([
    getEventGraphics(eventId),
    getEventGraphicsSettings(eventId),
    getEventDisplayState(eventId),
  ]);
  const error = graphicsResult.error ?? settingsResult.error ?? stateResult.error;
  if (error) return { data: null, error };

  const publishedGraphics = (graphicsResult.data ?? [])
    .filter((graphic) => graphic.status === 'published')
    .sort((first, second) => (first.payload.bout.number ?? Number.MAX_SAFE_INTEGER) - (second.payload.bout.number ?? Number.MAX_SAFE_INTEGER));

  return {
    data: {
      eventId,
      displayDurationSeconds: settingsResult.data?.display_duration_seconds ?? 12,
      state: stateResult.data ?? {},
      graphics: publishedGraphics.map((graphic) => ({
        id: graphic.id,
        boutId: graphic.bout_id,
        templateKey: graphic.template_key,
        templateVersion: graphic.template_version,
        payload: graphic.payload,
        updatedAt: graphic.updated_at,
      })),
    },
    error: null,
  };
}

export async function getEventDisplayTokens(eventId: string): Promise<ServiceResponse<EventDisplayToken[]>> {
  const { data, error } = await supabase.from('event_display_tokens').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as EventDisplayToken[], error: null };
}

export async function createEventDisplayToken(eventId: string, label: string): Promise<ServiceResponse<EventDisplayToken>> {
  const { data, error } = await supabase.rpc('create_event_display_token', { target_event_id: eventId, token_label: label, token_expires_at: null });
  if (error) return { data: null, error: error.message };
  return { data: data as EventDisplayToken, error: null };
}

export async function revokeEventDisplayToken(tokenId: string): Promise<ServiceResponse<EventDisplayToken>> {
  const { data, error } = await supabase.rpc('revoke_event_display_token', { token_uuid: tokenId });
  if (error) return { data: null, error: error.message };
  return { data: data as EventDisplayToken, error: null };
}

export async function getPublicEventDisplay(token: string): Promise<ServiceResponse<PublicEventDisplay>> {
  const { data, error } = await supabase.rpc('get_event_display', { display_token: token });
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: INVALID_DISPLAY_TOKEN_ERROR };
  return { data: data as PublicEventDisplay, error: null };
}
