-- Add fighter-chosen discipline to event applications
ALTER TABLE public.event_applications
  ADD COLUMN IF NOT EXISTS fighter_discipline TEXT DEFAULT NULL;
