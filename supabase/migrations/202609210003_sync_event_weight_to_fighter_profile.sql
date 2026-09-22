-- An event operator's recorded weight is also the fighter's current profile
-- weight. Keep the change atomic with the registration write, without
-- rewriting registrations for other events or granting profile-wide access.

CREATE OR REPLACE FUNCTION public.sync_event_registration_weight_to_fighter_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.weigh_in_weight IS NULL OR NEW.weigh_in_weight <= 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.weigh_in_weight IS NOT DISTINCT FROM OLD.weigh_in_weight THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Self-registration and background updates do not get permission to edit a
  -- fighter's global profile through this trigger. Only event owners, admins,
  -- and assigned event managers can do so through the event workflow.
  IF auth.uid() IS NULL OR NOT public.is_event_operator(NEW.event_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.fighter_id IS NOT NULL THEN
    UPDATE public.fighters
    SET exact_weight = NEW.weigh_in_weight
    WHERE id = NEW.fighter_id
      AND exact_weight IS DISTINCT FROM NEW.weigh_in_weight;
  ELSIF NEW.manual_fighter_id IS NOT NULL THEN
    UPDATE public.manual_fighters
    SET exact_weight = NEW.weigh_in_weight
    WHERE id = NEW.manual_fighter_id
      AND exact_weight IS DISTINCT FROM NEW.weigh_in_weight;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_event_registration_weight_to_fighter_profile()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_event_registration_weight_to_fighter_profile
  ON public.event_registrations;
CREATE TRIGGER trg_sync_event_registration_weight_to_fighter_profile
  AFTER INSERT OR UPDATE OF weigh_in_weight
  ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_registration_weight_to_fighter_profile();
