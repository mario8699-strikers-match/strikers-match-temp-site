/**
 * Client-side helper for uploading / deleting files through the
 * server-side /api/storage route (which proxies to DO Spaces).
 *
 * For files > 4 MB, uses presigned URL to upload directly to DO Spaces,
 * bypassing Vercel's 4.5 MB body size limit.
 */

import type { ServiceResponse } from '@/types';
import { supabase } from '@/lib/supabaseClient';

const PRESIGN_THRESHOLD = 4 * 1024 * 1024; // 4 MB

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

    // Large files: get a presigned URL, then PUT directly to DO Spaces
    if (file.size > PRESIGN_THRESHOLD) {
      const params = new URLSearchParams({
        presign: 'true',
        folder,
        filename: file.name,
        contentType: file.type,
      });

      const res = await fetch(`/api/storage?${params}`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error ?? 'Failed to get presigned URL.' };

      const { presignedUrl, key, url } = json;

      // Upload directly to DO Spaces using the presigned URL
      const putRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!putRes.ok) return { data: null, error: 'Direct upload to storage failed.' };
      return { data: { url, key }, error: null };
    }

    // Small files: proxy through the API route as before
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
