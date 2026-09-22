-- A new self-registration is pending approval and payment, so it cannot be
-- matched yet. Rebuilding every pair inside its INSERT can exceed the
-- authenticated role's statement timeout as an event grows.
--
-- Rebuild once for a registration that is already eligible. For subsequent
-- edits, rebuild from the outer write only, after eligibility has been
-- recalculated, rather than again from the nested eligibility UPDATE.

CREATE OR REPLACE FUNCTION public.evaluate_event_registration_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_skip text := current_setting('strikers.skip_match_suggestion_refresh', true);
BEGIN
  -- The outer registration write will decide whether suggestions need to be
  -- refreshed. Do not rebuild once here and again in its own AFTER trigger.
  PERFORM set_config('strikers.skip_match_suggestion_refresh', 'on', true);
  PERFORM public.refresh_event_registration_eligibility(NEW.id);
  PERFORM set_config('strikers.skip_match_suggestion_refresh', COALESCE(previous_skip, ''), true);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_match_suggestions_after_registration_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_eligible boolean;
BEGIN
  IF current_setting('strikers.skip_match_suggestion_refresh', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_event_match_suggestions(OLD.event_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Earlier AFTER INSERT triggers have calculated eligibility. Pending
    -- registrations have no matchable pairs and will be refreshed when their
    -- approval/payment or missing data changes.
    SELECT registration.eligibility_status = 'eligible'
      INTO current_eligible
    FROM public.event_registrations registration
    WHERE registration.id = NEW.id;

    IF COALESCE(current_eligible, false) THEN
      PERFORM public.refresh_event_match_suggestions(NEW.event_id);
    END IF;
    RETURN NEW;
  END IF;

  -- A manual payment notice only moves pending -> submitted. Neither status
  -- permits matchmaking, and no compatibility input changed.
  IF OLD.payment_status IN ('pending', 'submitted')
    AND NEW.payment_status IN ('pending', 'submitted')
    AND (to_jsonb(OLD) - ARRAY['payment_status', 'submitted_at', 'updated_at'])
      = (to_jsonb(NEW) - ARRAY['payment_status', 'submitted_at', 'updated_at']) THEN
    RETURN NEW;
  END IF;

  SELECT registration.eligibility_status = 'eligible'
    INTO current_eligible
  FROM public.event_registrations registration
  WHERE registration.id = NEW.id;

  -- A newly registered fighter can be approved and complete missing details
  -- before payment. Until eligibility actually changes, there are no existing
  -- pairs to refresh for that fighter.
  IF OLD.eligibility_status IS DISTINCT FROM 'eligible'
    AND NOT COALESCE(current_eligible, false)
    AND NOT EXISTS (
      SELECT 1 FROM public.match_suggestions suggestion
      WHERE suggestion.event_id = NEW.event_id
        AND (suggestion.fighter_a_registration_id = NEW.id
          OR suggestion.fighter_b_registration_id = NEW.id)
    ) THEN
    RETURN NEW;
  END IF;

  PERFORM public.refresh_event_match_suggestions(NEW.event_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_registration_write
  ON public.event_registrations;
CREATE TRIGGER trg_refresh_suggestions_from_registration_write
  AFTER INSERT OR DELETE ON public.event_registrations
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 3)
  EXECUTE FUNCTION public.refresh_match_suggestions_after_registration_change();

DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_registration_update
  ON public.event_registrations;
CREATE TRIGGER trg_refresh_suggestions_from_registration_update
  AFTER UPDATE OF
    eligibility_status, approval_status, payment_status, display_name,
    registered_discipline, registered_weight_class, weigh_in_weight,
    requested_weight_kg, acceptable_weight_min_kg, acceptable_weight_max_kg,
    weight_confirmed, availability_confirmed, available_from, available_to,
    last_fight_at, last_ko_loss_at, experience_level, gender_division, ruleset,
    date_of_birth, minor_consent_verified_at, representative_confirmed_at,
    age_at_event, record_wins, record_losses, record_draws, ko_wins, tko_wins,
    ko_losses, tko_losses, skill_rating, team_name, special_restrictions
  ON public.event_registrations
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 3)
  EXECUTE FUNCTION public.refresh_match_suggestions_after_registration_change();

REVOKE ALL ON FUNCTION public.refresh_match_suggestions_after_registration_change()
  FROM PUBLIC, anon, authenticated;
