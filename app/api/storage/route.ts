import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToSpaces, deleteFromSpaces, createPresignedUploadUrl, getPublicUrl } from '@/lib/spacesClient';

// Allow uploads up to 50 MB (for small files that go through the proxy path)
export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

export const runtime = 'nodejs';

/**
 * Verify the request has a valid Supabase session.
 * Returns the user ID on success, or a 401 response on failure.
 */
async function authenticateRequest(req: NextRequest): Promise<string | NextResponse> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';

  if (!token) {
    // Fallback: read cookie-based session via supabase-js
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { cookie: req.headers.get('cookie') ?? '' } } }
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    return session.user.id;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return user.id;
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

    const { searchParams } = new URL(req.url);

    // ── Presigned URL mode ──────────────────────────────────
    if (searchParams.get('presign') === 'true') {
      const folder = searchParams.get('folder') ?? 'uploads';
      const filename = searchParams.get('filename') ?? 'file';
      const contentType = searchParams.get('contentType') ?? 'application/octet-stream';

      const ext = filename.split('.').pop();
      const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const presignedUrl = await createPresignedUploadUrl(key, contentType);
      const publicUrl = getPublicUrl(key);

      return NextResponse.json({ presignedUrl, key, url: publicUrl });
    }

    // ── Direct upload mode (small files) ────────────────────
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) ?? 'uploads';

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop();
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

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
    if (!key) {
      return NextResponse.json({ error: 'No key provided.' }, { status: 400 });
    }

    await deleteFromSpaces(key);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[storage/delete]', err);
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
