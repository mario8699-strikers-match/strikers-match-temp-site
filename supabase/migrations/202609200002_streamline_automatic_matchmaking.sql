-- Keep optional classification fields from blocking automatic matchmaking and
-- let an event operator confirm a recommendation directly as an official bout.

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
BEGIN
  SELECT * INTO registration_row
  FROM public.event_registrations
  WHERE id = registration_uuid
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event registration not found'; END IF;

  SELECT event_date INTO event_day FROM public.events WHERE id = registration_row.event_id;

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

  -- Gender division and ruleset improve compatibility when supplied, but they
  -- are not required to enter the recommendation pool. The promoter remains
  -- the final reviewer before a recommendation becomes an official bout.

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
      eligibility_evaluated_at = now(),
      eligibility_rule_version = 3,
      updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_match_suggestion_as_bout(suggestion_uuid uuid)
RETURNS public.bouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  suggestion_row public.match_suggestions%ROWTYPE;
  match_row public.matches%ROWTYPE;
  bout_row public.bouts%ROWTYPE;
BEGIN
  SELECT * INTO suggestion_row
  FROM public.match_suggestions
  WHERE id = suggestion_uuid
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match suggestion not found.'; END IF;

  PERFORM public.assert_event_operator(suggestion_row.event_id);

  -- Return the already-created bout when a client retries after a timeout.
  SELECT bout.* INTO bout_row
  FROM public.bouts bout
  JOIN public.matches match ON match.id = bout.match_id
  WHERE match.suggestion_id = suggestion_row.id
    AND bout.status NOT IN ('cancelled', 'no_show')
  ORDER BY bout.created_at DESC
  LIMIT 1;
  IF FOUND THEN RETURN bout_row; END IF;

  SELECT * INTO match_row
  FROM public.matches
  WHERE suggestion_id = suggestion_row.id
    AND match_status <> 'cancelled'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    IF NOT suggestion_row.is_eligible
      OR suggestion_row.status NOT IN ('active', 'locked', 'changes_requested') THEN
      RAISE EXCEPTION 'This recommendation does not pass the current matchmaking rules.';
    END IF;

    SELECT * INTO match_row
    FROM public.propose_event_match_registrations(
      suggestion_row.event_id,
      suggestion_row.fighter_a_registration_id,
      suggestion_row.fighter_b_registration_id,
      suggestion_row.id
    );
  END IF;

  UPDATE public.matches
  SET fighter_a_status = 'accepted',
      fighter_b_status = 'accepted',
      fighter_a_confirmation_method = 'proxy',
      fighter_b_confirmation_method = 'proxy',
      fighter_a_confirmed_by = auth.uid(),
      fighter_b_confirmed_by = auth.uid(),
      fighter_a_confirmed_at = now(),
      fighter_b_confirmed_at = now(),
      updated_at = now()
  WHERE id = match_row.id
  RETURNING * INTO match_row;

  INSERT INTO public.match_audit_log(match_id, actor_id, action, new_data)
  VALUES (match_row.id, auth.uid(), 'operator_confirmed_recommendation', to_jsonb(match_row));

  SELECT * INTO bout_row FROM public.approve_confirmed_match_as_bout(match_row.id);
  RETURN bout_row;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_event_registration_eligibility(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_match_suggestion_as_bout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_match_suggestion_as_bout(uuid) TO authenticated;

-- Bulk eligibility refreshes should regenerate each affected event once, not
-- rebuild every possible pair after every participant row.
CREATE OR REPLACE FUNCTION public.refresh_match_suggestions_after_registration_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('strikers.skip_match_suggestion_refresh', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_event_match_suggestions(OLD.event_id);
    RETURN OLD;
  END IF;
  PERFORM public.refresh_event_match_suggestions(NEW.event_id);
  RETURN NEW;
END;
$$;

-- Re-evaluate only registrations affected by the old optional-field blockers.
-- Existing triggers automatically regenerate their event's recommendations.
DO $$
DECLARE
  registration_uuid uuid;
  event_uuid uuid;
  affected_event_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT event_id)
  INTO affected_event_ids
  FROM public.event_registrations
  WHERE eligibility_reasons && ARRAY['gender_division_missing', 'ruleset_missing']::text[];

  PERFORM set_config('strikers.skip_match_suggestion_refresh', 'on', true);
  FOR registration_uuid IN
    SELECT id
    FROM public.event_registrations
    WHERE eligibility_reasons && ARRAY['gender_division_missing', 'ruleset_missing']::text[]
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
