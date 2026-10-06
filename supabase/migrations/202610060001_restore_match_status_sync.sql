-- Keep the aggregate match status synchronized with both fighter responses.
-- This trigger existed in the original match workflow but was absent from the
-- production schema, causing operator-confirmed suggestions to roll back when
-- bout creation still saw the match as pending.

CREATE OR REPLACE FUNCTION public.match_status_from_fighter_responses()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fighter_a_status = 'declined' OR NEW.fighter_b_status = 'declined' THEN
    NEW.match_status := 'cancelled';
  ELSIF NEW.fighter_a_status = 'accepted' AND NEW.fighter_b_status = 'accepted' THEN
    NEW.match_status := 'confirmed';
  ELSIF NEW.match_status <> 'cancelled' THEN
    NEW.match_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_status_sync ON public.matches;
CREATE TRIGGER trg_match_status_sync
  BEFORE INSERT OR UPDATE OF fighter_a_status, fighter_b_status
  ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.match_status_from_fighter_responses();

NOTIFY pgrst, 'reload schema';
