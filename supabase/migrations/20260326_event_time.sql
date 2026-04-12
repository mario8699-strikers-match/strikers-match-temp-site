-- Add start time to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_time text;
