-- Recorded event weight (defaulted from the fighter profile) is the sole
-- weight used for division placement, eligibility, and matchmaking.
-- Requested weight remains informational; acceptable ranges still constrain
-- the opponent's actual weight.

CREATE OR REPLACE FUNCTION public.boxing_weight_category(
  fighter_age integer,
  fighter_weight_kg numeric
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF fighter_age IS NULL OR fighter_weight_kg IS NULL OR fighter_weight_kg <= 0 THEN
    RETURN NULL;
  END IF;

  -- The client matches divisions at one decimal place as well.
  fighter_weight_kg := round(fighter_weight_kg, 1);

  -- Existing youth boxing divisions must be calculated from the same recorded
  -- weight used by the UI; gaps outside listed ranges need manual review.
  IF fighter_age BETWEEN 6 AND 7 THEN
    RETURN CASE
      WHEN fighter_weight_kg BETWEEN 20 AND 22 THEN '20–22 kg'
      WHEN fighter_weight_kg BETWEEN 23 AND 25 THEN '23–25 kg'
      WHEN fighter_weight_kg BETWEEN 26 AND 28 THEN '26–28 kg'
      WHEN fighter_weight_kg BETWEEN 29 AND 31 THEN '29–31 kg'
      ELSE NULL
    END;
  END IF;

  IF fighter_age BETWEEN 8 AND 9 THEN
    RETURN CASE
      WHEN fighter_weight_kg BETWEEN 24 AND 27 THEN '24–27 kg'
      WHEN fighter_weight_kg BETWEEN 28 AND 31 THEN '28–31 kg'
      WHEN fighter_weight_kg BETWEEN 32 AND 35 THEN '32–35 kg'
      WHEN fighter_weight_kg BETWEEN 36 AND 39 THEN '36–39 kg'
      ELSE NULL
    END;
  END IF;

  IF fighter_age BETWEEN 10 AND 11 THEN
    RETURN CASE
      WHEN fighter_weight_kg BETWEEN 28 AND 31 THEN '28–31 kg'
      WHEN fighter_weight_kg BETWEEN 32 AND 35 THEN '32–35 kg'
      WHEN fighter_weight_kg BETWEEN 36 AND 39 THEN '36–39 kg'
      WHEN fighter_weight_kg BETWEEN 40 AND 43 THEN '40–43 kg'
      WHEN fighter_weight_kg BETWEEN 44 AND 47 THEN '44–47 kg'
      ELSE NULL
    END;
  END IF;

  IF fighter_age = 12 THEN
    RETURN CASE
      WHEN fighter_weight_kg BETWEEN 32 AND 35 THEN '32–35 kg'
      WHEN fighter_weight_kg BETWEEN 36 AND 39 THEN '36–39 kg'
      WHEN fighter_weight_kg BETWEEN 40 AND 43 THEN '40–43 kg'
      WHEN fighter_weight_kg BETWEEN 44 AND 47 THEN '44–47 kg'
      WHEN fighter_weight_kg BETWEEN 48 AND 51 THEN '48–51 kg'
      ELSE NULL
    END;
  END IF;

  IF fighter_age BETWEEN 13 AND 14 THEN
    RETURN CASE
      WHEN fighter_weight_kg < 35 THEN NULL
      WHEN fighter_weight_kg <= 37 THEN '35–37 kg'
      WHEN fighter_weight_kg <= 40 THEN '37.1–40 kg'
      WHEN fighter_weight_kg <= 42 THEN '40.1–42 kg'
      WHEN fighter_weight_kg <= 44 THEN '42.1–44 kg'
      WHEN fighter_weight_kg <= 46 THEN '44.1–46 kg'
      WHEN fighter_weight_kg <= 48 THEN '46.1–48 kg'
      WHEN fighter_weight_kg <= 50 THEN '48.1–50 kg'
      WHEN fighter_weight_kg <= 53 THEN '50.1–53 kg'
      WHEN fighter_weight_kg <= 55 THEN '53.1–55 kg'
      WHEN fighter_weight_kg <= 57 THEN '55.1–57 kg'
      WHEN fighter_weight_kg <= 60 THEN '57.1–60 kg'
      WHEN fighter_weight_kg <= 63 THEN '60.1–63 kg'
      WHEN fighter_weight_kg <= 66 THEN '63.1–66 kg'
      WHEN fighter_weight_kg <= 69 THEN '66.1–69 kg'
      WHEN fighter_weight_kg <= 72 THEN '69.1–72 kg'
      WHEN fighter_weight_kg <= 75 THEN '72.1–75 kg'
      WHEN fighter_weight_kg <= 78 THEN '75.1–78 kg'
      WHEN fighter_weight_kg <= 81 THEN '78.1–81 kg'
      WHEN fighter_weight_kg <= 85 THEN '81.1–85 kg'
      WHEN fighter_weight_kg <= 90 THEN '85.1–90 kg'
      ELSE '90.1 kg o más'
    END;
  END IF;

  IF fighter_age BETWEEN 15 AND 17 THEN
    RETURN CASE
      WHEN fighter_weight_kg < 46 THEN NULL
      WHEN fighter_weight_kg <= 48 THEN '46–48 kg'
      WHEN fighter_weight_kg <= 51 THEN '48.1–51 kg'
      WHEN fighter_weight_kg <= 54 THEN '51.1–54 kg'
      WHEN fighter_weight_kg <= 57 THEN '54.1–57 kg'
      WHEN fighter_weight_kg <= 60 THEN '57.1–60 kg'
      WHEN fighter_weight_kg <= 63 THEN '60.1–63 kg'
      WHEN fighter_weight_kg <= 66 THEN '63.1–66 kg'
      WHEN fighter_weight_kg <= 69 THEN '66.1–69 kg'
      WHEN fighter_weight_kg <= 72 THEN '69.1–72 kg'
      WHEN fighter_weight_kg <= 75 THEN '72.1–75 kg'
      WHEN fighter_weight_kg <= 78 THEN '75.1–78 kg'
      WHEN fighter_weight_kg <= 81 THEN '78.1–81 kg'
      WHEN fighter_weight_kg <= 85 THEN '81.1–85 kg'
      WHEN fighter_weight_kg <= 90 THEN '85.1–90 kg'
      ELSE '90.1 kg o más'
    END;
  END IF;

  IF fighter_age >= 18 THEN
    RETURN CASE
      WHEN fighter_weight_kg < 46 THEN NULL
      WHEN fighter_weight_kg <= 48 THEN '46–48 kg'
      WHEN fighter_weight_kg <= 51 THEN '48.1–51 kg'
      WHEN fighter_weight_kg <= 54 THEN '51.1–54 kg'
      WHEN fighter_weight_kg <= 57 THEN '54.1–57 kg'
      WHEN fighter_weight_kg <= 60 THEN '57.1–60 kg'
      WHEN fighter_weight_kg <= 63 THEN '60.1–63 kg'
      WHEN fighter_weight_kg <= 66 THEN '63.1–66 kg'
      WHEN fighter_weight_kg <= 69 THEN '66.1–69 kg'
      WHEN fighter_weight_kg <= 72 THEN '69.1–72 kg'
      WHEN fighter_weight_kg <= 76 THEN '72.1–76 kg'
      WHEN fighter_weight_kg <= 80 THEN '76.1–80 kg'
      WHEN fighter_weight_kg <= 85 THEN '80.1–85 kg'
      WHEN fighter_weight_kg <= 90 THEN '85.1–90 kg'
      WHEN fighter_weight_kg <= 95 THEN '90.1–95 kg'
      ELSE '95.1 kg o más (A+)'
    END;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_boxing_registration_weight_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_day date;
  calculated_age integer;
  calculated_category text;
BEGIN
  IF lower(trim(COALESCE(NEW.registered_discipline, ''))) <> 'boxeo' THEN
    RETURN NEW;
  END IF;

  SELECT event_date INTO event_day FROM public.events WHERE id = NEW.event_id;
  calculated_age := CASE
    WHEN NEW.date_of_birth IS NOT NULL AND event_day IS NOT NULL
      THEN EXTRACT(YEAR FROM age(event_day, NEW.date_of_birth))::integer
    ELSE NEW.age_at_event
  END;
  NEW.age_at_event := calculated_age;
  calculated_category := public.boxing_weight_category(calculated_age, NEW.weigh_in_weight);

  -- A stale/manual label must never stand in for a missing or changed weight.
  NEW.registered_weight_class := calculated_category;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_z_assign_boxing_registration_weight_category
  ON public.event_registrations;
CREATE TRIGGER trg_z_assign_boxing_registration_weight_category
  BEFORE INSERT OR UPDATE OF registered_discipline, registered_weight_class,
    weigh_in_weight, date_of_birth, age_at_event
  ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.assign_boxing_registration_weight_category();

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
  calculated_boxing_category text;
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
  IF registration_row.weigh_in_weight IS NULL OR registration_row.weigh_in_weight <= 0 THEN
    reasons := array_append(reasons, 'actual_weight_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  ELSIF lower(trim(COALESCE(registration_row.registered_discipline, ''))) = 'boxeo'
    AND registration_row.age_at_event >= 6 THEN
    calculated_boxing_category := public.boxing_weight_category(
      registration_row.age_at_event, registration_row.weigh_in_weight
    );
    IF calculated_boxing_category IS NULL THEN
      reasons := array_append(reasons, 'boxing_weight_category_unavailable');
      IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
    ELSIF registration_row.registered_weight_class IS NOT NULL
      AND registration_row.registered_weight_class IS DISTINCT FROM calculated_boxing_category THEN
      reasons := array_append(reasons, 'boxing_weight_category_mismatch');
      IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
    END IF;
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
      eligibility_rule_version = 5,
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

-- Refresh only registrations previously considered eligible with insufficient
-- actual-weight/category data. Suppress repeated pair rebuilds during this
-- targeted correction; all other records keep their existing workflow state.
DO $$
DECLARE
  registration_uuid uuid;
BEGIN
  PERFORM set_config('strikers.skip_match_suggestion_refresh', 'on', true);
  FOR registration_uuid IN
    SELECT id
    FROM public.event_registrations
    WHERE eligibility_status = 'eligible'
      AND (
        weigh_in_weight IS NULL OR weigh_in_weight <= 0
        OR (
          lower(trim(COALESCE(registered_discipline, ''))) = 'boxeo'
          AND age_at_event >= 6
          AND registered_weight_class IS DISTINCT FROM
            public.boxing_weight_category(age_at_event, weigh_in_weight)
        )
      )
  LOOP
    PERFORM public.refresh_event_registration_eligibility(registration_uuid);
  END LOOP;
  PERFORM set_config('strikers.skip_match_suggestion_refresh', '', true);
END;
$$;

-- Do not leave an already-persisted recommendation marked eligible when one
-- of its fighters is now missing a real weight or valid boxing category.
UPDATE public.match_suggestions suggestion
SET is_eligible = false,
    compatibility_score = 0,
    hard_failures = COALESCE(suggestion.hard_failures, ARRAY[]::text[])
      || array_remove(ARRAY[
        CASE WHEN registration_a.eligibility_status <> 'eligible'
          THEN 'fighter_a_not_eligible' END,
        CASE WHEN registration_b.eligibility_status <> 'eligible'
          THEN 'fighter_b_not_eligible' END,
        CASE WHEN registration_a.weigh_in_weight IS NULL OR registration_a.weigh_in_weight <= 0
            OR registration_b.weigh_in_weight IS NULL OR registration_b.weigh_in_weight <= 0
          THEN 'exact_weight_missing' END
      ]::text[], NULL),
    updated_at = now()
FROM public.event_registrations registration_a,
     public.event_registrations registration_b
WHERE suggestion.fighter_a_registration_id = registration_a.id
  AND suggestion.fighter_b_registration_id = registration_b.id
  AND suggestion.is_eligible
  AND (
    registration_a.eligibility_status <> 'eligible'
    OR registration_b.eligibility_status <> 'eligible'
    OR registration_a.weigh_in_weight IS NULL OR registration_a.weigh_in_weight <= 0
    OR registration_b.weigh_in_weight IS NULL OR registration_b.weigh_in_weight <= 0
  );

NOTIFY pgrst, 'reload schema';
