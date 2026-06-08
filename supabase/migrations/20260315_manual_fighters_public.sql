-- =============================================
-- Manual fighters: make publicly visible + allow promoters to add
-- =============================================
-- Historical: manual_fighters were private to the creating manager.
-- New behavior: publicly visible (like regular fighters), any manager/promoter/admin can add.
-- Column manager_id is kept for backwards compatibility; semantics changed to "creator_id".

-- ── Add optional display columns (for fighter-card parity) ──
ALTER TABLE public.manual_fighters
  ADD COLUMN IF NOT EXISTS photo_url    text,
  ADD COLUMN IF NOT EXISTS bio          text,
  ADD COLUMN IF NOT EXISTS height_cm    integer,
  ADD COLUMN IF NOT EXISTS reach_cm     integer,
  ADD COLUMN IF NOT EXISTS state        text,
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

-- ── Drop old restrictive policies ──
DROP POLICY IF EXISTS "manual_fighters_select" ON public.manual_fighters;
DROP POLICY IF EXISTS "manual_fighters_insert" ON public.manual_fighters;
DROP POLICY IF EXISTS "manual_fighters_update" ON public.manual_fighters;
DROP POLICY IF EXISTS "manual_fighters_delete" ON public.manual_fighters;

-- ── New policies ──

-- Drop any existing incarnations first so re-running the migration is safe.
DROP POLICY IF EXISTS "manual_fighters_select_all"      ON public.manual_fighters;
DROP POLICY IF EXISTS "manual_fighters_insert_creator"  ON public.manual_fighters;
DROP POLICY IF EXISTS "manual_fighters_update_own"      ON public.manual_fighters;
DROP POLICY IF EXISTS "manual_fighters_update_admin"    ON public.manual_fighters;
DROP POLICY IF EXISTS "manual_fighters_delete_own"      ON public.manual_fighters;
DROP POLICY IF EXISTS "manual_fighters_delete_admin"    ON public.manual_fighters;

-- Public read
CREATE POLICY "manual_fighters_select_all" ON public.manual_fighters
  FOR SELECT USING (true);

-- Insert: creator must be current user AND role must be manager/promoter/admin
CREATE POLICY "manual_fighters_insert_creator" ON public.manual_fighters
  FOR INSERT WITH CHECK (
    manager_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('manager','promoter','admin')
    )
  );

-- Update: creator can edit own
CREATE POLICY "manual_fighters_update_own" ON public.manual_fighters
  FOR UPDATE USING (manager_id = auth.uid());

-- Update: admin can edit any
CREATE POLICY "manual_fighters_update_admin" ON public.manual_fighters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Delete: creator can delete own
CREATE POLICY "manual_fighters_delete_own" ON public.manual_fighters
  FOR DELETE USING (manager_id = auth.uid());

-- Delete: admin can delete any
CREATE POLICY "manual_fighters_delete_admin" ON public.manual_fighters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ── match_requests: support manual fighters as target ──
-- fighter_id becomes nullable, add manual_fighter_id column, exactly one must be set.

ALTER TABLE public.match_requests
  ADD COLUMN IF NOT EXISTS manual_fighter_id uuid REFERENCES public.manual_fighters(id) ON DELETE CASCADE;

ALTER TABLE public.match_requests
  ALTER COLUMN fighter_id DROP NOT NULL;

-- Enforce exactly one target
ALTER TABLE public.match_requests
  DROP CONSTRAINT IF EXISTS match_requests_target_exclusive;

ALTER TABLE public.match_requests
  ADD CONSTRAINT match_requests_target_exclusive CHECK (
    (fighter_id IS NOT NULL AND manual_fighter_id IS NULL) OR
    (fighter_id IS NULL AND manual_fighter_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_match_requests_manual_fighter
  ON public.match_requests(manual_fighter_id, status);

-- Update RLS for match_requests to allow creator of manual_fighter to read/update
DROP POLICY IF EXISTS "requests_select_manual" ON public.match_requests;
CREATE POLICY "requests_select_manual" ON public.match_requests
  FOR SELECT USING (
    manual_fighter_id IN (
      SELECT id FROM public.manual_fighters WHERE manager_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "requests_update_manual" ON public.match_requests;
CREATE POLICY "requests_update_manual" ON public.match_requests
  FOR UPDATE USING (
    manual_fighter_id IN (
      SELECT id FROM public.manual_fighters WHERE manager_id = auth.uid()
    )
  );
