-- Add signup fee to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS signup_fee NUMERIC DEFAULT NULL;

-- Add universal application form fields to event_applications
ALTER TABLE public.event_applications
  ADD COLUMN IF NOT EXISTS confirm_weight      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirm_availability BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS corner_name         TEXT DEFAULT NULL;
