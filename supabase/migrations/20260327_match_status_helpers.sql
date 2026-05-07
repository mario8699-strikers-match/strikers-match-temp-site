-- =============================================
-- Match Status Helpers
-- Auto-flip match_status when both fighters accept/decline.
-- Adds composite indexes used by fighter inbox queries.
-- =============================================

-- ── Trigger function: derive match_status from per-fighter statuses ──
CREATE OR REPLACE FUNCTION public.match_status_from_fighter_responses()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If either fighter declines, match is cancelled
  IF NEW.fighter_a_status = 'declined' OR NEW.fighter_b_status = 'declined' THEN
    NEW.match_status := 'cancelled';
  -- If both accepted, match is confirmed
  ELSIF NEW.fighter_a_status = 'accepted' AND NEW.fighter_b_status = 'accepted' THEN
    NEW.match_status := 'confirmed';
  -- Otherwise leave as pending unless promoter explicitly cancelled
  ELSIF NEW.match_status <> 'cancelled' THEN
    NEW.match_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_status_sync ON public.matches;
CREATE TRIGGER trg_match_status_sync
  BEFORE INSERT OR UPDATE OF fighter_a_status, fighter_b_status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.match_status_from_fighter_responses();

-- ── Composite index for fighter inbox lookups ──
CREATE INDEX IF NOT EXISTS idx_matches_fighter_a_status
  ON public.matches (fighter_a_id, fighter_a_status);
CREATE INDEX IF NOT EXISTS idx_matches_fighter_b_status
  ON public.matches (fighter_b_id, fighter_b_status);
