-- =============================================
-- Fighter Representation (Manager/Promoter/Sponsor)
-- =============================================

ALTER TABLE public.fighters
  ADD COLUMN IF NOT EXISTS has_manager   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_name  text,
  ADD COLUMN IF NOT EXISTS manager_email text,
  ADD COLUMN IF NOT EXISTS manager_phone text,

  ADD COLUMN IF NOT EXISTS has_promoter   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promoter_name  text,
  ADD COLUMN IF NOT EXISTS promoter_email text,
  ADD COLUMN IF NOT EXISTS promoter_phone text,

  ADD COLUMN IF NOT EXISTS has_sponsor   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sponsor_name  text,
  ADD COLUMN IF NOT EXISTS sponsor_email text,
  ADD COLUMN IF NOT EXISTS sponsor_phone text;
