-- Real event schedules pair competitors by verified weight and age tolerance.
-- Stored category labels remain useful for grouping, but they must not override
-- a valid real-weight comparison at a category boundary.
-- Experience, skill, and rematch gaps stay visible as review warnings and score
-- penalties so organizers can still see and approve intentional matchups.

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

  -- A predefined category is not required when the verified event weight is
  -- present. Some legitimate youth weights fall outside the static federation
  -- table and are still safely comparable through the event tolerance.
  IF registration_row.weigh_in_weight IS NULL OR registration_row.weigh_in_weight <= 0 THEN
    reasons := array_append(reasons, 'actual_weight_missing');
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

  -- Operators may record the age at the event directly when a date of birth is
  -- unavailable. Minor consent remains mandatory in either case.
  IF registration_row.date_of_birth IS NULL AND registration_row.age_at_event IS NULL THEN
    reasons := array_append(reasons, 'date_of_birth_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  ELSIF registration_row.date_of_birth IS NOT NULL AND event_day IS NOT NULL THEN
    is_minor := EXTRACT(YEAR FROM age(event_day, registration_row.date_of_birth)) < 18;
  ELSE
    is_minor := registration_row.age_at_event < 18;
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
      eligibility_rule_version = 6,
      updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_event_match_suggestions(target_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.event_matchmaking_settings%ROWTYPE;
  registration_a public.event_registrations%ROWTYPE;
  registration_b public.event_registrations%ROWTYPE;
  hard_failures text[];
  warning_codes text[];
  score_breakdown jsonb;
  total_score integer;
  assignment_a integer;
  assignment_b integer;
  matchup_count_value integer;
  last_matchup_value timestamptz;
  effective_weight_a numeric;
  effective_weight_b numeric;
  weight_difference numeric;
  age_difference numeric;
  experience_difference numeric;
  record_difference numeric;
  knockout_difference numeric;
  skill_difference numeric;
  location_score integer;
  weight_score integer;
  age_score integer;
  experience_score integer;
  record_score integer;
  knockout_score integer;
  skill_score integer;
  opponent_score integer;
  availability_score integer;
  weight_max integer;
  age_max integer;
  experience_max integer;
  record_max integer;
  knockout_max integer;
  skill_max integer;
  opponent_max integer;
  location_max integer;
  availability_max integer;
  total_max integer;
  current_generation uuid := gen_random_uuid();
  pair_inputs_updated_at timestamptz;
  next_status text;
  inserted_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = target_event_id) THEN
    RETURN 0;
  END IF;

  SELECT * INTO settings_row
  FROM public.event_matchmaking_settings
  WHERE event_id = target_event_id;

  settings_row.weight_tolerance_kg := COALESCE(settings_row.weight_tolerance_kg, 2);
  settings_row.age_tolerance_years := COALESCE(settings_row.age_tolerance_years, 3);
  settings_row.experience_tolerance_fights := COALESCE(settings_row.experience_tolerance_fights, 5);
  settings_row.allow_same_team := COALESCE(settings_row.allow_same_team, false);
  settings_row.recent_opponent_lookback_days := COALESCE(settings_row.recent_opponent_lookback_days, 365);
  settings_row.max_bouts_per_fighter := COALESCE(settings_row.max_bouts_per_fighter, 1);
  settings_row.skill_rating_tolerance := COALESCE(settings_row.skill_rating_tolerance, 3);
  settings_row.knockout_record_tolerance := COALESCE(settings_row.knockout_record_tolerance, 5);
  settings_row.rules_version := greatest(COALESCE(settings_row.rules_version, 2), 3);
  settings_row.score_weights := COALESCE(settings_row.score_weights, jsonb_build_object(
    'weight', 25, 'age', 10, 'experience', 15, 'record', 10,
    'knockout', 10, 'skill', 15, 'opponent_history', 5,
    'location', 5, 'availability', 5
  ));

  weight_max := COALESCE((settings_row.score_weights->>'weight')::integer, 25);
  age_max := COALESCE((settings_row.score_weights->>'age')::integer, 10);
  experience_max := COALESCE((settings_row.score_weights->>'experience')::integer, 15);
  record_max := COALESCE((settings_row.score_weights->>'record')::integer, 10);
  knockout_max := COALESCE((settings_row.score_weights->>'knockout')::integer, 10);
  skill_max := COALESCE((settings_row.score_weights->>'skill')::integer, 15);
  opponent_max := COALESCE((settings_row.score_weights->>'opponent_history')::integer, 5);
  location_max := COALESCE((settings_row.score_weights->>'location')::integer, 5);
  availability_max := COALESCE((settings_row.score_weights->>'availability')::integer, 5);
  total_max := greatest(1, weight_max + age_max + experience_max + record_max
    + knockout_max + skill_max + opponent_max + location_max + availability_max);

  UPDATE public.match_suggestions
  SET status = 'stale', generation_id = current_generation, updated_at = now()
  WHERE event_id = target_event_id AND status = 'active';

  FOR registration_a IN
    SELECT * FROM public.event_registrations
    WHERE event_id = target_event_id ORDER BY id
  LOOP
    FOR registration_b IN
      SELECT * FROM public.event_registrations
      WHERE event_id = target_event_id AND id > registration_a.id ORDER BY id
    LOOP
      hard_failures := '{}'::text[];
      warning_codes := '{}'::text[];
      assignment_a := public.event_registration_assignment_count(registration_a.id);
      assignment_b := public.event_registration_assignment_count(registration_b.id);

      SELECT history.matchup_count, history.last_matchup_at
      INTO matchup_count_value, last_matchup_value
      FROM public.event_registration_matchup_history(
        registration_a.id,
        registration_b.id,
        settings_row.recent_opponent_lookback_days
      ) history;

      effective_weight_a := CASE WHEN registration_a.weigh_in_weight > 0 THEN registration_a.weigh_in_weight END;
      effective_weight_b := CASE WHEN registration_b.weigh_in_weight > 0 THEN registration_b.weigh_in_weight END;
      weight_difference := CASE
        WHEN effective_weight_a IS NULL OR effective_weight_b IS NULL THEN NULL
        ELSE abs(effective_weight_a - effective_weight_b)
      END;
      age_difference := CASE
        WHEN registration_a.age_at_event IS NULL OR registration_b.age_at_event IS NULL THEN NULL
        ELSE abs(registration_a.age_at_event - registration_b.age_at_event)
      END;
      experience_difference := abs(
        COALESCE(registration_a.record_wins, 0) + COALESCE(registration_a.record_losses, 0) + COALESCE(registration_a.record_draws, 0)
        - COALESCE(registration_b.record_wins, 0) - COALESCE(registration_b.record_losses, 0) - COALESCE(registration_b.record_draws, 0)
      );
      record_difference := abs(
        (COALESCE(registration_a.record_wins, 0) - COALESCE(registration_a.record_losses, 0))
        - (COALESCE(registration_b.record_wins, 0) - COALESCE(registration_b.record_losses, 0))
      );
      knockout_difference := abs(
        COALESCE(registration_a.ko_wins, 0) + COALESCE(registration_a.tko_wins, 0)
        - COALESCE(registration_b.ko_wins, 0) - COALESCE(registration_b.tko_wins, 0)
      );
      skill_difference := CASE
        WHEN registration_a.skill_rating IS NULL OR registration_b.skill_rating IS NULL THEN NULL
        ELSE abs(registration_a.skill_rating - registration_b.skill_rating)
      END;

      IF registration_a.eligibility_status <> 'eligible' THEN hard_failures := array_append(hard_failures, 'fighter_a_not_eligible'); END IF;
      IF registration_b.eligibility_status <> 'eligible' THEN hard_failures := array_append(hard_failures, 'fighter_b_not_eligible'); END IF;
      IF lower(trim(COALESCE(registration_a.registered_discipline, ''))) <>
         lower(trim(COALESCE(registration_b.registered_discipline, ''))) THEN
        hard_failures := array_append(hard_failures, 'discipline_mismatch');
      END IF;
      IF registration_a.ruleset IS NOT NULL AND registration_b.ruleset IS NOT NULL
        AND lower(trim(registration_a.ruleset)) <> lower(trim(registration_b.ruleset)) THEN
        hard_failures := array_append(hard_failures, 'ruleset_mismatch');
      END IF;

      -- Category boundaries are advisory whenever both verified weights exist.
      -- The configured kilogram tolerance below is the authoritative rule.
      IF registration_a.registered_weight_class IS NOT NULL
        AND registration_b.registered_weight_class IS NOT NULL
        AND lower(trim(registration_a.registered_weight_class)) <>
          lower(trim(registration_b.registered_weight_class)) THEN
        IF weight_difference IS NULL THEN
          hard_failures := array_append(hard_failures, 'weight_class_mismatch');
        ELSIF weight_difference <= settings_row.weight_tolerance_kg THEN
          warning_codes := array_append(warning_codes, 'weight_class_difference_within_tolerance');
        END IF;
      END IF;
      IF registration_a.gender_division IS NOT NULL AND registration_b.gender_division IS NOT NULL
        AND lower(trim(registration_a.gender_division)) <> lower(trim(registration_b.gender_division)) THEN
        hard_failures := array_append(hard_failures, 'gender_division_mismatch');
      END IF;
      IF registration_a.experience_level IS NOT NULL AND registration_b.experience_level IS NOT NULL
        AND registration_a.experience_level <> registration_b.experience_level THEN
        hard_failures := array_append(hard_failures, 'competition_class_mismatch');
      END IF;
      IF NOT settings_row.allow_same_team
        AND nullif(trim(registration_a.team_name), '') IS NOT NULL
        AND lower(trim(registration_a.team_name)) = lower(trim(registration_b.team_name)) THEN
        hard_failures := array_append(hard_failures, 'same_team');
      END IF;
      IF weight_difference IS NULL THEN
        hard_failures := array_append(hard_failures, 'exact_weight_missing');
      ELSIF weight_difference > settings_row.weight_tolerance_kg THEN
        hard_failures := array_append(hard_failures, 'weight_tolerance_exceeded');
      END IF;
      IF effective_weight_b IS NOT NULL AND (
        (registration_a.acceptable_weight_min_kg IS NOT NULL AND effective_weight_b < registration_a.acceptable_weight_min_kg)
        OR (registration_a.acceptable_weight_max_kg IS NOT NULL AND effective_weight_b > registration_a.acceptable_weight_max_kg)
      ) THEN hard_failures := array_append(hard_failures, 'fighter_a_weight_range_exceeded'); END IF;
      IF effective_weight_a IS NOT NULL AND (
        (registration_b.acceptable_weight_min_kg IS NOT NULL AND effective_weight_a < registration_b.acceptable_weight_min_kg)
        OR (registration_b.acceptable_weight_max_kg IS NOT NULL AND effective_weight_a > registration_b.acceptable_weight_max_kg)
      ) THEN hard_failures := array_append(hard_failures, 'fighter_b_weight_range_exceeded'); END IF;
      IF age_difference IS NULL THEN
        warning_codes := array_append(warning_codes, 'age_missing');
      ELSIF age_difference > settings_row.age_tolerance_years THEN
        hard_failures := array_append(hard_failures, 'age_tolerance_exceeded');
      END IF;
      IF experience_difference > settings_row.experience_tolerance_fights THEN
        warning_codes := array_append(warning_codes, 'experience_tolerance_exceeded');
      END IF;
      IF skill_difference IS NULL THEN
        warning_codes := array_append(warning_codes, 'skill_rating_missing');
      ELSIF skill_difference > settings_row.skill_rating_tolerance THEN
        warning_codes := array_append(warning_codes, 'skill_rating_tolerance_exceeded');
      END IF;
      IF knockout_difference > settings_row.knockout_record_tolerance THEN
        warning_codes := array_append(warning_codes, 'knockout_record_gap');
      END IF;
      IF matchup_count_value > 0 THEN warning_codes := array_append(warning_codes, 'recent_opponent'); END IF;
      IF assignment_a >= settings_row.max_bouts_per_fighter THEN hard_failures := array_append(hard_failures, 'fighter_a_already_assigned'); END IF;
      IF assignment_b >= settings_row.max_bouts_per_fighter THEN hard_failures := array_append(hard_failures, 'fighter_b_already_assigned'); END IF;
      IF cardinality(registration_a.special_restrictions) > 0 OR cardinality(registration_b.special_restrictions) > 0 THEN
        warning_codes := array_append(warning_codes, 'special_restrictions_require_review');
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.events event
        WHERE event.id = target_event_id AND event.event_date IS NOT NULL
          AND (
            registration_a.last_fight_at > event.event_date - 30
            OR registration_b.last_fight_at > event.event_date - 30
          )
      ) THEN warning_codes := array_append(warning_codes, 'recent_fight_requires_review'); END IF;
      IF EXISTS (
        SELECT 1 FROM public.events event
        WHERE event.id = target_event_id AND event.event_date IS NOT NULL
          AND (
            registration_a.last_ko_loss_at > event.event_date - 90
            OR registration_b.last_ko_loss_at > event.event_date - 90
          )
      ) THEN warning_codes := array_append(warning_codes, 'recent_ko_loss_requires_review'); END IF;
      IF COALESCE(settings_row.promoter_preferences, '{}'::jsonb) <> '{}'::jsonb THEN
        warning_codes := array_append(warning_codes, 'promoter_preferences_require_review');
      END IF;

      weight_score := public.compatibility_component(weight_difference, settings_row.weight_tolerance_kg, weight_max);
      age_score := public.compatibility_component(age_difference, settings_row.age_tolerance_years, age_max);
      experience_score := public.compatibility_component(experience_difference, settings_row.experience_tolerance_fights, experience_max);
      record_score := public.compatibility_component(record_difference, greatest(settings_row.experience_tolerance_fights, 1), record_max);
      knockout_score := public.compatibility_component(knockout_difference, greatest(settings_row.knockout_record_tolerance, 1), knockout_max);
      skill_score := public.compatibility_component(skill_difference, settings_row.skill_rating_tolerance, skill_max);
      opponent_score := CASE WHEN matchup_count_value = 0 THEN opponent_max ELSE 0 END;
      location_score := CASE
        WHEN NOT COALESCE(settings_row.prefer_local_fighters, false) THEN location_max
        WHEN EXISTS (
          SELECT 1 FROM public.events event
          WHERE event.id = target_event_id
            AND nullif(trim(event.city), '') IS NOT NULL
            AND lower(trim(registration_a.city)) = lower(trim(event.city))
            AND lower(trim(registration_b.city)) = lower(trim(event.city))
        ) THEN location_max
        WHEN EXISTS (
          SELECT 1 FROM public.events event
          WHERE event.id = target_event_id
            AND nullif(trim(event.city), '') IS NOT NULL
            AND (
              lower(trim(registration_a.city)) = lower(trim(event.city))
              OR lower(trim(registration_b.city)) = lower(trim(event.city))
            )
        ) THEN round(location_max * 0.5)::integer
        ELSE 0
      END;
      availability_score := CASE
        WHEN registration_a.availability_confirmed AND registration_b.availability_confirmed THEN availability_max
        ELSE 0
      END;

      score_breakdown := jsonb_build_object(
        'weight', weight_score,
        'age', age_score,
        'experience', experience_score,
        'record', record_score,
        'knockout', knockout_score,
        'skill', skill_score,
        'opponentHistory', opponent_score,
        'location', location_score,
        'availability', availability_score
      );
      total_score := CASE WHEN cardinality(hard_failures) > 0 THEN 0 ELSE least(100, round(
        100.0 * (weight_score + age_score + experience_score + record_score + knockout_score
          + skill_score + opponent_score + location_score + availability_score) / total_max
      )::integer) END;

      pair_inputs_updated_at := greatest(registration_a.updated_at, registration_b.updated_at, COALESCE(settings_row.updated_at, '-infinity'::timestamptz));
      next_status := CASE WHEN EXISTS (
        SELECT 1 FROM public.matches match
        WHERE match.event_id = target_event_id
          AND match.match_status <> 'cancelled'
          AND match.fighter_a_registration_id = registration_a.id
          AND match.fighter_b_registration_id = registration_b.id
      ) THEN 'converted' ELSE 'active' END;

      INSERT INTO public.match_suggestions (
        event_id, fighter_a_registration_id, fighter_b_registration_id,
        compatibility_score, score_breakdown, hard_failures, warnings, is_eligible,
        fighter_a_scheduled_count, fighter_b_scheduled_count,
        previous_matchup_count, last_matchup_at, status,
        rule_version, generation_id, inputs_updated_at, updated_at
      ) VALUES (
        target_event_id, registration_a.id, registration_b.id,
        total_score, score_breakdown, hard_failures, warning_codes, cardinality(hard_failures) = 0,
        assignment_a, assignment_b, matchup_count_value, last_matchup_value, next_status,
        settings_row.rules_version, current_generation, pair_inputs_updated_at, now()
      )
      ON CONFLICT (event_id, fighter_a_registration_id, fighter_b_registration_id)
      DO UPDATE SET
        compatibility_score = EXCLUDED.compatibility_score,
        score_breakdown = EXCLUDED.score_breakdown,
        hard_failures = EXCLUDED.hard_failures,
        warnings = EXCLUDED.warnings,
        is_eligible = EXCLUDED.is_eligible,
        fighter_a_scheduled_count = EXCLUDED.fighter_a_scheduled_count,
        fighter_b_scheduled_count = EXCLUDED.fighter_b_scheduled_count,
        previous_matchup_count = EXCLUDED.previous_matchup_count,
        last_matchup_at = EXCLUDED.last_matchup_at,
        status = CASE
          WHEN EXCLUDED.status = 'converted' THEN 'converted'
          WHEN match_suggestions.status IN ('rejected','changes_requested','locked')
            AND match_suggestions.inputs_updated_at >= EXCLUDED.inputs_updated_at
            AND match_suggestions.rule_version = EXCLUDED.rule_version
            THEN match_suggestions.status
          ELSE EXCLUDED.status
        END,
        review_reason = CASE
          WHEN match_suggestions.inputs_updated_at >= EXCLUDED.inputs_updated_at
            AND match_suggestions.rule_version = EXCLUDED.rule_version
            THEN match_suggestions.review_reason
          ELSE NULL
        END,
        reviewed_by = CASE
          WHEN match_suggestions.inputs_updated_at >= EXCLUDED.inputs_updated_at
            AND match_suggestions.rule_version = EXCLUDED.rule_version
            THEN match_suggestions.reviewed_by
          ELSE NULL
        END,
        reviewed_at = CASE
          WHEN match_suggestions.inputs_updated_at >= EXCLUDED.inputs_updated_at
            AND match_suggestions.rule_version = EXCLUDED.rule_version
            THEN match_suggestions.reviewed_at
          ELSE NULL
        END,
        rule_version = EXCLUDED.rule_version,
        generation_id = EXCLUDED.generation_id,
        inputs_updated_at = EXCLUDED.inputs_updated_at,
        updated_at = now();

      inserted_count := inserted_count + 1;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$;

-- Official bouts created from cross-boundary recommendations describe the
-- actual agreed range instead of arbitrarily copying one fighter's category.
CREATE OR REPLACE FUNCTION public.approve_confirmed_match_as_bout(match_uuid uuid)
RETURNS public.bouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.matches%ROWTYPE;
  registration_a public.event_registrations%ROWTYPE;
  registration_b public.event_registrations%ROWTYPE;
  created_bout public.bouts%ROWTYPE;
  resolved_weight_class text;
  resolved_age_class text;
BEGIN
  SELECT * INTO match_row FROM public.matches WHERE id = match_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found.'; END IF;
  PERFORM public.assert_event_operator(match_row.event_id);
  IF match_row.match_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Both participants must confirm the proposal first.';
  END IF;

  SELECT * INTO registration_a
  FROM public.event_registrations WHERE id = match_row.fighter_a_registration_id FOR UPDATE;
  SELECT * INTO registration_b
  FROM public.event_registrations WHERE id = match_row.fighter_b_registration_id FOR UPDATE;
  IF registration_a.id IS NULL OR registration_b.id IS NULL THEN
    RAISE EXCEPTION 'Event registrations not found.';
  END IF;
  IF registration_a.eligibility_status <> 'eligible' OR registration_b.eligibility_status <> 'eligible' THEN
    RAISE EXCEPTION 'Both participants must be eligible.';
  END IF;
  IF registration_a.payment_status NOT IN ('confirmed','waived')
    OR registration_b.payment_status NOT IN ('confirmed','waived') THEN
    RAISE EXCEPTION 'Both participants must have confirmed or waived payment.';
  END IF;

  resolved_weight_class := CASE
    WHEN NULLIF(trim(registration_a.registered_weight_class), '') IS NOT NULL
      AND lower(trim(registration_a.registered_weight_class)) = lower(trim(registration_b.registered_weight_class))
      THEN registration_a.registered_weight_class
    WHEN registration_a.weigh_in_weight IS NOT NULL AND registration_b.weigh_in_weight IS NOT NULL
      AND registration_a.weigh_in_weight = registration_b.weigh_in_weight
      THEN trim_scale(registration_a.weigh_in_weight)::text || ' kg'
    WHEN registration_a.weigh_in_weight IS NOT NULL AND registration_b.weigh_in_weight IS NOT NULL
      THEN trim_scale(least(registration_a.weigh_in_weight, registration_b.weigh_in_weight))::text
        || '–' || trim_scale(greatest(registration_a.weigh_in_weight, registration_b.weigh_in_weight))::text || ' kg'
    ELSE COALESCE(registration_a.registered_weight_class, registration_b.registered_weight_class)
  END;

  resolved_age_class := CASE
    WHEN NULLIF(trim(registration_a.age_class), '') IS NOT NULL
      AND lower(trim(registration_a.age_class)) = lower(trim(registration_b.age_class))
      THEN registration_a.age_class
    WHEN registration_a.age_at_event IS NOT NULL AND registration_b.age_at_event IS NOT NULL
      AND registration_a.age_at_event = registration_b.age_at_event
      THEN registration_a.age_at_event::text || ' años'
    WHEN registration_a.age_at_event IS NOT NULL AND registration_b.age_at_event IS NOT NULL
      THEN least(registration_a.age_at_event, registration_b.age_at_event)::text
        || '–' || greatest(registration_a.age_at_event, registration_b.age_at_event)::text || ' años'
    ELSE COALESCE(registration_a.age_class, registration_b.age_class)
  END;

  INSERT INTO public.bouts (
    event_id, match_id, fighter_a_registration_id, fighter_b_registration_id,
    fighter_a_id, fighter_b_id, fighter_a_snapshot, fighter_b_snapshot,
    discipline, ruleset, bout_format, weight_class, age_class, belt_level,
    experience_level, approved_by
  ) VALUES (
    match_row.event_id, match_row.id, registration_a.id, registration_b.id,
    registration_a.fighter_id, registration_b.fighter_id,
    public.build_event_registration_bout_snapshot(registration_a.id),
    public.build_event_registration_bout_snapshot(registration_b.id),
    COALESCE(registration_a.registered_discipline, registration_b.registered_discipline),
    COALESCE(registration_a.ruleset, registration_b.ruleset),
    COALESCE(registration_a.bout_format, registration_b.bout_format),
    resolved_weight_class,
    resolved_age_class,
    COALESCE(registration_a.belt_level, registration_b.belt_level),
    COALESCE(registration_a.experience_level, registration_b.experience_level),
    auth.uid()
  )
  ON CONFLICT (match_id) DO UPDATE SET updated_at = public.bouts.updated_at
  RETURNING * INTO created_bout;

  UPDATE public.matches
  SET approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE id = match_uuid;
  INSERT INTO public.bout_audit_log(bout_id, actor_id, action, new_data)
  VALUES (created_bout.id, auth.uid(), 'bout_approved', to_jsonb(created_bout));
  RETURN created_bout;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_event_registration_eligibility(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_event_match_suggestions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_confirmed_match_as_bout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_confirmed_match_as_bout(uuid) TO authenticated;

-- Timing and bout-number changes are operational data, not visual redesigns.
-- Keep an already-published graphic live while synchronizing its schedule so
-- the display immediately shows the correct next-fight time.
CREATE OR REPLACE FUNCTION public.sync_bout_graphic_schedule_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bout_graphics
  SET payload = jsonb_set(
        jsonb_set(
          payload,
          '{bout,number}',
          COALESCE(to_jsonb(NEW.bout_number), 'null'::jsonb),
          true
        ),
        '{bout,scheduledTime}',
        COALESCE(to_jsonb(NEW.scheduled_time), 'null'::jsonb),
        true
      ),
      updated_at = now()
  WHERE bout_id = NEW.id;

  IF NOT FOUND THEN
    PERFORM public.generate_bout_graphic(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_bout_graphic ON public.bouts;
DROP TRIGGER IF EXISTS trg_generate_bout_graphic_content ON public.bouts;
DROP TRIGGER IF EXISTS trg_sync_bout_graphic_schedule ON public.bouts;

CREATE TRIGGER trg_generate_bout_graphic_content
  AFTER INSERT OR UPDATE OF
    fighter_a_registration_id, fighter_b_registration_id,
    fighter_a_snapshot, fighter_b_snapshot, discipline, ruleset,
    bout_format, weight_class
  ON public.bouts
  FOR EACH ROW EXECUTE FUNCTION public.generate_bout_graphic_after_change();

CREATE TRIGGER trg_sync_bout_graphic_schedule
  AFTER UPDATE OF bout_number, scheduled_time
  ON public.bouts
  FOR EACH ROW EXECUTE FUNCTION public.sync_bout_graphic_schedule_after_change();

REVOKE ALL ON FUNCTION public.sync_bout_graphic_schedule_after_change()
  FROM PUBLIC, anon, authenticated;

-- Normalize only records affected by the superseded category/DOB blockers,
-- then regenerate their events once. This avoids rebuilding unrelated events.
DO $$
DECLARE
  registration_uuid uuid;
  event_uuid uuid;
  affected_event_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT affected.event_id)
  INTO affected_event_ids
  FROM (
    SELECT registration.event_id
    FROM public.event_registrations registration
    WHERE (
        lower(trim(COALESCE(registration.registered_discipline, ''))) = 'boxeo'
        AND registration.weigh_in_weight > 0
        AND registration.age_at_event IS NOT NULL
        AND (
          registration.registered_weight_class IS DISTINCT FROM
            public.boxing_weight_category(registration.age_at_event, registration.weigh_in_weight)
          OR registration.eligibility_reasons && ARRAY[
            'weight_class_missing',
            'boxing_weight_category_unavailable',
            'boxing_weight_category_mismatch'
          ]::text[]
        )
      )
      OR (
        registration.date_of_birth IS NULL
        AND registration.age_at_event IS NOT NULL
        AND registration.eligibility_reasons && ARRAY['date_of_birth_missing']::text[]
      )

    UNION

    SELECT suggestion.event_id
    FROM public.match_suggestions suggestion
    WHERE suggestion.hard_failures && ARRAY[
      'weight_class_mismatch',
      'experience_tolerance_exceeded',
      'skill_rating_tolerance_exceeded',
      'recent_opponent'
    ]::text[]
  ) affected;

  PERFORM set_config('strikers.skip_match_suggestion_refresh', 'on', true);

  UPDATE public.event_registrations
  SET registered_weight_class = public.boxing_weight_category(age_at_event, weigh_in_weight),
      updated_at = now()
  WHERE lower(trim(COALESCE(registered_discipline, ''))) = 'boxeo'
    AND weigh_in_weight > 0
    AND age_at_event IS NOT NULL
    AND registered_weight_class IS DISTINCT FROM public.boxing_weight_category(age_at_event, weigh_in_weight);

  FOR registration_uuid IN
    SELECT id
    FROM public.event_registrations
    WHERE event_id = ANY(COALESCE(affected_event_ids, ARRAY[]::uuid[]))
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
