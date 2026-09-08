-- Matchmaking-to-presentation pipeline: persisted, explainable suggestions.

CREATE TABLE IF NOT EXISTS public.match_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  fighter_a_registration_id uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  fighter_b_registration_id uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  compatibility_score integer NOT NULL DEFAULT 0 CHECK (compatibility_score BETWEEN 0 AND 100),
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  hard_failures text[] NOT NULL DEFAULT '{}',
  warnings text[] NOT NULL DEFAULT '{}',
  is_eligible boolean NOT NULL DEFAULT false,
  fighter_a_scheduled_count integer NOT NULL DEFAULT 0,
  fighter_b_scheduled_count integer NOT NULL DEFAULT 0,
  previous_matchup_count integer NOT NULL DEFAULT 0,
  last_matchup_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','rejected','changes_requested','locked','converted','stale')),
  review_reason text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rule_version integer NOT NULL DEFAULT 1,
  generation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  inputs_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fighter_a_registration_id < fighter_b_registration_id),
  UNIQUE (event_id, fighter_a_registration_id, fighter_b_registration_id)
);

CREATE INDEX IF NOT EXISTS idx_match_suggestions_event_rank
  ON public.match_suggestions(event_id, status, is_eligible, compatibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_match_suggestions_registration_a
  ON public.match_suggestions(fighter_a_registration_id);
CREATE INDEX IF NOT EXISTS idx_match_suggestions_registration_b
  ON public.match_suggestions(fighter_b_registration_id);

ALTER TABLE public.match_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_suggestions_event_operator_select" ON public.match_suggestions;
DROP POLICY IF EXISTS "match_suggestions_event_operator_manage" ON public.match_suggestions;
CREATE POLICY "match_suggestions_event_operator_select" ON public.match_suggestions
  FOR SELECT USING (public.is_event_operator(event_id));
CREATE POLICY "match_suggestions_event_operator_manage" ON public.match_suggestions
  FOR ALL USING (public.is_event_operator(event_id))
  WITH CHECK (public.is_event_operator(event_id));

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_suggestion_id_fkey;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_suggestion_id_fkey
  FOREIGN KEY (suggestion_id) REFERENCES public.match_suggestions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.compatibility_component(
  difference numeric,
  tolerance numeric,
  maximum_score integer,
  missing_ratio numeric DEFAULT 0.5
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN difference IS NULL THEN round(maximum_score * missing_ratio)::integer
    WHEN difference <= 0 THEN maximum_score
    WHEN tolerance <= 0 OR difference > tolerance THEN 0
    ELSE greatest(0, round(maximum_score * (1 - difference / tolerance))::integer)
  END;
$$;

CREATE OR REPLACE FUNCTION public.event_registration_assignment_count(registration_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM (
    SELECT match.id
    FROM public.matches match
    LEFT JOIN public.bouts bout
      ON bout.match_id = match.id
      AND bout.status NOT IN ('cancelled','no_show')
    WHERE match.match_status <> 'cancelled'
      AND bout.id IS NULL
      AND registration_uuid IN (match.fighter_a_registration_id, match.fighter_b_registration_id)
    UNION ALL
    SELECT bout.id
    FROM public.bouts bout
    WHERE bout.status NOT IN ('cancelled','no_show')
      AND registration_uuid IN (bout.fighter_a_registration_id, bout.fighter_b_registration_id)
  ) assignments;
$$;

CREATE OR REPLACE FUNCTION public.event_registration_matchup_history(
  registration_a_uuid uuid,
  registration_b_uuid uuid,
  lookback_days integer DEFAULT NULL
)
RETURNS TABLE(matchup_count integer, last_matchup_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_pair AS (
    SELECT
      a.event_id,
      a.fighter_id AS a_fighter_id,
      a.manual_fighter_id AS a_manual_id,
      b.fighter_id AS b_fighter_id,
      b.manual_fighter_id AS b_manual_id
    FROM public.event_registrations a
    JOIN public.event_registrations b ON b.id = registration_b_uuid
    WHERE a.id = registration_a_uuid
  ), historical AS (
    SELECT COALESCE(bout.scheduled_time, bout.created_at) AS happened_at
    FROM public.bouts bout
    JOIN public.event_registrations historical_a ON historical_a.id = bout.fighter_a_registration_id
    JOIN public.event_registrations historical_b ON historical_b.id = bout.fighter_b_registration_id
    CROSS JOIN current_pair current
    WHERE bout.event_id <> current.event_id
      AND bout.status NOT IN ('cancelled','no_show')
      AND (
        (
          ((current.a_fighter_id IS NOT NULL AND historical_a.fighter_id = current.a_fighter_id)
            OR (current.a_manual_id IS NOT NULL AND historical_a.manual_fighter_id = current.a_manual_id))
          AND
          ((current.b_fighter_id IS NOT NULL AND historical_b.fighter_id = current.b_fighter_id)
            OR (current.b_manual_id IS NOT NULL AND historical_b.manual_fighter_id = current.b_manual_id))
        )
        OR
        (
          ((current.a_fighter_id IS NOT NULL AND historical_b.fighter_id = current.a_fighter_id)
            OR (current.a_manual_id IS NOT NULL AND historical_b.manual_fighter_id = current.a_manual_id))
          AND
          ((current.b_fighter_id IS NOT NULL AND historical_a.fighter_id = current.b_fighter_id)
            OR (current.b_manual_id IS NOT NULL AND historical_a.manual_fighter_id = current.b_manual_id))
        )
      )
      AND (
        lookback_days IS NULL
        OR COALESCE(bout.scheduled_time, bout.created_at) >= now() - make_interval(days => lookback_days)
      )
  )
  SELECT count(*)::integer, max(happened_at) FROM historical;
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
  settings_row.rules_version := COALESCE(settings_row.rules_version, 2);
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

      effective_weight_a := COALESCE(registration_a.weigh_in_weight, registration_a.requested_weight_kg);
      effective_weight_b := COALESCE(registration_b.weigh_in_weight, registration_b.requested_weight_kg);
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
      IF registration_a.registered_weight_class IS NOT NULL
        AND registration_b.registered_weight_class IS NOT NULL
        AND lower(trim(registration_a.registered_weight_class)) <>
          lower(trim(registration_b.registered_weight_class)) THEN
        hard_failures := array_append(hard_failures, 'weight_class_mismatch');
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
        warning_codes := array_append(warning_codes, 'exact_weight_missing');
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
        hard_failures := array_append(hard_failures, 'experience_tolerance_exceeded');
      END IF;
      IF skill_difference IS NULL THEN
        warning_codes := array_append(warning_codes, 'skill_rating_missing');
      ELSIF skill_difference > settings_row.skill_rating_tolerance THEN
        hard_failures := array_append(hard_failures, 'skill_rating_tolerance_exceeded');
      END IF;
      IF knockout_difference > settings_row.knockout_record_tolerance THEN
        warning_codes := array_append(warning_codes, 'knockout_record_gap');
      END IF;
      IF matchup_count_value > 0 THEN hard_failures := array_append(hard_failures, 'recent_opponent'); END IF;
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

CREATE OR REPLACE FUNCTION public.regenerate_event_match_suggestions(target_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_event_operator(target_event_id);
  RETURN public.refresh_event_match_suggestions(target_event_id);
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
  IF review_action IN ('reject','request_changes') AND nullif(trim(reason), '') IS NULL THEN
    RAISE EXCEPTION 'A review reason is required.';
  END IF;

  UPDATE public.match_suggestions
  SET status = next_status,
      review_reason = nullif(trim(reason), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = suggestion_uuid
  RETURNING * INTO suggestion_row;
  RETURN suggestion_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.propose_event_match_registrations(
  target_event_id uuid,
  registration_x_id uuid,
  registration_y_id uuid,
  target_suggestion_id uuid DEFAULT NULL
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_a_id uuid;
  registration_b_id uuid;
  registration_a public.event_registrations%ROWTYPE;
  registration_b public.event_registrations%ROWTYPE;
  suggestion_row public.match_suggestions%ROWTYPE;
  settings_row public.event_matchmaking_settings%ROWTYPE;
  created_match public.matches%ROWTYPE;
  status_a text := 'pending';
  status_b text := 'pending';
BEGIN
  IF registration_x_id = registration_y_id THEN RAISE EXCEPTION 'A fighter cannot be matched with themselves.'; END IF;
  PERFORM public.assert_event_operator(target_event_id);

  registration_a_id := least(registration_x_id, registration_y_id);
  registration_b_id := greatest(registration_x_id, registration_y_id);
  PERFORM pg_advisory_xact_lock(hashtext(target_event_id::text || ':' || registration_a_id::text || ':' || registration_b_id::text));

  SELECT * INTO registration_a FROM public.event_registrations WHERE id = registration_a_id FOR UPDATE;
  SELECT * INTO registration_b FROM public.event_registrations WHERE id = registration_b_id FOR UPDATE;
  IF registration_a.id IS NULL OR registration_b.id IS NULL
    OR registration_a.event_id <> target_event_id OR registration_b.event_id <> target_event_id THEN
    RAISE EXCEPTION 'Both participants must be registered for this event.';
  END IF;
  IF registration_a.eligibility_status <> 'eligible' OR registration_b.eligibility_status <> 'eligible' THEN
    RAISE EXCEPTION 'Both participants must be eligible.';
  END IF;
  IF registration_a.payment_status NOT IN ('confirmed','waived')
    OR registration_b.payment_status NOT IN ('confirmed','waived') THEN
    RAISE EXCEPTION 'Both participants must have confirmed or waived payment.';
  END IF;
  IF NOT public.event_registration_disciplines_match(registration_a.id, registration_b.id) THEN
    RAISE EXCEPTION 'The participant disciplines are incompatible.';
  END IF;

  SELECT * INTO settings_row FROM public.event_matchmaking_settings WHERE event_id = target_event_id;
  IF public.event_registration_assignment_count(registration_a.id) >= COALESCE(settings_row.max_bouts_per_fighter, 1)
    OR public.event_registration_assignment_count(registration_b.id) >= COALESCE(settings_row.max_bouts_per_fighter, 1) THEN
    RAISE EXCEPTION 'A participant already reached the active bout limit.';
  END IF;

  IF target_suggestion_id IS NULL THEN
    SELECT * INTO suggestion_row
    FROM public.match_suggestions
    WHERE event_id = target_event_id
      AND fighter_a_registration_id = registration_a.id
      AND fighter_b_registration_id = registration_b.id;
    IF suggestion_row.id IS NULL THEN
      PERFORM public.refresh_event_match_suggestions(target_event_id);
      SELECT * INTO suggestion_row
      FROM public.match_suggestions
      WHERE event_id = target_event_id
        AND fighter_a_registration_id = registration_a.id
        AND fighter_b_registration_id = registration_b.id;
    END IF;
    target_suggestion_id := suggestion_row.id;
  ELSE
    SELECT * INTO suggestion_row FROM public.match_suggestions WHERE id = target_suggestion_id FOR UPDATE;
    IF suggestion_row.id IS NULL OR suggestion_row.event_id <> target_event_id
      OR suggestion_row.fighter_a_registration_id <> registration_a.id
      OR suggestion_row.fighter_b_registration_id <> registration_b.id THEN
      RAISE EXCEPTION 'The match suggestion does not belong to this participant pair.';
    END IF;
  END IF;
  IF suggestion_row.id IS NULL OR NOT suggestion_row.is_eligible
    OR suggestion_row.status NOT IN ('active','locked','changes_requested') THEN
    RAISE EXCEPTION 'This participant pairing does not pass the current matchmaking rules.';
  END IF;

  IF registration_a.manual_fighter_id IS NOT NULL AND registration_a.representative_confirmed_at IS NOT NULL THEN
    status_a := 'accepted';
  END IF;
  IF registration_b.manual_fighter_id IS NOT NULL AND registration_b.representative_confirmed_at IS NOT NULL THEN
    status_b := 'accepted';
  END IF;

  INSERT INTO public.matches (
    event_id, fighter_a_registration_id, fighter_b_registration_id,
    fighter_a_id, fighter_b_id, fighter_a_status, fighter_b_status,
    compatibility_score, score_breakdown, warnings, rule_version,
    suggestion_id, proposed_by,
    fighter_a_confirmation_method, fighter_b_confirmation_method,
    fighter_a_confirmed_by, fighter_b_confirmed_by,
    fighter_a_confirmed_at, fighter_b_confirmed_at
  ) VALUES (
    target_event_id, registration_a.id, registration_b.id,
    registration_a.fighter_id, registration_b.fighter_id, status_a, status_b,
    suggestion_row.compatibility_score, COALESCE(suggestion_row.score_breakdown, '{}'::jsonb),
    COALESCE(suggestion_row.warnings, '{}'::text[]),
    COALESCE(suggestion_row.rule_version, settings_row.rules_version),
    target_suggestion_id, auth.uid(),
    CASE WHEN status_a = 'accepted' THEN 'proxy' ELSE NULL END,
    CASE WHEN status_b = 'accepted' THEN 'proxy' ELSE NULL END,
    CASE WHEN status_a = 'accepted' THEN registration_a.representative_confirmed_by ELSE NULL END,
    CASE WHEN status_b = 'accepted' THEN registration_b.representative_confirmed_by ELSE NULL END,
    CASE WHEN status_a = 'accepted' THEN now() ELSE NULL END,
    CASE WHEN status_b = 'accepted' THEN now() ELSE NULL END
  ) RETURNING * INTO created_match;

  IF target_suggestion_id IS NOT NULL THEN
    UPDATE public.match_suggestions
    SET status = 'converted', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    WHERE id = target_suggestion_id;
  END IF;

  INSERT INTO public.match_audit_log(match_id, actor_id, action, new_data)
  VALUES (created_match.id, auth.uid(), 'proposal_created', to_jsonb(created_match));
  RETURN created_match;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_match_suggestions_after_registration_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_event_match_suggestions(OLD.event_id);
    RETURN OLD;
  END IF;
  PERFORM public.refresh_event_match_suggestions(NEW.event_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_registration ON public.event_registrations;
DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_registration_write ON public.event_registrations;
DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_registration_update ON public.event_registrations;
CREATE TRIGGER trg_refresh_suggestions_from_registration_write
  AFTER INSERT OR DELETE ON public.event_registrations
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 3)
  EXECUTE FUNCTION public.refresh_match_suggestions_after_registration_change();
CREATE TRIGGER trg_refresh_suggestions_from_registration_update
  AFTER UPDATE OF
    eligibility_status, registered_discipline, registered_weight_class,
    weigh_in_weight, age_at_event, gender_division, experience_level,
    record_wins, record_losses, record_draws, ko_wins, tko_wins, ko_losses, tko_losses,
    skill_rating, team_name, ruleset, availability_confirmed, available_from, available_to,
    requested_weight_kg, acceptable_weight_min_kg, acceptable_weight_max_kg,
    special_restrictions, last_fight_at, last_ko_loss_at
  ON public.event_registrations
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 3)
  EXECUTE FUNCTION public.refresh_match_suggestions_after_registration_change();

CREATE OR REPLACE FUNCTION public.refresh_match_suggestions_after_event_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_event_match_suggestions(OLD.event_id);
    RETURN OLD;
  END IF;
  PERFORM public.refresh_event_match_suggestions(NEW.event_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_settings ON public.event_matchmaking_settings;
CREATE TRIGGER trg_refresh_suggestions_from_settings
  AFTER INSERT OR DELETE OR UPDATE ON public.event_matchmaking_settings
  FOR EACH ROW EXECUTE FUNCTION public.refresh_match_suggestions_after_event_change();
DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_match ON public.matches;
DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_match_write ON public.matches;
DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_match_update ON public.matches;
CREATE TRIGGER trg_refresh_suggestions_from_match_write
  AFTER INSERT OR DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.refresh_match_suggestions_after_event_change();
CREATE TRIGGER trg_refresh_suggestions_from_match_update
  AFTER UPDATE OF match_status, fighter_a_registration_id, fighter_b_registration_id
  ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.refresh_match_suggestions_after_event_change();
DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_bout ON public.bouts;
DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_bout_write ON public.bouts;
DROP TRIGGER IF EXISTS trg_refresh_suggestions_from_bout_update ON public.bouts;
CREATE TRIGGER trg_refresh_suggestions_from_bout_write
  AFTER INSERT OR DELETE ON public.bouts
  FOR EACH ROW EXECUTE FUNCTION public.refresh_match_suggestions_after_event_change();
CREATE TRIGGER trg_refresh_suggestions_from_bout_update
  AFTER UPDATE OF status, fighter_a_registration_id, fighter_b_registration_id
  ON public.bouts
  FOR EACH ROW EXECUTE FUNCTION public.refresh_match_suggestions_after_event_change();

REVOKE ALL ON FUNCTION public.compatibility_component(numeric,numeric,integer,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.event_registration_assignment_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.event_registration_matchup_history(uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_event_match_suggestions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.regenerate_event_match_suggestions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_match_suggestion(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propose_event_match_registrations(uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_event_match_suggestions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_match_suggestion(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.propose_event_match_registrations(uuid,uuid,uuid,uuid) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_suggestions FROM anon, authenticated;

-- Populate suggestions for existing events after all helper functions exist.
DO $$
DECLARE
  target_event uuid;
BEGIN
  FOR target_event IN SELECT DISTINCT event_id FROM public.event_registrations LOOP
    PERFORM public.refresh_event_match_suggestions(target_event);
  END LOOP;
END;
$$;
