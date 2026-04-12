-- ─────────────────────────────────────────────────────────────
-- Event Flyer Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- 1. Add flyer_url column to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS flyer_url TEXT;

-- 2. Create event-flyers storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('event-flyers', 'event-flyers', true)
  ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies
-- Public read
CREATE POLICY "event_flyers_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-flyers');

-- Authenticated upload
CREATE POLICY "event_flyers_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-flyers' AND auth.uid() IS NOT NULL);

-- Authenticated delete (owner)
CREATE POLICY "event_flyers_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-flyers' AND auth.uid() IS NOT NULL);
