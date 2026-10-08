-- Creating one official bout used to regenerate every possible event pairing
-- after the match insert, match confirmation, and bout insert. Large events
-- could therefore exceed PostgREST's statement timeout before the transaction
-- committed. Keep those triggers useful, but update only suggestions involving
-- competitors who have reached their bout limit. A cancellation, deletion, or
-- fighter replacement still performs a complete event refresh because it can
-- make previously blocked combinations available again.

CREATE OR REPLACE FUNCTION public.mark_assigned_registration_suggestions(
  target_event_id uuid,
  registration_a_id uuid,
  registration_b_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  maximum_assignments integer := 1;
  registration_a_assignments integer := 0;
  registration_b_assignments integer := 0;
BEGIN
  SELECT COALESCE(settings.max_bouts_per_fighter, 1)
  INTO maximum_assignments
  FROM public.event_matchmaking_settings settings
  WHERE settings.event_id = target_event_id;

  maximum_assignments := COALESCE(maximum_assignments, 1);
  registration_a_assignments := CASE
    WHEN registration_a_id IS NULL THEN 0
    ELSE public.event_registration_assignment_count(registration_a_id)
  END;
  registration_b_assignments := CASE
    WHEN registration_b_id IS NULL THEN 0
    ELSE public.event_registration_assignment_count(registration_b_id)
  END;

  IF registration_a_assignments < maximum_assignments
    AND registration_b_assignments < maximum_assignments THEN
    RETURN;
  END IF;

  UPDATE public.match_suggestions suggestion
  SET is_eligible = false,
      compatibility_score = 0,
      hard_failures = (
        SELECT COALESCE(array_agg(DISTINCT failure ORDER BY failure), ARRAY[]::text[])
        FROM unnest(
          COALESCE(suggestion.hard_failures, ARRAY[]::text[])
          || CASE
            WHEN (
              suggestion.fighter_a_registration_id = registration_a_id
              AND registration_a_assignments >= maximum_assignments
            ) OR (
              suggestion.fighter_a_registration_id = registration_b_id
              AND registration_b_assignments >= maximum_assignments
            ) THEN ARRAY['fighter_a_bout_limit_reached']::text[]
            ELSE ARRAY[]::text[]
          END
          || CASE
            WHEN (
              suggestion.fighter_b_registration_id = registration_a_id
              AND registration_a_assignments >= maximum_assignments
            ) OR (
              suggestion.fighter_b_registration_id = registration_b_id
              AND registration_b_assignments >= maximum_assignments
            ) THEN ARRAY['fighter_b_bout_limit_reached']::text[]
            ELSE ARRAY[]::text[]
          END
        ) AS failure
      ),
      updated_at = now()
  WHERE suggestion.event_id = target_event_id
    AND (
      (
        registration_a_assignments >= maximum_assignments
        AND registration_a_id IN (
          suggestion.fighter_a_registration_id,
          suggestion.fighter_b_registration_id
        )
      )
      OR (
        registration_b_assignments >= maximum_assignments
        AND registration_b_id IN (
          suggestion.fighter_a_registration_id,
          suggestion.fighter_b_registration_id
        )
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_match_suggestions_after_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_is_active boolean;
  new_is_active boolean;
BEGIN
  IF current_setting('strikers.skip_match_suggestion_refresh', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'event_matchmaking_settings' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.refresh_event_match_suggestions(OLD.event_id);
      RETURN OLD;
    END IF;
    PERFORM public.refresh_event_match_suggestions(NEW.event_id);
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'matches' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.refresh_event_match_suggestions(OLD.event_id);
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      old_is_active := OLD.match_status <> 'cancelled';
      new_is_active := NEW.match_status <> 'cancelled';
      IF OLD.fighter_a_registration_id IS DISTINCT FROM NEW.fighter_a_registration_id
        OR OLD.fighter_b_registration_id IS DISTINCT FROM NEW.fighter_b_registration_id
        OR old_is_active IS DISTINCT FROM new_is_active THEN
        PERFORM public.refresh_event_match_suggestions(NEW.event_id);
        RETURN NEW;
      END IF;
    END IF;

    PERFORM public.mark_assigned_registration_suggestions(
      NEW.event_id,
      NEW.fighter_a_registration_id,
      NEW.fighter_b_registration_id
    );
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'bouts' THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM public.refresh_event_match_suggestions(OLD.event_id);
      RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      old_is_active := OLD.status NOT IN ('cancelled', 'no_show');
      new_is_active := NEW.status NOT IN ('cancelled', 'no_show');
      IF OLD.fighter_a_registration_id IS DISTINCT FROM NEW.fighter_a_registration_id
        OR OLD.fighter_b_registration_id IS DISTINCT FROM NEW.fighter_b_registration_id
        OR old_is_active IS DISTINCT FROM new_is_active THEN
        PERFORM public.refresh_event_match_suggestions(NEW.event_id);
        RETURN NEW;
      END IF;
    END IF;

    PERFORM public.mark_assigned_registration_suggestions(
      NEW.event_id,
      NEW.fighter_a_registration_id,
      NEW.fighter_b_registration_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_assigned_registration_suggestions(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_match_suggestions_after_event_change()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
