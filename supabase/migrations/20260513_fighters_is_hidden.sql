-- Add is_hidden column to fighters table
-- When true, the fighter is hidden from other fighter profiles
-- Only admin, promoter, manager, and sponsor roles can see hidden fighters

ALTER TABLE public.fighters
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_fighters_is_hidden ON public.fighters (is_hidden);
