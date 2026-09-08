-- Enforce server-side workflow transitions so browser clients cannot skip or
-- reopen completed review and bout states.

CREATE OR REPLACE FUNCTION public.update_bout_operation_v2(
  bout_uuid uuid,
  next_status text DEFAULT NULL,
  next_mat_id uuid DEFAULT NULL,
  next_mat_order integer DEFAULT NULL,
  next_scheduled_time timestamptz DEFAULT NULL,
  next_winner_registration_id uuid DEFAULT NULL,
  next_method text DEFAULT NULL,
  next_elapsed_seconds integer DEFAULT NULL,
  operation_reason text DEFAULT NULL
)
RETURNS public.bouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  before_row public.bouts%ROWTYPE;
  after_row public.bouts%ROWTYPE;
  resolved_winner_id uuid;
BEGIN
  SELECT * INTO before_row FROM public.bouts WHERE id = bout_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bout not found.'; END IF;
  PERFORM public.assert_event_operator(before_row.event_id);

  IF next_status IS NOT NULL AND next_status NOT IN
    ('approved','confirmed','ready','in_progress','completed','cancelled','no_show') THEN
    RAISE EXCEPTION 'Invalid bout status.';
  END IF;
  IF next_status IS NOT NULL AND next_status <> before_row.status AND NOT (
    (before_row.status = 'approved' AND next_status IN ('confirmed','ready','cancelled','no_show'))
    OR (before_row.status = 'confirmed' AND next_status IN ('ready','cancelled','no_show'))
    OR (before_row.status = 'ready' AND next_status IN ('in_progress','cancelled','no_show'))
    OR (before_row.status = 'in_progress' AND next_status IN ('completed','cancelled','no_show'))
  ) THEN
    RAISE EXCEPTION 'Invalid bout status transition from % to %.', before_row.status, next_status;
  END IF;
  IF next_status IN ('cancelled','no_show') AND NULLIF(trim(operation_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to cancel a bout or mark a no-show.';
  END IF;
  IF next_status = 'completed' AND next_winner_registration_id IS NULL THEN
    RAISE EXCEPTION 'Winner is required to complete a bout.';
  END IF;
  IF next_winner_registration_id IS NOT NULL
    AND next_winner_registration_id NOT IN (before_row.fighter_a_registration_id, before_row.fighter_b_registration_id) THEN
    RAISE EXCEPTION 'Winner must be a participant in this bout.';
  END IF;
  IF next_winner_registration_id IS NOT NULL THEN
    SELECT fighter_id INTO resolved_winner_id
    FROM public.event_registrations WHERE id = next_winner_registration_id;
  END IF;
  IF next_mat_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_mats WHERE id = next_mat_id AND event_id = before_row.event_id
  ) THEN RAISE EXCEPTION 'Ring or mat belongs to another event.'; END IF;

  UPDATE public.bouts
  SET status = COALESCE(next_status, status),
      mat_id = COALESCE(next_mat_id, mat_id),
      mat_order = COALESCE(next_mat_order, mat_order),
      scheduled_time = COALESCE(next_scheduled_time, scheduled_time),
      winner_registration_id = COALESCE(next_winner_registration_id, winner_registration_id),
      winner_id = CASE WHEN next_winner_registration_id IS NOT NULL THEN resolved_winner_id ELSE winner_id END,
      method = COALESCE(next_method, method),
      elapsed_seconds = COALESCE(next_elapsed_seconds, elapsed_seconds),
      cancellation_reason = CASE WHEN next_status IN ('cancelled','no_show') THEN operation_reason ELSE cancellation_reason END,
      completed_at = CASE WHEN next_status = 'completed' THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = bout_uuid RETURNING * INTO after_row;

  INSERT INTO public.bout_audit_log(bout_id, actor_id, action, previous_data, new_data, reason)
  VALUES (bout_uuid, auth.uid(), 'bout_updated', to_jsonb(before_row), to_jsonb(after_row), operation_reason);
  RETURN after_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_match_suggestion(
  suggestion_uuid uuid,
  review_action text,
  reason text DEFAULT NULL
)
RETURNS public.match_suggestions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  suggestion_row public.match_suggestions%ROWTYPE;
  next_status text;
BEGIN
  SELECT * INTO suggestion_row FROM public.match_suggestions WHERE id = suggestion_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match suggestion not found.'; END IF;
  PERFORM public.assert_event_operator(suggestion_row.event_id);

  next_status := CASE review_action
    WHEN 'reject' THEN 'rejected'
    WHEN 'request_changes' THEN 'changes_requested'
    WHEN 'lock' THEN 'locked'
    WHEN 'restore' THEN 'active'
    ELSE NULL
  END;
  IF next_status IS NULL THEN RAISE EXCEPTION 'Unsupported suggestion review action.'; END IF;
  IF suggestion_row.status IN ('converted','stale') THEN
    RAISE EXCEPTION 'A converted or stale suggestion cannot be reviewed.';
  END IF;
  IF suggestion_row.status = 'rejected' AND review_action <> 'restore' THEN
    RAISE EXCEPTION 'A rejected suggestion must be restored before another review action.';
  END IF;
  IF review_action = 'restore' AND suggestion_row.status NOT IN ('rejected','changes_requested','locked') THEN
    RAISE EXCEPTION 'Only a reviewed suggestion can be restored.';
  END IF;
  IF review_action IN ('reject','request_changes') AND NULLIF(trim(reason), '') IS NULL THEN
    RAISE EXCEPTION 'A review reason is required.';
  END IF;

  UPDATE public.match_suggestions
  SET status = next_status,
      review_reason = NULLIF(trim(reason), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = suggestion_uuid
  RETURNING * INTO suggestion_row;
  RETURN suggestion_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_bout_graphic(graphic_uuid uuid, review_action text)
RETURNS public.bout_graphics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  graphic_row public.bout_graphics%ROWTYPE;
BEGIN
  SELECT * INTO graphic_row FROM public.bout_graphics WHERE id = graphic_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bout graphic not found.'; END IF;
  IF NOT public.can_control_event_graphics(graphic_row.event_id) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  IF review_action NOT IN ('approve','publish','return_to_draft') THEN RAISE EXCEPTION 'Invalid graphic action.'; END IF;
  IF review_action = 'approve' AND graphic_row.status NOT IN ('draft','stale') THEN
    RAISE EXCEPTION 'Only a draft or stale graphic can be approved.';
  END IF;
  IF review_action = 'publish' AND graphic_row.status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved graphic can be published.';
  END IF;
  IF review_action = 'return_to_draft' AND graphic_row.status = 'draft' THEN
    RAISE EXCEPTION 'Graphic is already a draft.';
  END IF;

  UPDATE public.bout_graphics
  SET status = CASE review_action
        WHEN 'approve' THEN 'approved'
        WHEN 'publish' THEN 'published'
        ELSE 'draft'
      END,
      approved_by = CASE WHEN review_action IN ('approve','publish') THEN auth.uid() ELSE NULL END,
      approved_at = CASE WHEN review_action IN ('approve','publish') THEN now() ELSE NULL END,
      published_by = CASE WHEN review_action = 'publish' THEN auth.uid() ELSE NULL END,
      published_at = CASE WHEN review_action = 'publish' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = graphic_uuid RETURNING * INTO graphic_row;
  RETURN graphic_row;
END;
$$;

-- Keep the eligibility evaluator identical while giving the reasons variable an
-- explicit array type (the database linter otherwise treats '{}' as text).
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
  IF registration_row.gender_division IS NULL THEN
    reasons := array_append(reasons, 'gender_division_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;
  IF registration_row.ruleset IS NULL THEN
    reasons := array_append(reasons, 'ruleset_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;
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
      eligibility_rule_version = 2,
      updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

-- Same manual-participant behavior, without the unused actor_role variable.
CREATE OR REPLACE FUNCTION public.create_manual_event_registration(
  target_event_id uuid,
  fighter_payload jsonb,
  publish_to_roster boolean DEFAULT false
)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_manual public.manual_fighters%ROWTYPE;
  created_registration public.event_registrations%ROWTYPE;
  full_name_value text;
  representative_confirmed boolean;
BEGIN
  PERFORM public.assert_event_operator(target_event_id);
  full_name_value := NULLIF(trim(fighter_payload->>'full_name'), '');
  IF full_name_value IS NULL THEN RAISE EXCEPTION 'Fighter name is required.'; END IF;

  representative_confirmed := COALESCE((fighter_payload->>'representative_confirmed')::boolean, false);
  IF NOT representative_confirmed THEN
    RAISE EXCEPTION 'Representative authorization must be confirmed.';
  END IF;

  INSERT INTO public.manual_fighters (
    manager_id, full_name, nickname, weight_class, discipline,
    record_wins, record_losses, record_draws,
    phone, email, city, state, country, gym_name, experience_level,
    notes, photo_url, bio, height_cm, reach_cm, is_available, is_public,
    date_of_birth, gender_division, exact_weight,
    ko_wins, tko_wins, ko_losses, tko_losses, skill_rating,
    preferred_rulesets, requested_weight_kg,
    acceptable_weight_min_kg, acceptable_weight_max_kg,
    special_restrictions, available_from, available_to,
    medical_clearance_date, last_fight_at, last_ko_loss_at
  ) VALUES (
    auth.uid(), full_name_value, NULLIF(trim(fighter_payload->>'nickname'), ''),
    NULLIF(trim(fighter_payload->>'weight_class'), ''),
    NULLIF(trim(fighter_payload->>'discipline'), ''),
    COALESCE(NULLIF(fighter_payload->>'record_wins', '')::integer, 0),
    COALESCE(NULLIF(fighter_payload->>'record_losses', '')::integer, 0),
    COALESCE(NULLIF(fighter_payload->>'record_draws', '')::integer, 0),
    NULLIF(trim(fighter_payload->>'phone'), ''),
    NULLIF(trim(fighter_payload->>'email'), ''),
    NULLIF(trim(fighter_payload->>'city'), ''),
    NULLIF(trim(fighter_payload->>'state'), ''),
    COALESCE(NULLIF(trim(fighter_payload->>'country'), ''), 'Mexico'),
    NULLIF(trim(fighter_payload->>'gym_name'), ''),
    COALESCE(NULLIF(trim(fighter_payload->>'experience_level'), ''), 'amateur'),
    NULLIF(trim(fighter_payload->>'notes'), ''),
    NULLIF(trim(fighter_payload->>'photo_url'), ''),
    NULLIF(trim(fighter_payload->>'bio'), ''),
    NULLIF(fighter_payload->>'height_cm', '')::integer,
    NULLIF(fighter_payload->>'reach_cm', '')::integer,
    COALESCE((fighter_payload->>'is_available')::boolean, true),
    publish_to_roster,
    NULLIF(fighter_payload->>'date_of_birth', '')::date,
    NULLIF(trim(fighter_payload->>'gender_division'), ''),
    NULLIF(fighter_payload->>'exact_weight', '')::numeric,
    COALESCE(NULLIF(fighter_payload->>'ko_wins', '')::integer, 0),
    COALESCE(NULLIF(fighter_payload->>'tko_wins', '')::integer, 0),
    COALESCE(NULLIF(fighter_payload->>'ko_losses', '')::integer, 0),
    COALESCE(NULLIF(fighter_payload->>'tko_losses', '')::integer, 0),
    NULLIF(fighter_payload->>'skill_rating', '')::numeric,
    public.jsonb_text_array(fighter_payload->'preferred_rulesets'),
    NULLIF(fighter_payload->>'requested_weight_kg', '')::numeric,
    NULLIF(fighter_payload->>'acceptable_weight_min_kg', '')::numeric,
    NULLIF(fighter_payload->>'acceptable_weight_max_kg', '')::numeric,
    public.jsonb_text_array(fighter_payload->'special_restrictions'),
    NULLIF(fighter_payload->>'available_from', '')::date,
    NULLIF(fighter_payload->>'available_to', '')::date,
    NULLIF(fighter_payload->>'medical_clearance_date', '')::date,
    NULLIF(fighter_payload->>'last_fight_at', '')::date,
    NULLIF(fighter_payload->>'last_ko_loss_at', '')::date
  ) RETURNING * INTO created_manual;

  INSERT INTO public.event_registrations (
    event_id, manual_fighter_id, registration_source, created_by,
    approval_status, payment_status,
    registered_discipline, registered_weight_class, weigh_in_weight,
    gender_division, experience_level, ruleset, bout_format,
    availability_confirmed, weight_confirmed,
    representative_confirmed_at, representative_confirmed_by,
    representative_confirmation_note, minor_consent_verified_at
  ) VALUES (
    target_event_id, created_manual.id,
    CASE WHEN publish_to_roster THEN 'manual_roster' ELSE 'event_only' END,
    auth.uid(), 'accepted',
    public.safe_registration_payment_status(fighter_payload->>'payment_status'),
    NULLIF(trim(fighter_payload->>'discipline'), ''),
    NULLIF(trim(fighter_payload->>'weight_class'), ''),
    NULLIF(fighter_payload->>'exact_weight', '')::numeric,
    NULLIF(trim(fighter_payload->>'gender_division'), ''),
    COALESCE(NULLIF(trim(fighter_payload->>'experience_level'), ''), 'amateur'),
    NULLIF(trim(fighter_payload->>'ruleset'), ''),
    NULLIF(trim(fighter_payload->>'bout_format'), ''),
    COALESCE((fighter_payload->>'availability_confirmed')::boolean, false),
    COALESCE((fighter_payload->>'weight_confirmed')::boolean, false),
    now(), auth.uid(),
    COALESCE(NULLIF(trim(fighter_payload->>'representative_confirmation_note'), ''),
      'Authorization recorded by event operator.'),
    CASE WHEN COALESCE((fighter_payload->>'minor_consent_confirmed')::boolean, false) THEN now() ELSE NULL END
  ) RETURNING * INTO created_registration;

  RETURN created_registration;
END;
$$;

REVOKE ALL ON FUNCTION public.update_bout_operation_v2(uuid,text,uuid,integer,timestamptz,uuid,text,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_match_suggestion(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_bout_graphic(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_event_registration_eligibility(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_manual_event_registration(uuid,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_bout_operation_v2(uuid,text,uuid,integer,timestamptz,uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_match_suggestion(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_bout_graphic(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_event_registration(uuid,jsonb,boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
