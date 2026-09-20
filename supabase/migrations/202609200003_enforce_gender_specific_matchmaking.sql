-- A combat pairing must always use two participants from the same recognized
-- gender division. Missing or unrecognized values stay out of matchmaking.

CREATE OR REPLACE FUNCTION public.canonical_gender_division(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(COALESCE(value, '')))
    WHEN 'masculino' THEN 'Masculino'
    WHEN 'masculina' THEN 'Masculino'
    WHEN 'hombre' THEN 'Masculino'
    WHEN 'varon' THEN 'Masculino'
    WHEN 'varón' THEN 'Masculino'
    WHEN 'male' THEN 'Masculino'
    WHEN 'm' THEN 'Masculino'
    WHEN 'femenino' THEN 'Femenino'
    WHEN 'femenina' THEN 'Femenino'
    WHEN 'mujer' THEN 'Femenino'
    WHEN 'female' THEN 'Femenino'
    WHEN 'f' THEN 'Femenino'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_event_registration_eligibility(registration_uuid uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_row public.event_registrations%ROWTYPE;
  reasons text[] := ARRAY[]::text[];
  next_status text := 'eligible';
  event_day date;
  is_minor boolean := false;
  has_consent boolean := false;
  raw_gender text;
  canonical_gender text;
BEGIN
  SELECT * INTO registration_row
  FROM public.event_registrations
  WHERE id = registration_uuid
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event registration not found'; END IF;

  SELECT event_date INTO event_day FROM public.events WHERE id = registration_row.event_id;
  raw_gender := NULLIF(trim(registration_row.gender_division), '');
  canonical_gender := public.canonical_gender_division(raw_gender);

  IF registration_row.approval_status IN ('declined', 'withdrawn') THEN
    reasons := array_append(reasons, 'application_not_approved');
    next_status := 'ineligible';
  ELSIF registration_row.approval_status <> 'accepted' THEN
    reasons := array_append(reasons, 'application_pending');
    next_status := 'pending';
  END IF;
  IF registration_row.payment_status NOT IN ('confirmed', 'waived') THEN
    reasons := array_append(reasons, 'payment_not_confirmed');
    IF next_status = 'eligible' THEN next_status := 'pending'; END IF;
  END IF;
  IF registration_row.display_name IS NULL OR trim(registration_row.display_name) = '' THEN
    reasons := array_append(reasons, 'fighter_name_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;
  IF registration_row.registered_discipline IS NULL THEN
    reasons := array_append(reasons, 'discipline_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;
  IF registration_row.registered_weight_class IS NULL THEN
    reasons := array_append(reasons, 'weight_class_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;
  IF registration_row.weigh_in_weight IS NULL AND registration_row.requested_weight_kg IS NULL THEN
    reasons := array_append(reasons, 'actual_or_requested_weight_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;
  IF NOT registration_row.weight_confirmed THEN
    reasons := array_append(reasons, 'weight_not_confirmed');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;
  IF NOT registration_row.availability_confirmed THEN
    reasons := array_append(reasons, 'availability_not_confirmed');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;
  IF registration_row.experience_level IS NULL THEN
    reasons := array_append(reasons, 'experience_level_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;
  IF raw_gender IS NULL THEN
    reasons := array_append(reasons, 'gender_division_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  ELSIF canonical_gender IS NULL THEN
    reasons := array_append(reasons, 'gender_division_invalid');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;

  -- Ruleset remains optional. When both fighters provide one, the compatibility
  -- engine still requires the values to match.

  IF registration_row.acceptable_weight_min_kg IS NOT NULL
    AND registration_row.acceptable_weight_max_kg IS NOT NULL
    AND registration_row.acceptable_weight_min_kg > registration_row.acceptable_weight_max_kg THEN
    reasons := array_append(reasons, 'acceptable_weight_range_invalid');
    next_status := 'ineligible';
  END IF;
  IF event_day IS NOT NULL AND (
    (registration_row.available_from IS NOT NULL AND event_day < registration_row.available_from)
    OR (registration_row.available_to IS NOT NULL AND event_day > registration_row.available_to)
  ) THEN
    reasons := array_append(reasons, 'outside_availability_window');
    next_status := 'ineligible';
  END IF;
  IF registration_row.date_of_birth IS NULL THEN
    reasons := array_append(reasons, 'date_of_birth_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  ELSIF event_day IS NOT NULL THEN
    is_minor := EXTRACT(YEAR FROM age(event_day, registration_row.date_of_birth)) < 18;
  END IF;
  IF is_minor THEN
    has_consent := registration_row.minor_consent_verified_at IS NOT NULL;
    IF registration_row.fighter_id IS NOT NULL AND NOT has_consent THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.parental_consents consent
        JOIN public.fighters fighter ON fighter.profile_id = consent.fighter_profile_id
        WHERE fighter.id = registration_row.fighter_id
      ) INTO has_consent;
    END IF;
    IF NOT has_consent THEN
      reasons := array_append(reasons, 'minor_consent_missing');
      next_status := 'ineligible';
    END IF;
  END IF;
  IF registration_row.manual_fighter_id IS NOT NULL
    AND registration_row.representative_confirmed_at IS NULL THEN
    reasons := array_append(reasons, 'representative_confirmation_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;

  UPDATE public.event_registrations
  SET eligibility_status = next_status,
      eligibility_reasons = reasons,
      gender_division = COALESCE(canonical_gender, registration_row.gender_division),
      eligibility_evaluated_at = now(),
      eligibility_rule_version = 4,
      updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_combat_pair_gender_division()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gender_a text;
  gender_b text;
BEGIN
  IF NEW.fighter_a_registration_id IS NULL AND NEW.fighter_b_registration_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.fighter_a_registration_id IS NULL OR NEW.fighter_b_registration_id IS NULL THEN
    RAISE EXCEPTION 'Ambos peleadores deben tener un registro válido antes de crear el combate.';
  END IF;

  SELECT public.canonical_gender_division(gender_division)
  INTO gender_a
  FROM public.event_registrations
  WHERE id = NEW.fighter_a_registration_id;
  SELECT public.canonical_gender_division(gender_division)
  INTO gender_b
  FROM public.event_registrations
  WHERE id = NEW.fighter_b_registration_id;

  IF gender_a IS NULL OR gender_b IS NULL THEN
    RAISE EXCEPTION 'Ambos peleadores deben tener una división de género válida antes de emparejarse.';
  END IF;
  IF gender_a <> gender_b THEN
    RAISE EXCEPTION 'No se puede crear un combate entre divisiones de género diferentes.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_match_gender_division ON public.matches;
CREATE TRIGGER trg_enforce_match_gender_division
  BEFORE INSERT OR UPDATE OF fighter_a_registration_id, fighter_b_registration_id
  ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_combat_pair_gender_division();

DROP TRIGGER IF EXISTS trg_enforce_bout_gender_division ON public.bouts;
CREATE TRIGGER trg_enforce_bout_gender_division
  BEFORE INSERT OR UPDATE OF fighter_a_registration_id, fighter_b_registration_id
  ON public.bouts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_combat_pair_gender_division();

CREATE OR REPLACE FUNCTION public.prevent_assigned_registration_gender_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.canonical_gender_division(OLD.gender_division)
    IS DISTINCT FROM public.canonical_gender_division(NEW.gender_division)
    AND public.event_registration_assignment_count(OLD.id) > 0 THEN
    RAISE EXCEPTION 'Cancela el combate activo antes de cambiar la división de género del peleador.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_assigned_registration_gender_change
  ON public.event_registrations;
CREATE TRIGGER trg_prevent_assigned_registration_gender_change
  BEFORE UPDATE OF gender_division ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_assigned_registration_gender_change();

REVOKE ALL ON FUNCTION public.canonical_gender_division(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_event_registration_eligibility(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_combat_pair_gender_division() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_assigned_registration_gender_change() FROM PUBLIC, anon, authenticated;

-- Normalize recognized historical labels and re-evaluate every registration.
UPDATE public.fighters
SET gender_division = public.canonical_gender_division(gender_division)
WHERE public.canonical_gender_division(gender_division) IS NOT NULL
  AND gender_division IS DISTINCT FROM public.canonical_gender_division(gender_division);

UPDATE public.manual_fighters
SET gender_division = public.canonical_gender_division(gender_division)
WHERE public.canonical_gender_division(gender_division) IS NOT NULL
  AND gender_division IS DISTINCT FROM public.canonical_gender_division(gender_division);

DO $$
DECLARE
  registration_uuid uuid;
  event_uuid uuid;
  affected_event_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT event_id) INTO affected_event_ids
  FROM public.event_registrations;

  PERFORM set_config('strikers.skip_match_suggestion_refresh', 'on', true);
  FOR registration_uuid IN SELECT id FROM public.event_registrations
  LOOP
    PERFORM public.refresh_event_registration_eligibility(registration_uuid);
  END LOOP;
  PERFORM set_config('strikers.skip_match_suggestion_refresh', 'off', true);

  FOREACH event_uuid IN ARRAY COALESCE(affected_event_ids, ARRAY[]::uuid[])
  LOOP
    PERFORM public.refresh_event_match_suggestions(event_uuid);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('strikers.skip_match_suggestion_refresh', 'off', true);
  RAISE;
END;
$$;

NOTIFY pgrst, 'reload schema';
