-- Add Jiu-Jitsu belt field to event applications
ALTER TABLE public.event_applications
  ADD COLUMN IF NOT EXISTS jiu_jitsu_belt TEXT DEFAULT NULL;
