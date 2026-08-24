-- ============================================================
-- Event Engine Phase 1 — registration and eligibility foundation
-- Additive only: existing application, payment, and match flows remain valid.
-- ============================================================

-- The application already reads and writes this field, but the historical
-- migrations did not create it. Track it here so clean environments match the
-- TypeScript Fighter model.
ALTER TABLE public.fighters
  ADD COLUMN IF NOT EXISTS experience_level text NOT NULL DEFAULT 'amateur'
    CHECK (experience_level IN ('amateur', 'pro'));

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS application_id uuid
    REFERENCES public.event_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS eligibility_status text NOT NULL DEFAULT 'pending'
    CHECK (eligibility_status IN ('pending', 'review_required', 'eligible', 'ineligible')),
  ADD COLUMN IF NOT EXISTS eligibility_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS eligibility_evaluated_at timestamptz,
  ADD COLUMN IF NOT EXISTS eligibility_rule_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS registered_discipline text,
  ADD COLUMN IF NOT EXISTS registered_weight_class text,
  ADD COLUMN IF NOT EXISTS weigh_in_weight numeric,
  ADD COLUMN IF NOT EXISTS weigh_in_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS belt_level text,
  ADD COLUMN IF NOT EXISTS experience_level text,
  ADD COLUMN IF NOT EXISTS record_wins integer,
  ADD COLUMN IF NOT EXISTS record_losses integer,
  ADD COLUMN IF NOT EXISTS record_draws integer,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS age_at_event integer,
  ADD COLUMN IF NOT EXISTS age_class text,
  ADD COLUMN IF NOT EXISTS gender_division text,
  ADD COLUMN IF NOT EXISTS team_name text,
  ADD COLUMN IF NOT EXISTS ruleset text,
  ADD COLUMN IF NOT EXISTS bout_format text,
  ADD COLUMN IF NOT EXISTS availability_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weight_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_clearance_date date,
  ADD COLUMN IF NOT EXISTS medical_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS minor_consent_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_application_unique
  ON public.event_registrations(application_id)
  WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_eligibility
  ON public.event_registrations(event_id, eligibility_status);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_approval
  ON public.event_registrations(event_id, approval_status);

-- Populate immutable-at-registration source data without changing legacy callers.
CREATE OR REPLACE FUNCTION public.populate_event_registration_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fighter_row public.fighters%ROWTYPE;
  profile_row public.profiles%ROWTYPE;
  application_row public.event_applications%ROWTYPE;
  event_day date;
BEGIN
  SELECT * INTO fighter_row FROM public.fighters WHERE id = NEW.fighter_id;
  SELECT * INTO profile_row FROM public.profiles WHERE id = fighter_row.profile_id;
  SELECT * INTO application_row
    FROM public.event_applications
    WHERE event_id = NEW.event_id AND fighter_id = NEW.fighter_id
    LIMIT 1;
  SELECT event_date INTO event_day FROM public.events WHERE id = NEW.event_id;

  NEW.application_id := COALESCE(NEW.application_id, application_row.id);
  NEW.approval_status := COALESCE(application_row.status, NEW.approval_status, 'pending');
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
  NEW.belt_level := COALESCE(NEW.belt_level, application_row.jiu_jitsu_belt);
  NEW.experience_level := COALESCE(NEW.experience_level, fighter_row.experience_level);
  NEW.record_wins := COALESCE(NEW.record_wins, fighter_row.record_wins);
  NEW.record_losses := COALESCE(NEW.record_losses, fighter_row.record_losses);
  NEW.record_draws := COALESCE(NEW.record_draws, fighter_row.record_draws);
  NEW.date_of_birth := COALESCE(NEW.date_of_birth, profile_row.date_of_birth);
  NEW.team_name := COALESCE(NEW.team_name, fighter_row.gym_name);
  NEW.availability_confirmed := COALESCE(
    application_row.confirm_availability,
    NEW.availability_confirmed,
    false
  );
  NEW.weight_confirmed := COALESCE(
    application_row.confirm_weight,
    NEW.weight_confirmed,
    false
  );
  NEW.medical_clearance_date := COALESCE(
    NEW.medical_clearance_date,
    fighter_row.medical_clearance_date
  );

  IF NEW.date_of_birth IS NOT NULL AND event_day IS NOT NULL THEN
    NEW.age_at_event := EXTRACT(YEAR FROM age(event_day, NEW.date_of_birth))::integer;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_event_registration_snapshot
  ON public.event_registrations;
CREATE TRIGGER trg_populate_event_registration_snapshot
  BEFORE INSERT ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_event_registration_snapshot();

-- Eligibility is deliberately conservative until event-specific rules exist.
-- Missing safety data requires review instead of silently passing.
CREATE OR REPLACE FUNCTION public.refresh_event_registration_eligibility(
  registration_uuid uuid
)
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event registration not found';
  END IF;

  SELECT event_date INTO event_day
    FROM public.events
    WHERE id = registration_row.event_id;

  IF registration_row.approval_status IN ('declined', 'withdrawn') THEN
    reasons := array_append(reasons, 'application_not_approved');
    next_status := 'ineligible';
  ELSIF registration_row.approval_status <> 'accepted' THEN
    reasons := array_append(reasons, 'application_pending');
    next_status := 'pending';
  END IF;

  IF registration_row.payment_status <> 'confirmed' THEN
    reasons := array_append(reasons, 'payment_not_confirmed');
    IF next_status = 'eligible' THEN next_status := 'pending'; END IF;
  END IF;

  IF registration_row.registered_discipline IS NULL THEN
    reasons := array_append(reasons, 'discipline_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  END IF;

  IF registration_row.registered_weight_class IS NULL THEN
    reasons := array_append(reasons, 'weight_class_missing');
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

  IF registration_row.date_of_birth IS NULL THEN
    reasons := array_append(reasons, 'date_of_birth_missing');
    IF next_status = 'eligible' THEN next_status := 'review_required'; END IF;
  ELSIF event_day IS NOT NULL THEN
    is_minor := EXTRACT(YEAR FROM age(event_day, registration_row.date_of_birth)) < 18;
  END IF;

  IF is_minor THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.parental_consents pc
      JOIN public.fighters f ON f.profile_id = pc.fighter_profile_id
      WHERE f.id = registration_row.fighter_id
    ) INTO has_consent;

    IF NOT has_consent THEN
      reasons := array_append(reasons, 'minor_consent_missing');
      next_status := 'ineligible';
    END IF;
  END IF;

  UPDATE public.event_registrations
  SET eligibility_status = next_status,
      eligibility_reasons = reasons,
      eligibility_evaluated_at = now(),
      updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;

  RETURN registration_row;
END;
$$;

-- Keep application state and event-specific answers synchronized during the
-- compatibility period. The application remains available to existing UI.
CREATE OR REPLACE FUNCTION public.sync_application_to_event_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_id uuid;
BEGIN
  UPDATE public.event_registrations
  SET application_id = NEW.id,
      approval_status = NEW.status,
      registered_discipline = COALESCE(NEW.fighter_discipline, registered_discipline),
      registered_weight_class = COALESCE(NEW.fighter_weight_class, registered_weight_class),
      belt_level = COALESCE(NEW.jiu_jitsu_belt, belt_level),
      availability_confirmed = NEW.confirm_availability,
      weight_confirmed = NEW.confirm_weight,
      updated_at = now()
  WHERE event_id = NEW.event_id AND fighter_id = NEW.fighter_id
  RETURNING id INTO registration_id;

  IF registration_id IS NOT NULL THEN
    PERFORM public.refresh_event_registration_eligibility(registration_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_application_to_event_registration
  ON public.event_applications;
CREATE TRIGGER trg_sync_application_to_event_registration
  AFTER INSERT OR UPDATE OF status, fighter_discipline, fighter_weight_class,
    jiu_jitsu_belt, confirm_availability, confirm_weight
  ON public.event_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_application_to_event_registration();

CREATE OR REPLACE FUNCTION public.evaluate_event_registration_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_event_registration_eligibility(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluate_event_registration_after_change
  ON public.event_registrations;
CREATE TRIGGER trg_evaluate_event_registration_after_change
  AFTER INSERT OR UPDATE OF payment_status
  ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.evaluate_event_registration_after_change();

DROP TRIGGER IF EXISTS trg_event_registrations_updated_at
  ON public.event_registrations;
CREATE TRIGGER trg_event_registrations_updated_at
  BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Backfill existing registration snapshots without deleting or replacing data.
UPDATE public.event_registrations registration
SET registered_discipline = COALESCE(
      registration.registered_discipline,
      (fighter.disciplines)[1]
    ),
    registered_weight_class = COALESCE(registration.registered_weight_class, fighter.weight_class),
    experience_level = COALESCE(registration.experience_level, fighter.experience_level),
    record_wins = COALESCE(registration.record_wins, fighter.record_wins),
    record_losses = COALESCE(registration.record_losses, fighter.record_losses),
    record_draws = COALESCE(registration.record_draws, fighter.record_draws),
    date_of_birth = COALESCE(registration.date_of_birth, profile.date_of_birth),
    team_name = COALESCE(registration.team_name, fighter.gym_name),
    medical_clearance_date = COALESCE(
      registration.medical_clearance_date,
      fighter.medical_clearance_date
    ),
    updated_at = now()
FROM public.fighters fighter
JOIN public.profiles profile ON profile.id = fighter.profile_id
WHERE registration.fighter_id = fighter.id;

UPDATE public.event_registrations registration
SET application_id = application.id,
    approval_status = application.status,
    registered_discipline = COALESCE(
      registration.registered_discipline,
      application.fighter_discipline
    ),
    registered_weight_class = COALESCE(
      registration.registered_weight_class,
      application.fighter_weight_class
    ),
    belt_level = COALESCE(registration.belt_level, application.jiu_jitsu_belt),
    availability_confirmed = application.confirm_availability,
    weight_confirmed = application.confirm_weight,
    updated_at = now()
FROM public.event_applications application
WHERE application.fighter_id = registration.fighter_id
  AND application.event_id = registration.event_id;

DO $$
DECLARE
  registration_id uuid;
BEGIN
  FOR registration_id IN SELECT id FROM public.event_registrations LOOP
    PERFORM public.refresh_event_registration_eligibility(registration_id);
  END LOOP;
END;
$$;

COMMENT ON COLUMN public.event_registrations.eligibility_reasons IS
  'Stable reason codes for admin UI and audit; not translated display strings.';

-- Eligibility refresh is an internal invariant used by trusted triggers. It is
-- not a public SECURITY DEFINER endpoint.
REVOKE ALL ON FUNCTION public.refresh_event_registration_eligibility(uuid)
  FROM PUBLIC;
