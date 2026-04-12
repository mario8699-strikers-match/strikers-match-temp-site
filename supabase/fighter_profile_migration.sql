-- Add short_notice_ready and photo_url to fighters table
ALTER TABLE public.fighters
  ADD COLUMN IF NOT EXISTS short_notice_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Storage bucket for fighter profile photos
INSERT INTO storage.buckets (id, name, public)
  VALUES ('fighter-photos', 'fighter-photos', true)
  ON CONFLICT (id) DO NOTHING;

-- RLS policies for fighter-photos bucket
CREATE POLICY "fighter_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fighter-photos');

CREATE POLICY "fighter_photos_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fighter-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "fighter_photos_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'fighter-photos' AND auth.uid() IS NOT NULL);
