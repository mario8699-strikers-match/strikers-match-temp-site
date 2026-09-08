import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToSpaces, deleteFromSpaces, createPresignedUploadUrl, getPublicUrl } from '@/lib/spacesClient';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};
const PROFILE_FOLDERS = new Set([
  'fighter-photos',
  'manager-photos',
  'promoter-photos',
  'sponsor-photos',
  'profile-photos',
  'vendor-photos',
]);
const GENERAL_FOLDERS = new Set(['flyers', 'business-listings']);
const EVENT_GRAPHICS_PATTERN = /^event-graphics\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(logo|background|sponsor)$/i;
const uploadWindows = new Map<string, { count: number; resetAt: number }>();

interface AuthContext {
  userId: string;
  role: string;
  supabase: ReturnType<typeof makeAuthenticatedSupabase>;
}

function makeAuthenticatedSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const current = uploadWindows.get(userId);
  if (!current || current.resetAt <= now) {
    uploadWindows.set(userId, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  current.count += 1;
  return current.count > 30;
}

function validateImage(contentType: string, size: number): string | null {
  if (!ALLOWED_IMAGE_TYPES[contentType]) return 'Only JPG, PNG, WebP, GIF, or AVIF images are allowed.';
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    return 'The image must be between 1 byte and 10 MB.';
  }
  return null;
}

async function resolveStoragePrefix(auth: AuthContext, folder: string): Promise<string | null> {
  if (PROFILE_FOLDERS.has(folder) || GENERAL_FOLDERS.has(folder)) {
    return `users/${auth.userId}/${folder}`;
  }

  const graphicsMatch = folder.match(EVENT_GRAPHICS_PATTERN);
  if (!graphicsMatch) return null;

  const eventId = graphicsMatch[1];
  const assetType = graphicsMatch[2].toLowerCase();
  const { data, error } = await auth.supabase.rpc('can_control_event_graphics', {
    target_event_id: eventId,
  } as never);
  if (error || data !== true) return null;
  return `events/${eventId}/graphics/${assetType}`;
}

/**
 * Verify the request has a valid Supabase session.
 * Returns the user ID on success, or a 401 response on failure.
 */
async function authenticateRequest(req: NextRequest): Promise<AuthContext | NextResponse> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const supabase = makeAuthenticatedSupabase(token);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role,is_banned')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !profile || profile.is_banned) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  return { userId: user.id, role: profile.role, supabase };
}

/**
 * POST /api/storage — upload a file to DO Spaces
 *
 * Two modes:
 * 1. ?presign=true — returns a presigned PUT URL + key + publicUrl (no file in body)
 *    Query params: folder, filename, contentType
 * 2. Default — proxy upload via multipart/form-data (file + folder)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (auth instanceof NextResponse) return auth;
    if (isRateLimited(auth.userId)) {
      return NextResponse.json({ error: 'Too many upload requests. Try again shortly.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);

    // ── Presigned URL mode ──────────────────────────────────
    if (searchParams.get('presign') === 'true') {
      const folder = searchParams.get('folder') ?? '';
      const filename = searchParams.get('filename') ?? 'file';
      const contentType = searchParams.get('contentType') ?? 'application/octet-stream';
      const size = Number(searchParams.get('size'));
      const validationError = validateImage(contentType, size);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
      const prefix = await resolveStoragePrefix(auth, folder);
      if (!prefix) return NextResponse.json({ error: 'Upload destination is not allowed.' }, { status: 403 });

      const ext = ALLOWED_IMAGE_TYPES[contentType];
      const safeName = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) || 'image';
      const key = `${prefix}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${ext}`;

      const presignedUrl = await createPresignedUploadUrl(key, contentType);
      const publicUrl = getPublicUrl(key);

      return NextResponse.json({ presignedUrl, key, url: publicUrl });
    }

    // ── Direct upload mode (small files) ────────────────────
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) ?? '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const validationError = validateImage(file.type, file.size);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const prefix = await resolveStoragePrefix(auth, folder);
    if (!prefix) return NextResponse.json({ error: 'Upload destination is not allowed.' }, { status: 403 });

    const ext = ALLOWED_IMAGE_TYPES[file.type];
    const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) || 'image';
    const key = `${prefix}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToSpaces(key, buffer, file.type);

    return NextResponse.json({ url, key });
  } catch (err) {
    console.error('[storage/upload]', err);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}

/**
 * DELETE /api/storage — delete a file from DO Spaces
 *
 * Expects JSON body: { key: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (auth instanceof NextResponse) return auth;

    const { key } = await req.json();
    if (typeof key !== 'string' || !key) {
      return NextResponse.json({ error: 'No key provided.' }, { status: 400 });
    }

    let authorized = key.startsWith(`users/${auth.userId}/`);
    const eventMatch = key.match(/^events\/([0-9a-f-]{36})\/graphics\//i);
    if (!authorized && eventMatch) {
      const { data } = await auth.supabase.rpc('can_control_event_graphics', {
        target_event_id: eventMatch[1],
      } as never);
      authorized = data === true;
    }
    if (!authorized && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    await deleteFromSpaces(key);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[storage/delete]', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
