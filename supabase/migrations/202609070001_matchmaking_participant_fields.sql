-- Matchmaking-to-presentation pipeline: participant fields and manual event entry.
-- Additive migration. Existing platform fighter registrations remain valid.

-- ---------------------------------------------------------------------------
-- Fighter profile fields used by matchmaking and presentation.
-- ---------------------------------------------------------------------------

ALTER TABLE public.fighters
  ADD COLUMN IF NOT EXISTS gender_division text,
  ADD COLUMN IF NOT EXISTS ko_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tko_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ko_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tko_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skill_rating numeric(4,2),
  ADD COLUMN IF NOT EXISTS preferred_rulesets text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requested_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS acceptable_weight_min_kg numeric,
  ADD COLUMN IF NOT EXISTS acceptable_weight_max_kg numeric,
  ADD COLUMN IF NOT EXISTS special_restrictions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_fight_at date,
  ADD COLUMN IF NOT EXISTS last_ko_loss_at date;

ALTER TABLE public.fighters
  DROP CONSTRAINT IF EXISTS fighters_ko_wins_nonnegative,
  DROP CONSTRAINT IF EXISTS fighters_tko_wins_nonnegative,
  DROP CONSTRAINT IF EXISTS fighters_ko_losses_nonnegative,
  DROP CONSTRAINT IF EXISTS fighters_tko_losses_nonnegative,
  DROP CONSTRAINT IF EXISTS fighters_skill_rating_range,
  DROP CONSTRAINT IF EXISTS fighters_acceptable_weight_range;

ALTER TABLE public.fighters
  ADD CONSTRAINT fighters_ko_wins_nonnegative CHECK (ko_wins >= 0),
  ADD CONSTRAINT fighters_tko_wins_nonnegative CHECK (tko_wins >= 0),
  ADD CONSTRAINT fighters_ko_losses_nonnegative CHECK (ko_losses >= 0),
  ADD CONSTRAINT fighters_tko_losses_nonnegative CHECK (tko_losses >= 0),
  ADD CONSTRAINT fighters_skill_rating_range CHECK (skill_rating IS NULL OR skill_rating BETWEEN 1 AND 10),
  ADD CONSTRAINT fighters_acceptable_weight_range CHECK (
    acceptable_weight_min_kg IS NULL
    OR acceptable_weight_max_kg IS NULL
    OR acceptable_weight_min_kg <= acceptable_weight_max_kg
  );

ALTER TABLE public.manual_fighters
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender_division text,
  ADD COLUMN IF NOT EXISTS exact_weight numeric,
  ADD COLUMN IF NOT EXISTS ko_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tko_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ko_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tko_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skill_rating numeric(4,2),
  ADD COLUMN IF NOT EXISTS preferred_rulesets text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requested_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS acceptable_weight_min_kg numeric,
  ADD COLUMN IF NOT EXISTS acceptable_weight_max_kg numeric,
  ADD COLUMN IF NOT EXISTS special_restrictions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS available_from date,
  ADD COLUMN IF NOT EXISTS available_to date,
  ADD COLUMN IF NOT EXISTS last_fight_at date,
  ADD COLUMN IF NOT EXISTS last_ko_loss_at date,
  ADD COLUMN IF NOT EXISTS medical_clearance_date date,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Mexico',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.manual_fighters
  DROP CONSTRAINT IF EXISTS manual_fighters_ko_wins_nonnegative,
  DROP CONSTRAINT IF EXISTS manual_fighters_tko_wins_nonnegative,
  DROP CONSTRAINT IF EXISTS manual_fighters_ko_losses_nonnegative,
  DROP CONSTRAINT IF EXISTS manual_fighters_tko_losses_nonnegative,
  DROP CONSTRAINT IF EXISTS manual_fighters_skill_rating_range,
  DROP CONSTRAINT IF EXISTS manual_fighters_acceptable_weight_range;

ALTER TABLE public.manual_fighters
  ADD CONSTRAINT manual_fighters_ko_wins_nonnegative CHECK (ko_wins >= 0),
  ADD CONSTRAINT manual_fighters_tko_wins_nonnegative CHECK (tko_wins >= 0),
  ADD CONSTRAINT manual_fighters_ko_losses_nonnegative CHECK (ko_losses >= 0),
  ADD CONSTRAINT manual_fighters_tko_losses_nonnegative CHECK (tko_losses >= 0),
  ADD CONSTRAINT manual_fighters_skill_rating_range CHECK (skill_rating IS NULL OR skill_rating BETWEEN 1 AND 10),
  ADD CONSTRAINT manual_fighters_acceptable_weight_range CHECK (
    acceptable_weight_min_kg IS NULL
    OR acceptable_weight_max_kg IS NULL
    OR acceptable_weight_min_kg <= acceptable_weight_max_kg
  );

DROP TRIGGER IF EXISTS trg_manual_fighters_updated_at ON public.manual_fighters;
CREATE TRIGGER trg_manual_fighters_updated_at
  BEFORE UPDATE ON public.manual_fighters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Event registrations become the canonical event-participant record.
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_registrations
  ALTER COLUMN fighter_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS manual_fighter_id uuid REFERENCES public.manual_fighters(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS registration_source text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS ko_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tko_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ko_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tko_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skill_rating numeric(4,2),
  ADD COLUMN IF NOT EXISTS requested_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS acceptable_weight_min_kg numeric,
  ADD COLUMN IF NOT EXISTS acceptable_weight_max_kg numeric,
  ADD COLUMN IF NOT EXISTS special_restrictions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS available_from date,
  ADD COLUMN IF NOT EXISTS available_to date,
  ADD COLUMN IF NOT EXISTS last_fight_at date,
  ADD COLUMN IF NOT EXISTS last_ko_loss_at date,
  ADD COLUMN IF NOT EXISTS representative_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS representative_confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS representative_confirmation_note text;

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_payment_status_check,
  DROP CONSTRAINT IF EXISTS event_registrations_participant_exclusive,
  DROP CONSTRAINT IF EXISTS event_registrations_source_check,
  DROP CONSTRAINT IF EXISTS event_registrations_ko_wins_nonnegative,
  DROP CONSTRAINT IF EXISTS event_registrations_tko_wins_nonnegative,
  DROP CONSTRAINT IF EXISTS event_registrations_ko_losses_nonnegative,
  DROP CONSTRAINT IF EXISTS event_registrations_tko_losses_nonnegative,
  DROP CONSTRAINT IF EXISTS event_registrations_skill_rating_range,
  DROP CONSTRAINT IF EXISTS event_registrations_acceptable_weight_range;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_payment_status_check
    CHECK (payment_status IN ('pending','submitted','confirmed','waived')),
  ADD CONSTRAINT event_registrations_participant_exclusive CHECK (
    (fighter_id IS NOT NULL AND manual_fighter_id IS NULL)
    OR (fighter_id IS NULL AND manual_fighter_id IS NOT NULL)
  ),
  ADD CONSTRAINT event_registrations_source_check CHECK (
    registration_source IN ('self','manager','promoter','manual_roster','event_only','invited','admin')
  ),
  ADD CONSTRAINT event_registrations_ko_wins_nonnegative CHECK (ko_wins >= 0),
  ADD CONSTRAINT event_registrations_tko_wins_nonnegative CHECK (tko_wins >= 0),
  ADD CONSTRAINT event_registrations_ko_losses_nonnegative CHECK (ko_losses >= 0),
  ADD CONSTRAINT event_registrations_tko_losses_nonnegative CHECK (tko_losses >= 0),
  ADD CONSTRAINT event_registrations_skill_rating_range CHECK (skill_rating IS NULL OR skill_rating BETWEEN 1 AND 10),
  ADD CONSTRAINT event_registrations_acceptable_weight_range CHECK (
    acceptable_weight_min_kg IS NULL
    OR acceptable_weight_max_kg IS NULL
    OR acceptable_weight_min_kg <= acceptable_weight_max_kg
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_manual_fighter_unique
  ON public.event_registrations(event_id, manual_fighter_id)
  WHERE manual_fighter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_registrations_manual_fighter
  ON public.event_registrations(manual_fighter_id)
  WHERE manual_fighter_id IS NOT NULL;

-- Event-only manual participants must not appear in the public fighter directory.
DROP POLICY IF EXISTS "manual_fighters_select_all" ON public.manual_fighters;
DROP POLICY IF EXISTS "manual_fighters_select_visible" ON public.manual_fighters;
CREATE POLICY "manual_fighters_select_visible" ON public.manual_fighters
  FOR SELECT USING (
    is_public = true
    OR manager_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.event_registrations registration
      WHERE registration.manual_fighter_id = manual_fighters.id
        AND public.is_event_operator(registration.event_id)
    )
  );

-- Backfill stable presentation and matchmaking data for existing registrations.
UPDATE public.event_registrations registration
SET display_name = COALESCE(registration.display_name, profile.full_name),
    nickname = COALESCE(registration.nickname, fighter.nickname),
    photo_url = COALESCE(registration.photo_url, fighter.photo_url, profile.photo_url),
    city = COALESCE(registration.city, profile.city),
    state = COALESCE(registration.state, fighter.state, profile.state),
    country = COALESCE(registration.country, profile.country, 'Mexico'),
    gender_division = COALESCE(registration.gender_division, fighter.gender_division),
    weigh_in_weight = COALESCE(registration.weigh_in_weight, fighter.exact_weight),
    ko_wins = COALESCE(fighter.ko_wins, 0),
    tko_wins = COALESCE(fighter.tko_wins, 0),
    ko_losses = COALESCE(fighter.ko_losses, 0),
    tko_losses = COALESCE(fighter.tko_losses, 0),
    skill_rating = COALESCE(registration.skill_rating, fighter.skill_rating),
    ruleset = COALESCE(registration.ruleset, (fighter.preferred_rulesets)[1]),
    requested_weight_kg = COALESCE(registration.requested_weight_kg, fighter.requested_weight_kg),
    acceptable_weight_min_kg = COALESCE(registration.acceptable_weight_min_kg, fighter.acceptable_weight_min_kg),
    acceptable_weight_max_kg = COALESCE(registration.acceptable_weight_max_kg, fighter.acceptable_weight_max_kg),
    special_restrictions = CASE
      WHEN cardinality(registration.special_restrictions) > 0 THEN registration.special_restrictions
      ELSE COALESCE(fighter.special_restrictions, '{}'::text[])
    END,
    available_from = COALESCE(registration.available_from, fighter.available_from),
    available_to = COALESCE(registration.available_to, fighter.available_to),
    last_fight_at = COALESCE(registration.last_fight_at, fighter.last_fight_at),
    last_ko_loss_at = COALESCE(registration.last_ko_loss_at, fighter.last_ko_loss_at),
    updated_at = now()
FROM public.fighters fighter
JOIN public.profiles profile ON profile.id = fighter.profile_id
WHERE registration.fighter_id = fighter.id;

CREATE OR REPLACE FUNCTION public.populate_event_registration_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fighter_row public.fighters%ROWTYPE;
  profile_row public.profiles%ROWTYPE;
  manual_row public.manual_fighters%ROWTYPE;
  application_row public.event_applications%ROWTYPE;
  event_day date;
BEGIN
  IF (NEW.fighter_id IS NULL) = (NEW.manual_fighter_id IS NULL) THEN
    RAISE EXCEPTION 'An event registration must reference exactly one fighter source.';
  END IF;

  SELECT event_date INTO event_day FROM public.events WHERE id = NEW.event_id;

  IF NEW.fighter_id IS NOT NULL THEN
    SELECT * INTO fighter_row FROM public.fighters WHERE id = NEW.fighter_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Fighter not found.'; END IF;
    SELECT * INTO profile_row FROM public.profiles WHERE id = fighter_row.profile_id;
    SELECT * INTO application_row
      FROM public.event_applications
      WHERE event_id = NEW.event_id AND fighter_id = NEW.fighter_id
      LIMIT 1;

    NEW.application_id := COALESCE(NEW.application_id, application_row.id);
    NEW.approval_status := COALESCE(application_row.status, NEW.approval_status, 'pending');
    NEW.display_name := COALESCE(NEW.display_name, profile_row.full_name);
    NEW.nickname := COALESCE(NEW.nickname, fighter_row.nickname);
    NEW.photo_url := COALESCE(NEW.photo_url, fighter_row.photo_url, profile_row.photo_url);
    NEW.city := COALESCE(NEW.city, profile_row.city);
    NEW.state := COALESCE(NEW.state, fighter_row.state, profile_row.state);
    NEW.country := COALESCE(NEW.country, profile_row.country, 'Mexico');
    NEW.registered_discipline := COALESCE(
      NEW.registered_discipline,
      application_row.fighter_discipline,
      (fighter_row.disciplines)[1]
    );
    NEW.registered_weight_class := COALESCE(
      NEW.registered_weight_class,
      application_row.fighter_weight_class,
      fighter_row.weight_class
    );
    NEW.weigh_in_weight := COALESCE(NEW.weigh_in_weight, fighter_row.exact_weight);
    NEW.belt_level := COALESCE(NEW.belt_level, application_row.jiu_jitsu_belt);
    NEW.experience_level := COALESCE(NEW.experience_level, fighter_row.experience_level);
    NEW.record_wins := COALESCE(fighter_row.record_wins, NEW.record_wins, 0);
    NEW.record_losses := COALESCE(fighter_row.record_losses, NEW.record_losses, 0);
    NEW.record_draws := COALESCE(fighter_row.record_draws, NEW.record_draws, 0);
    NEW.ko_wins := COALESCE(fighter_row.ko_wins, NEW.ko_wins, 0);
    NEW.tko_wins := COALESCE(fighter_row.tko_wins, NEW.tko_wins, 0);
    NEW.ko_losses := COALESCE(fighter_row.ko_losses, NEW.ko_losses, 0);
    NEW.tko_losses := COALESCE(fighter_row.tko_losses, NEW.tko_losses, 0);
    NEW.skill_rating := COALESCE(NEW.skill_rating, fighter_row.skill_rating);
    NEW.date_of_birth := COALESCE(NEW.date_of_birth, profile_row.date_of_birth);
    NEW.gender_division := COALESCE(NEW.gender_division, fighter_row.gender_division);
    NEW.team_name := COALESCE(NEW.team_name, fighter_row.gym_name);
    NEW.ruleset := COALESCE(NEW.ruleset, (fighter_row.preferred_rulesets)[1]);
    NEW.requested_weight_kg := COALESCE(NEW.requested_weight_kg, fighter_row.requested_weight_kg);
    NEW.acceptable_weight_min_kg := COALESCE(NEW.acceptable_weight_min_kg, fighter_row.acceptable_weight_min_kg);
    NEW.acceptable_weight_max_kg := COALESCE(NEW.acceptable_weight_max_kg, fighter_row.acceptable_weight_max_kg);
    IF cardinality(NEW.special_restrictions) = 0 THEN
      NEW.special_restrictions := COALESCE(fighter_row.special_restrictions, '{}'::text[]);
    END IF;
    NEW.available_from := COALESCE(NEW.available_from, fighter_row.available_from);
    NEW.available_to := COALESCE(NEW.available_to, fighter_row.available_to);
    NEW.last_fight_at := COALESCE(NEW.last_fight_at, fighter_row.last_fight_at);
    NEW.last_ko_loss_at := COALESCE(NEW.last_ko_loss_at, fighter_row.last_ko_loss_at);
    NEW.availability_confirmed := COALESCE(application_row.confirm_availability, NEW.availability_confirmed, false);
    NEW.weight_confirmed := COALESCE(application_row.confirm_weight, NEW.weight_confirmed, false);
    NEW.medical_clearance_date := COALESCE(NEW.medical_clearance_date, fighter_row.medical_clearance_date);
  ELSE
    SELECT * INTO manual_row FROM public.manual_fighters WHERE id = NEW.manual_fighter_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Manual fighter not found.'; END IF;

    NEW.display_name := COALESCE(NEW.display_name, manual_row.full_name);
    NEW.nickname := COALESCE(NEW.nickname, manual_row.nickname);
    NEW.photo_url := COALESCE(NEW.photo_url, manual_row.photo_url);
    NEW.city := COALESCE(NEW.city, manual_row.city);
    NEW.state := COALESCE(NEW.state, manual_row.state);
    NEW.country := COALESCE(NEW.country, manual_row.country, 'Mexico');
    NEW.registered_discipline := COALESCE(NEW.registered_discipline, manual_row.discipline);
    NEW.registered_weight_class := COALESCE(NEW.registered_weight_class, manual_row.weight_class);
    NEW.weigh_in_weight := COALESCE(NEW.weigh_in_weight, manual_row.exact_weight);
    NEW.experience_level := COALESCE(NEW.experience_level, manual_row.experience_level);
    NEW.record_wins := COALESCE(manual_row.record_wins, NEW.record_wins, 0);
    NEW.record_losses := COALESCE(manual_row.record_losses, NEW.record_losses, 0);
    NEW.record_draws := COALESCE(manual_row.record_draws, NEW.record_draws, 0);
    NEW.ko_wins := COALESCE(manual_row.ko_wins, NEW.ko_wins, 0);
    NEW.tko_wins := COALESCE(manual_row.tko_wins, NEW.tko_wins, 0);
    NEW.ko_losses := COALESCE(manual_row.ko_losses, NEW.ko_losses, 0);
    NEW.tko_losses := COALESCE(manual_row.tko_losses, NEW.tko_losses, 0);
    NEW.skill_rating := COALESCE(NEW.skill_rating, manual_row.skill_rating);
    NEW.date_of_birth := COALESCE(NEW.date_of_birth, manual_row.date_of_birth);
    NEW.gender_division := COALESCE(NEW.gender_division, manual_row.gender_division);
    NEW.team_name := COALESCE(NEW.team_name, manual_row.gym_name);
    NEW.ruleset := COALESCE(NEW.ruleset, (manual_row.preferred_rulesets)[1]);
    NEW.requested_weight_kg := COALESCE(NEW.requested_weight_kg, manual_row.requested_weight_kg);
    NEW.acceptable_weight_min_kg := COALESCE(NEW.acceptable_weight_min_kg, manual_row.acceptable_weight_min_kg);
    NEW.acceptable_weight_max_kg := COALESCE(NEW.acceptable_weight_max_kg, manual_row.acceptable_weight_max_kg);
    IF cardinality(NEW.special_restrictions) = 0 THEN
      NEW.special_restrictions := COALESCE(manual_row.special_restrictions, '{}'::text[]);
    END IF;
    NEW.available_from := COALESCE(NEW.available_from, manual_row.available_from);
    NEW.available_to := COALESCE(NEW.available_to, manual_row.available_to);
    NEW.last_fight_at := COALESCE(NEW.last_fight_at, manual_row.last_fight_at);
    NEW.last_ko_loss_at := COALESCE(NEW.last_ko_loss_at, manual_row.last_ko_loss_at);
    NEW.medical_clearance_date := COALESCE(NEW.medical_clearance_date, manual_row.medical_clearance_date);
  END IF;

  IF NEW.date_of_birth IS NOT NULL AND event_day IS NOT NULL THEN
    NEW.age_at_event := EXTRACT(YEAR FROM age(event_day, NEW.date_of_birth))::integer;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
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
  reasons text[] := '{}';
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

DROP TRIGGER IF EXISTS trg_evaluate_event_registration_after_change ON public.event_registrations;
DROP TRIGGER IF EXISTS trg_evaluate_event_registration_after_insert ON public.event_registrations;
DROP TRIGGER IF EXISTS trg_evaluate_event_registration_after_update ON public.event_registrations;
CREATE TRIGGER trg_evaluate_event_registration_after_insert
  AFTER INSERT ON public.event_registrations
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 2)
  EXECUTE FUNCTION public.evaluate_event_registration_after_change();
CREATE TRIGGER trg_evaluate_event_registration_after_update
  AFTER UPDATE OF
    approval_status,
    payment_status,
    display_name,
    registered_discipline,
    registered_weight_class,
    weigh_in_weight,
    requested_weight_kg,
    acceptable_weight_min_kg,
    acceptable_weight_max_kg,
    weight_confirmed,
    availability_confirmed,
    available_from,
    available_to,
    last_fight_at,
    last_ko_loss_at,
    experience_level,
    gender_division,
    ruleset,
    date_of_birth,
    minor_consent_verified_at,
    representative_confirmed_at
  ON public.event_registrations
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 2)
  EXECUTE FUNCTION public.evaluate_event_registration_after_change();

-- Event managers can remove an unneeded registration; FK protections still
-- prevent removing registrations already used by an official bout.
DROP POLICY IF EXISTS "event_registrations_manager_delete" ON public.event_registrations;
CREATE POLICY "event_registrations_manager_delete" ON public.event_registrations
  FOR DELETE USING (public.is_event_operator(event_id));

-- Re-evaluate existing registrations against the expanded rule set.
DO $$
DECLARE
  registration_uuid uuid;
BEGIN
  FOR registration_uuid IN SELECT id FROM public.event_registrations LOOP
    PERFORM public.refresh_event_registration_eligibility(registration_uuid);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Event-level promoter preferences and scoring tolerances.
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_matchmaking_settings
  ADD COLUMN IF NOT EXISTS skill_rating_tolerance numeric(4,2) NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS knockout_record_tolerance integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS prefer_local_fighters boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promoter_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score_weights jsonb NOT NULL DEFAULT jsonb_build_object(
    'weight', 25,
    'age', 10,
    'experience', 15,
    'record', 10,
    'knockout', 10,
    'skill', 15,
    'opponent_history', 5,
    'location', 5,
    'availability', 5
  );

ALTER TABLE public.event_matchmaking_settings
  DROP CONSTRAINT IF EXISTS event_matchmaking_settings_skill_tolerance,
  DROP CONSTRAINT IF EXISTS event_matchmaking_settings_knockout_tolerance,
  ADD CONSTRAINT event_matchmaking_settings_skill_tolerance CHECK (skill_rating_tolerance >= 0),
  ADD CONSTRAINT event_matchmaking_settings_knockout_tolerance CHECK (knockout_record_tolerance >= 0);

COMMENT ON COLUMN public.event_registrations.special_restrictions IS
  'Private event-operator data. Never expose this column on public fighter cards or display graphics.';
COMMENT ON COLUMN public.event_matchmaking_settings.promoter_preferences IS
  'Event-specific soft preferences. Preferences may reorder suggestions but must not bypass hard safety rules.';
