-- Matchmaking-to-presentation pipeline: manual participant registration and
-- registration-based match proposals.

CREATE OR REPLACE FUNCTION public.jsonb_text_array(value jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN value IS NULL OR jsonb_typeof(value) <> 'array' THEN '{}'::text[]
    ELSE COALESCE(ARRAY(SELECT jsonb_array_elements_text(value)), '{}'::text[])
  END;
$$;

CREATE OR REPLACE FUNCTION public.safe_registration_payment_status(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF COALESCE(value, 'waived') NOT IN ('pending','submitted','confirmed','waived') THEN
    RAISE EXCEPTION 'Invalid registration payment status.';
  END IF;
  RETURN COALESCE(value, 'waived');
END;
$$;

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
  actor_role text;
  full_name_value text;
  representative_confirmed boolean;
BEGIN
  PERFORM public.assert_event_operator(target_event_id);
  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();

  full_name_value := nullif(trim(fighter_payload->>'full_name'), '');
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
    auth.uid(), full_name_value, nullif(trim(fighter_payload->>'nickname'), ''),
    nullif(trim(fighter_payload->>'weight_class'), ''),
    nullif(trim(fighter_payload->>'discipline'), ''),
    COALESCE(nullif(fighter_payload->>'record_wins', '')::integer, 0),
    COALESCE(nullif(fighter_payload->>'record_losses', '')::integer, 0),
    COALESCE(nullif(fighter_payload->>'record_draws', '')::integer, 0),
    nullif(trim(fighter_payload->>'phone'), ''),
    nullif(trim(fighter_payload->>'email'), ''),
    nullif(trim(fighter_payload->>'city'), ''),
    nullif(trim(fighter_payload->>'state'), ''),
    COALESCE(nullif(trim(fighter_payload->>'country'), ''), 'Mexico'),
    nullif(trim(fighter_payload->>'gym_name'), ''),
    COALESCE(nullif(trim(fighter_payload->>'experience_level'), ''), 'amateur'),
    nullif(trim(fighter_payload->>'notes'), ''),
    nullif(trim(fighter_payload->>'photo_url'), ''),
    nullif(trim(fighter_payload->>'bio'), ''),
    nullif(fighter_payload->>'height_cm', '')::integer,
    nullif(fighter_payload->>'reach_cm', '')::integer,
    COALESCE((fighter_payload->>'is_available')::boolean, true),
    publish_to_roster,
    nullif(fighter_payload->>'date_of_birth', '')::date,
    nullif(trim(fighter_payload->>'gender_division'), ''),
    nullif(fighter_payload->>'exact_weight', '')::numeric,
    COALESCE(nullif(fighter_payload->>'ko_wins', '')::integer, 0),
    COALESCE(nullif(fighter_payload->>'tko_wins', '')::integer, 0),
    COALESCE(nullif(fighter_payload->>'ko_losses', '')::integer, 0),
    COALESCE(nullif(fighter_payload->>'tko_losses', '')::integer, 0),
    nullif(fighter_payload->>'skill_rating', '')::numeric,
    public.jsonb_text_array(fighter_payload->'preferred_rulesets'),
    nullif(fighter_payload->>'requested_weight_kg', '')::numeric,
    nullif(fighter_payload->>'acceptable_weight_min_kg', '')::numeric,
    nullif(fighter_payload->>'acceptable_weight_max_kg', '')::numeric,
    public.jsonb_text_array(fighter_payload->'special_restrictions'),
    nullif(fighter_payload->>'available_from', '')::date,
    nullif(fighter_payload->>'available_to', '')::date,
    nullif(fighter_payload->>'medical_clearance_date', '')::date,
    nullif(fighter_payload->>'last_fight_at', '')::date,
    nullif(fighter_payload->>'last_ko_loss_at', '')::date
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
    nullif(trim(fighter_payload->>'discipline'), ''),
    nullif(trim(fighter_payload->>'weight_class'), ''),
    nullif(fighter_payload->>'exact_weight', '')::numeric,
    nullif(trim(fighter_payload->>'gender_division'), ''),
    COALESCE(nullif(trim(fighter_payload->>'experience_level'), ''), 'amateur'),
    nullif(trim(fighter_payload->>'ruleset'), ''),
    nullif(trim(fighter_payload->>'bout_format'), ''),
    COALESCE((fighter_payload->>'availability_confirmed')::boolean, false),
    COALESCE((fighter_payload->>'weight_confirmed')::boolean, false),
    now(), auth.uid(),
    COALESCE(nullif(trim(fighter_payload->>'representative_confirmation_note'), ''),
      'Authorization recorded by event operator.'),
    CASE WHEN COALESCE((fighter_payload->>'minor_consent_confirmed')::boolean, false) THEN now() ELSE NULL END
  ) RETURNING * INTO created_registration;

  RETURN created_registration;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_manual_fighter_for_event(
  target_event_id uuid,
  target_manual_fighter_id uuid,
  registration_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manual_row public.manual_fighters%ROWTYPE;
  created_registration public.event_registrations%ROWTYPE;
BEGIN
  PERFORM public.assert_event_operator(target_event_id);

  SELECT * INTO manual_row
  FROM public.manual_fighters
  WHERE id = target_manual_fighter_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Manual fighter not found.'; END IF;
  IF manual_row.manager_id <> auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only the fighter representative can add this roster fighter.';
  END IF;
  IF NOT COALESCE((registration_payload->>'representative_confirmed')::boolean, false) THEN
    RAISE EXCEPTION 'Representative authorization must be confirmed.';
  END IF;

  INSERT INTO public.event_registrations (
    event_id, manual_fighter_id, registration_source, created_by,
    approval_status, payment_status,
    registered_discipline, registered_weight_class, weigh_in_weight,
    gender_division, experience_level, ruleset, bout_format,
    availability_confirmed, weight_confirmed,
    representative_confirmed_at, representative_confirmed_by,
    representative_confirmation_note, minor_consent_verified_at
  ) VALUES (
    target_event_id, manual_row.id, 'manual_roster', auth.uid(),
    'accepted', public.safe_registration_payment_status(registration_payload->>'payment_status'),
    COALESCE(nullif(trim(registration_payload->>'discipline'), ''), manual_row.discipline),
    COALESCE(nullif(trim(registration_payload->>'weight_class'), ''), manual_row.weight_class),
    COALESCE(nullif(registration_payload->>'exact_weight', '')::numeric, manual_row.exact_weight),
    COALESCE(nullif(trim(registration_payload->>'gender_division'), ''), manual_row.gender_division),
    COALESCE(nullif(trim(registration_payload->>'experience_level'), ''), manual_row.experience_level),
    COALESCE(nullif(trim(registration_payload->>'ruleset'), ''), (manual_row.preferred_rulesets)[1]),
    nullif(trim(registration_payload->>'bout_format'), ''),
    COALESCE((registration_payload->>'availability_confirmed')::boolean, false),
    COALESCE((registration_payload->>'weight_confirmed')::boolean, false),
    now(), auth.uid(),
    COALESCE(nullif(trim(registration_payload->>'representative_confirmation_note'), ''),
      'Authorization recorded by event operator.'),
    CASE WHEN COALESCE((registration_payload->>'minor_consent_confirmed')::boolean, false) THEN now() ELSE NULL END
  )
  ON CONFLICT (event_id, manual_fighter_id) WHERE manual_fighter_id IS NOT NULL
  DO UPDATE SET updated_at = now()
  RETURNING * INTO created_registration;

  RETURN created_registration;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_platform_fighter_for_event(
  target_event_id uuid,
  target_fighter_id uuid,
  registration_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_registration public.event_registrations%ROWTYPE;
  actor_role text;
  source_value text;
BEGIN
  PERFORM public.assert_event_operator(target_event_id);
  IF NOT EXISTS (SELECT 1 FROM public.fighters WHERE id = target_fighter_id) THEN
    RAISE EXCEPTION 'Fighter not found.';
  END IF;
  IF NOT COALESCE((registration_payload->>'representative_confirmed')::boolean, false) THEN
    RAISE EXCEPTION 'Fighter authorization must be confirmed.';
  END IF;

  SELECT role INTO actor_role FROM public.profiles WHERE id = auth.uid();
  source_value := CASE actor_role
    WHEN 'manager' THEN 'manager'
    WHEN 'admin' THEN 'admin'
    ELSE 'promoter'
  END;

  INSERT INTO public.event_registrations (
    event_id, fighter_id, registration_source, created_by,
    approval_status, payment_status,
    registered_discipline, registered_weight_class, weigh_in_weight,
    gender_division, experience_level, ruleset, bout_format,
    availability_confirmed, weight_confirmed,
    representative_confirmed_at, representative_confirmed_by,
    representative_confirmation_note, minor_consent_verified_at
  ) VALUES (
    target_event_id, target_fighter_id, source_value, auth.uid(),
    'accepted', public.safe_registration_payment_status(registration_payload->>'payment_status'),
    nullif(trim(registration_payload->>'discipline'), ''),
    nullif(trim(registration_payload->>'weight_class'), ''),
    nullif(registration_payload->>'exact_weight', '')::numeric,
    nullif(trim(registration_payload->>'gender_division'), ''),
    nullif(trim(registration_payload->>'experience_level'), ''),
    nullif(trim(registration_payload->>'ruleset'), ''),
    nullif(trim(registration_payload->>'bout_format'), ''),
    COALESCE((registration_payload->>'availability_confirmed')::boolean, false),
    COALESCE((registration_payload->>'weight_confirmed')::boolean, false),
    now(), auth.uid(),
    COALESCE(nullif(trim(registration_payload->>'representative_confirmation_note'), ''),
      'Authorization recorded by event operator.'),
    CASE WHEN COALESCE((registration_payload->>'minor_consent_confirmed')::boolean, false) THEN now() ELSE NULL END
  )
  ON CONFLICT (fighter_id, event_id)
  DO UPDATE SET updated_at = now()
  RETURNING * INTO created_registration;

  RETURN created_registration;
END;
$$;

REVOKE ALL ON FUNCTION public.jsonb_text_array(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.safe_registration_payment_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_manual_event_registration(uuid,jsonb,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_manual_fighter_for_event(uuid,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_platform_fighter_for_event(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_manual_event_registration(uuid,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_manual_fighter_for_event(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_platform_fighter_for_event(uuid,uuid,jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Match proposals reference event registrations so manual participants use the
-- same proposal and bout pipeline as platform fighters.
-- ---------------------------------------------------------------------------

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS fighter_a_registration_id uuid REFERENCES public.event_registrations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS fighter_b_registration_id uuid REFERENCES public.event_registrations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS suggestion_id uuid,
  ADD COLUMN IF NOT EXISTS fighter_a_confirmation_method text,
  ADD COLUMN IF NOT EXISTS fighter_b_confirmation_method text,
  ADD COLUMN IF NOT EXISTS fighter_a_confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fighter_b_confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fighter_a_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fighter_b_confirmed_at timestamptz;

UPDATE public.matches match
SET fighter_a_registration_id = COALESCE(
      match.fighter_a_registration_id,
      (SELECT registration.id
       FROM public.event_registrations registration
       WHERE registration.event_id = match.event_id
         AND registration.fighter_id = match.fighter_a_id
       LIMIT 1)
    ),
    fighter_b_registration_id = COALESCE(
      match.fighter_b_registration_id,
      (SELECT registration.id
       FROM public.event_registrations registration
       WHERE registration.event_id = match.event_id
         AND registration.fighter_id = match.fighter_b_id
       LIMIT 1)
    );

ALTER TABLE public.matches
  ALTER COLUMN fighter_a_id DROP NOT NULL,
  ALTER COLUMN fighter_b_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS fighters_ordered,
  DROP CONSTRAINT IF EXISTS matches_registration_pair_check,
  DROP CONSTRAINT IF EXISTS matches_fighter_a_confirmation_method_check,
  DROP CONSTRAINT IF EXISTS matches_fighter_b_confirmation_method_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_registration_pair_check CHECK (
    fighter_a_registration_id IS NULL
    OR fighter_b_registration_id IS NULL
    OR fighter_a_registration_id <> fighter_b_registration_id
  ),
  ADD CONSTRAINT matches_fighter_a_confirmation_method_check CHECK (
    fighter_a_confirmation_method IS NULL OR fighter_a_confirmation_method IN ('self','proxy')
  ),
  ADD CONSTRAINT matches_fighter_b_confirmation_method_check CHECK (
    fighter_b_confirmation_method IS NULL OR fighter_b_confirmation_method IN ('self','proxy')
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_active_registration_pair_unique
  ON public.matches(event_id, fighter_a_registration_id, fighter_b_registration_id)
  WHERE match_status <> 'cancelled'
    AND fighter_a_registration_id IS NOT NULL
    AND fighter_b_registration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_registration_a ON public.matches(fighter_a_registration_id);
CREATE INDEX IF NOT EXISTS idx_matches_registration_b ON public.matches(fighter_b_registration_id);

ALTER TABLE public.bouts
  ALTER COLUMN fighter_a_id DROP NOT NULL,
  ALTER COLUMN fighter_b_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS winner_registration_id uuid REFERENCES public.event_registrations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.match_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_audit_match_created
  ON public.match_audit_log(match_id, created_at DESC);
ALTER TABLE public.match_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "match_audit_event_operator_select" ON public.match_audit_log;
CREATE POLICY "match_audit_event_operator_select" ON public.match_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.matches match
      WHERE match.id = match_id AND public.is_event_operator(match.event_id)
    )
  );

DROP POLICY IF EXISTS "matches_representative_select" ON public.matches;
CREATE POLICY "matches_representative_select" ON public.matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.manager_fighters representation
      WHERE representation.manager_id = auth.uid()
        AND representation.fighter_id IN (fighter_a_id, fighter_b_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.manual_fighters manual
      WHERE manual.manager_id = auth.uid()
        AND manual.id IN (
          SELECT registration.manual_fighter_id
          FROM public.event_registrations registration
          WHERE registration.id IN (fighter_a_registration_id, fighter_b_registration_id)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.respond_to_match_proposal(
  match_uuid uuid,
  response text,
  acting_fighter_id uuid DEFAULT NULL
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  before_row public.matches%ROWTYPE;
  after_row public.matches%ROWTYPE;
  registration_a public.event_registrations%ROWTYPE;
  registration_b public.event_registrations%ROWTYPE;
  side_value text;
  method_value text;
BEGIN
  IF response NOT IN ('accepted','declined') THEN RAISE EXCEPTION 'Invalid match response.'; END IF;

  SELECT * INTO before_row FROM public.matches WHERE id = match_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match proposal not found.'; END IF;
  IF before_row.match_status = 'cancelled' THEN RAISE EXCEPTION 'Match proposal is cancelled.'; END IF;

  SELECT * INTO registration_a FROM public.event_registrations WHERE id = before_row.fighter_a_registration_id;
  SELECT * INTO registration_b FROM public.event_registrations WHERE id = before_row.fighter_b_registration_id;

  IF registration_a.fighter_id IS NOT NULL
    AND (acting_fighter_id IS NULL OR acting_fighter_id = registration_a.fighter_id)
    AND EXISTS (
    SELECT 1 FROM public.fighters WHERE id = registration_a.fighter_id AND profile_id = auth.uid()
  ) THEN
    side_value := 'a'; method_value := 'self';
  ELSIF registration_b.fighter_id IS NOT NULL
    AND (acting_fighter_id IS NULL OR acting_fighter_id = registration_b.fighter_id)
    AND EXISTS (
    SELECT 1 FROM public.fighters WHERE id = registration_b.fighter_id AND profile_id = auth.uid()
  ) THEN
    side_value := 'b'; method_value := 'self';
  ELSIF registration_a.fighter_id IS NOT NULL
    AND (acting_fighter_id IS NULL OR acting_fighter_id = registration_a.fighter_id)
    AND EXISTS (
      SELECT 1 FROM public.manager_fighters representation
      WHERE representation.manager_id = auth.uid()
        AND representation.fighter_id = registration_a.fighter_id
    ) THEN
    side_value := 'a'; method_value := 'proxy';
  ELSIF registration_b.fighter_id IS NOT NULL
    AND (acting_fighter_id IS NULL OR acting_fighter_id = registration_b.fighter_id)
    AND EXISTS (
      SELECT 1 FROM public.manager_fighters representation
      WHERE representation.manager_id = auth.uid()
        AND representation.fighter_id = registration_b.fighter_id
    ) THEN
    side_value := 'b'; method_value := 'proxy';
  ELSIF registration_a.manual_fighter_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.manual_fighters WHERE id = registration_a.manual_fighter_id AND manager_id = auth.uid()
  ) THEN
    side_value := 'a'; method_value := 'proxy';
  ELSIF registration_b.manual_fighter_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.manual_fighters WHERE id = registration_b.manual_fighter_id AND manager_id = auth.uid()
  ) THEN
    side_value := 'b'; method_value := 'proxy';
  ELSE
    RAISE EXCEPTION 'You cannot respond for either participant in this proposal.';
  END IF;

  IF before_row.match_status = 'confirmed' AND response = 'declined' THEN
    RAISE EXCEPTION 'A confirmed proposal must be cancelled by an event operator.';
  END IF;

  IF side_value = 'a' THEN
    UPDATE public.matches
    SET fighter_a_status = response,
        fighter_a_confirmation_method = method_value,
        fighter_a_confirmed_by = auth.uid(),
        fighter_a_confirmed_at = now(),
        updated_at = now()
    WHERE id = match_uuid RETURNING * INTO after_row;
  ELSE
    UPDATE public.matches
    SET fighter_b_status = response,
        fighter_b_confirmation_method = method_value,
        fighter_b_confirmed_by = auth.uid(),
        fighter_b_confirmed_at = now(),
        updated_at = now()
    WHERE id = match_uuid RETURNING * INTO after_row;
  END IF;

  INSERT INTO public.match_audit_log(match_id, actor_id, action, previous_data, new_data)
  VALUES (match_uuid, auth.uid(), 'participant_' || response, to_jsonb(before_row), to_jsonb(after_row));
  RETURN after_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_event_match(
  match_uuid uuid,
  cancellation_reason text DEFAULT NULL
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  before_row public.matches%ROWTYPE;
  after_row public.matches%ROWTYPE;
BEGIN
  SELECT * INTO before_row FROM public.matches WHERE id = match_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match proposal not found.'; END IF;
  PERFORM public.assert_event_operator(before_row.event_id);
  IF before_row.match_status = 'cancelled' THEN RETURN before_row; END IF;
  IF EXISTS (
    SELECT 1 FROM public.bouts bout
    WHERE bout.match_id = match_uuid AND bout.status NOT IN ('cancelled','no_show')
  ) THEN
    RAISE EXCEPTION 'Cancel the official bout from bout operations instead.';
  END IF;

  UPDATE public.matches
  SET match_status = 'cancelled', updated_at = now()
  WHERE id = match_uuid
  RETURNING * INTO after_row;

  INSERT INTO public.match_audit_log(match_id, actor_id, action, previous_data, new_data, reason)
  VALUES (match_uuid, auth.uid(), 'proposal_cancelled', to_jsonb(before_row), to_jsonb(after_row), nullif(trim(cancellation_reason), ''));
  RETURN after_row;
END;
$$;

-- Fighter response mutations now go through the column-safe RPC above.
DROP POLICY IF EXISTS "match_update_fighter" ON public.matches;
REVOKE INSERT, UPDATE, DELETE ON public.matches FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.respond_to_match_proposal(uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_event_match(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_match_proposal(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_event_match(uuid,text) TO authenticated;

-- Discipline enforcement now uses registration snapshots and therefore works
-- for both platform and manual participants.
CREATE OR REPLACE FUNCTION public.event_registration_disciplines_match(
  registration_a_id uuid,
  registration_b_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT lower(trim(a.registered_discipline)) = lower(trim(b.registered_discipline))
    FROM public.event_registrations a
    JOIN public.event_registrations b ON b.id = registration_b_id
    WHERE a.id = registration_a_id
      AND a.event_id = b.event_id
      AND nullif(trim(a.registered_discipline), '') IS NOT NULL
      AND nullif(trim(b.registered_discipline), '') IS NOT NULL
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.enforce_match_discipline_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fighter_a_registration_id IS NULL OR NEW.fighter_b_registration_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.event_registration_disciplines_match(
    NEW.fighter_a_registration_id,
    NEW.fighter_b_registration_id
  ) THEN
    RAISE EXCEPTION 'The participant disciplines are incompatible for this proposal.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matches_discipline_compatibility ON public.matches;
CREATE TRIGGER trg_matches_discipline_compatibility
  BEFORE INSERT OR UPDATE OF fighter_a_registration_id, fighter_b_registration_id
  ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_match_discipline_compatibility();
