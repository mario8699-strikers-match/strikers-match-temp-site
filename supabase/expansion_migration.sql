-- ============================================
-- Strikers Match — Expansion Migration
-- ============================================

-- ── Add missing columns to profiles ──────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state   TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Mexico';

-- ── Add missing columns to fighters ──────────
ALTER TABLE public.fighters
  ADD COLUMN IF NOT EXISTS nickname               TEXT,
  ADD COLUMN IF NOT EXISTS bio                    TEXT,
  ADD COLUMN IF NOT EXISTS exact_weight           NUMERIC,
  ADD COLUMN IF NOT EXISTS height_cm              NUMERIC,
  ADD COLUMN IF NOT EXISTS reach_cm               NUMERIC,
  ADD COLUMN IF NOT EXISTS gym_name               TEXT,
  ADD COLUMN IF NOT EXISTS state                  TEXT,
  ADD COLUMN IF NOT EXISTS available_from         DATE,
  ADD COLUMN IF NOT EXISTS available_to           DATE,
  ADD COLUMN IF NOT EXISTS medical_clearance_date DATE;

-- ── manager_fighters ──────────────────────────
CREATE TABLE IF NOT EXISTS public.manager_fighters (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fighter_id UUID NOT NULL REFERENCES public.fighters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manager_id, fighter_id)
);

ALTER TABLE public.manager_fighters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mf_select" ON public.manager_fighters FOR SELECT USING (
  manager_id = auth.uid() OR
  fighter_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
);
CREATE POLICY "mf_insert" ON public.manager_fighters FOR INSERT WITH CHECK (
  manager_id = auth.uid()
);
CREATE POLICY "mf_delete" ON public.manager_fighters FOR DELETE USING (
  manager_id = auth.uid()
);

-- ── sponsorship_offers ────────────────────────
CREATE TABLE IF NOT EXISTS public.sponsorship_offers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sponsor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fighter_id UUID NOT NULL REFERENCES public.fighters(id) ON DELETE CASCADE,
  amount     NUMERIC(12,2),
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','cancelled')),
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sponsorship_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "so_select" ON public.sponsorship_offers FOR SELECT USING (
  sponsor_id = auth.uid() OR
  fighter_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
);
CREATE POLICY "so_insert" ON public.sponsorship_offers FOR INSERT WITH CHECK (
  sponsor_id = auth.uid()
);
CREATE POLICY "so_update" ON public.sponsorship_offers FOR UPDATE USING (
  sponsor_id = auth.uid() OR
  fighter_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
);

-- ── Search performance indexes ────────────────
CREATE INDEX IF NOT EXISTS idx_fighters_weight_class      ON public.fighters(weight_class);
CREATE INDEX IF NOT EXISTS idx_fighters_is_available      ON public.fighters(is_available);
CREATE INDEX IF NOT EXISTS idx_fighters_short_notice      ON public.fighters(short_notice_ready);
CREATE INDEX IF NOT EXISTS idx_fighters_profile_id        ON public.fighters(profile_id);
CREATE INDEX IF NOT EXISTS idx_events_promoter_id         ON public.events(promoter_id);
CREATE INDEX IF NOT EXISTS idx_events_status              ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_requests_fighter_id        ON public.match_requests(fighter_id);
CREATE INDEX IF NOT EXISTS idx_requests_sender_id         ON public.match_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_mf_manager_id              ON public.manager_fighters(manager_id);
CREATE INDEX IF NOT EXISTS idx_mf_fighter_id              ON public.manager_fighters(fighter_id);
CREATE INDEX IF NOT EXISTS idx_so_sponsor_id              ON public.sponsorship_offers(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_so_fighter_id              ON public.sponsorship_offers(fighter_id);
