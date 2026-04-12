-- Add fighter-chosen weight class to event applications
ALTER TABLE public.event_applications
  ADD COLUMN IF NOT EXISTS fighter_weight_class TEXT DEFAULT NULL;
