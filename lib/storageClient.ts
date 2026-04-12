/**
 * Client-side helper for uploading / deleting files through the
 * server-side /api/storage route (which proxies to DO Spaces).
 */

import type { ServiceResponse } from '@/types';
import { supabase } from '@/lib/supabaseClient';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

export async function uploadFile(
  file: File,
  folder: string
): Promise<ServiceResponse<{ url: string; key: string }>> {
  try {
    const headers = await getAuthHeaders();
    const body = new FormData();
    body.append('file', file);
    body.append('folder', folder);

    const res = await fetch('/api/storage', { method: 'POST', headers, body });
    const json = await res.json();

    if (!res.ok) return { data: null, error: json.error ?? 'Upload failed.' };
    return { data: json, error: null };
  } catch {
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

export async function deleteFile(key: string): Promise<ServiceResponse<null>> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/storage', {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      const json = await res.json();
      return { data: null, error: json.error ?? 'Delete failed.' };
    }
    return { data: null, error: null };
  } catch {
    return { data: null, error: 'An unexpected error occurred.' };
  }
}
