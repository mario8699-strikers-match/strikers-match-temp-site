-- =============================================
-- Matches table — fighter-vs-fighter pairings
-- =============================================

CREATE TABLE IF NOT EXISTS public.matches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  fighter_a_id     uuid NOT NULL REFERENCES public.fighters(id) ON DELETE CASCADE,
  fighter_b_id     uuid NOT NULL REFERENCES public.fighters(id) ON DELETE CASCADE,

  fighter_a_status text NOT NULL DEFAULT 'pending'
                     CHECK (fighter_a_status IN ('pending', 'accepted', 'declined')),
  fighter_b_status text NOT NULL DEFAULT 'pending'
                     CHECK (fighter_b_status IN ('pending', 'accepted', 'declined')),

  match_status     text NOT NULL DEFAULT 'pending'
                     CHECK (match_status IN ('pending', 'confirmed', 'cancelled')),

  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate pairings per event (order-independent via CHECK below)
  CONSTRAINT unique_match_pairing UNIQUE (event_id, fighter_a_id, fighter_b_id),
  -- Ensure fighter_a_id < fighter_b_id to prevent reverse-duplicate matches
  CONSTRAINT fighters_ordered CHECK (fighter_a_id < fighter_b_id)
);

-- RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Fighters can see matches they're in
CREATE POLICY "match_select_fighter" ON public.matches
  FOR SELECT USING (
    fighter_a_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
    OR fighter_b_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
  );

-- Fighters can update matches they're in (for accept/decline)
CREATE POLICY "match_update_fighter" ON public.matches
  FOR UPDATE USING (
    fighter_a_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
    OR fighter_b_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
  );

-- Promoters can see matches for their events
CREATE POLICY "match_select_promoter" ON public.matches
  FOR SELECT USING (
    event_id IN (SELECT id FROM public.events WHERE promoter_id = auth.uid())
  );

-- Promoters can insert matches for their events
CREATE POLICY "match_insert_promoter" ON public.matches
  FOR INSERT WITH CHECK (
    event_id IN (SELECT id FROM public.events WHERE promoter_id = auth.uid())
  );

-- Promoters can update matches for their events (for cancel/no-show)
CREATE POLICY "match_update_promoter" ON public.matches
  FOR UPDATE USING (
    event_id IN (SELECT id FROM public.events WHERE promoter_id = auth.uid())
  );

-- Admins full access
CREATE POLICY "match_select_admin" ON public.matches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "match_insert_admin" ON public.matches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "match_update_admin" ON public.matches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_matches_event_id ON public.matches(event_id);
CREATE INDEX IF NOT EXISTS idx_matches_fighter_a ON public.matches(fighter_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_fighter_b ON public.matches(fighter_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(match_status);

-- =============================================
-- Reliability fields on profiles
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reliability_score integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS total_matches integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellations integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_shows integer NOT NULL DEFAULT 0;
