-- Event Engine access alignment
-- Event owners, including manager-created events, and admins can operate event-engine workflows.

CREATE OR REPLACE FUNCTION public.is_event_operator(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = target_event_id
        AND e.promoter_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_event_operator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_operator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_event_operator(target_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_event_operator(target_event_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_event_operator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_event_operator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_confirmed_match_as_bout(match_uuid uuid)
RETURNS public.bouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.matches%ROWTYPE;
  reg_a public.event_registrations%ROWTYPE;
  reg_b public.event_registrations%ROWTYPE;
  profile_a public.profiles%ROWTYPE;
  profile_b public.profiles%ROWTYPE;
  fighter_a public.fighters%ROWTYPE;
  fighter_b public.fighters%ROWTYPE;
  created_bout public.bouts%ROWTYPE;
BEGIN
  SELECT * INTO match_row FROM public.matches WHERE id = match_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  PERFORM public.assert_event_operator(match_row.event_id);

  IF match_row.match_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Both fighters must confirm the proposal first';
  END IF;

  SELECT * INTO reg_a FROM public.event_registrations
    WHERE event_id = match_row.event_id AND fighter_id = match_row.fighter_a_id FOR UPDATE;
  SELECT * INTO reg_b FROM public.event_registrations
    WHERE event_id = match_row.event_id AND fighter_id = match_row.fighter_b_id FOR UPDATE;
  IF reg_a.id IS NULL OR reg_b.id IS NULL THEN RAISE EXCEPTION 'Event registrations not found'; END IF;
  IF reg_a.eligibility_status <> 'eligible' OR reg_b.eligibility_status <> 'eligible' THEN
    RAISE EXCEPTION 'Both fighters must be eligible';
  END IF;

  SELECT * INTO fighter_a FROM public.fighters WHERE id = match_row.fighter_a_id;
  SELECT * INTO fighter_b FROM public.fighters WHERE id = match_row.fighter_b_id;
  SELECT * INTO profile_a FROM public.profiles WHERE id = fighter_a.profile_id;
  SELECT * INTO profile_b FROM public.profiles WHERE id = fighter_b.profile_id;

  INSERT INTO public.bouts (
    event_id, match_id, fighter_a_registration_id, fighter_b_registration_id,
    fighter_a_id, fighter_b_id, fighter_a_snapshot, fighter_b_snapshot,
    discipline, ruleset, bout_format, weight_class, age_class, belt_level,
    experience_level, approved_by
  ) VALUES (
    match_row.event_id, match_row.id, reg_a.id, reg_b.id,
    fighter_a.id, fighter_b.id,
    jsonb_build_object('id', fighter_a.id, 'name', profile_a.full_name, 'team', reg_a.team_name,
      'record_wins', reg_a.record_wins, 'record_losses', reg_a.record_losses, 'record_draws', reg_a.record_draws),
    jsonb_build_object('id', fighter_b.id, 'name', profile_b.full_name, 'team', reg_b.team_name,
      'record_wins', reg_b.record_wins, 'record_losses', reg_b.record_losses, 'record_draws', reg_b.record_draws),
    COALESCE(reg_a.registered_discipline, reg_b.registered_discipline),
    COALESCE(reg_a.ruleset, reg_b.ruleset), COALESCE(reg_a.bout_format, reg_b.bout_format),
    COALESCE(reg_a.registered_weight_class, reg_b.registered_weight_class),
    COALESCE(reg_a.age_class, reg_b.age_class), COALESCE(reg_a.belt_level, reg_b.belt_level),
    COALESCE(reg_a.experience_level, reg_b.experience_level), auth.uid()
  )
  ON CONFLICT (match_id) DO UPDATE SET updated_at = public.bouts.updated_at
  RETURNING * INTO created_bout;

  UPDATE public.matches SET approved_by = auth.uid(), approved_at = now(), updated_at = now()
    WHERE id = match_uuid;
  INSERT INTO public.bout_audit_log (bout_id, actor_id, action, new_data)
    VALUES (created_bout.id, auth.uid(), 'bout_approved', to_jsonb(created_bout));
  RETURN created_bout;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_confirmed_match_as_bout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_confirmed_match_as_bout(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.propose_event_match(
  target_event_id uuid,
  fighter_x_id uuid,
  fighter_y_id uuid,
  next_compatibility_score integer DEFAULT NULL,
  next_score_breakdown jsonb DEFAULT '{}'::jsonb,
  next_warnings text[] DEFAULT '{}',
  next_rule_version integer DEFAULT NULL
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fighter_a uuid;
  fighter_b uuid;
  registration_a public.event_registrations%ROWTYPE;
  registration_b public.event_registrations%ROWTYPE;
  max_assignments integer := 1;
  fighter_a_assignments integer := 0;
  fighter_b_assignments integer := 0;
  created_match public.matches%ROWTYPE;
BEGIN
  IF fighter_x_id = fighter_y_id THEN
    RAISE EXCEPTION 'No se puede emparejar a un peleador consigo mismo.';
  END IF;

  PERFORM public.assert_event_operator(target_event_id);

  fighter_a := LEAST(fighter_x_id, fighter_y_id);
  fighter_b := GREATEST(fighter_x_id, fighter_y_id);

  PERFORM pg_advisory_xact_lock(hashtext(target_event_id::text || ':' || fighter_a::text || ':' || fighter_b::text));

  SELECT * INTO registration_a
  FROM public.event_registrations
  WHERE event_id = target_event_id AND fighter_id = fighter_a
  FOR UPDATE;

  SELECT * INTO registration_b
  FROM public.event_registrations
  WHERE event_id = target_event_id AND fighter_id = fighter_b
  FOR UPDATE;

  IF registration_a.id IS NULL OR registration_b.id IS NULL THEN
    RAISE EXCEPTION 'Ambos peleadores deben estar registrados en el evento.';
  END IF;

  IF registration_a.payment_status <> 'confirmed' OR registration_b.payment_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Ambos peleadores deben tener pago confirmado para emparejarse.';
  END IF;

  IF registration_a.eligibility_status = 'ineligible' OR registration_b.eligibility_status = 'ineligible' THEN
    RAISE EXCEPTION 'No se puede crear una propuesta con peleadores inelegibles.';
  END IF;

  SELECT COALESCE(settings.max_bouts_per_fighter, 1)
  INTO max_assignments
  FROM public.event_matchmaking_settings settings
  WHERE settings.event_id = target_event_id;

  max_assignments := COALESCE(max_assignments, 1);

  SELECT count(*)::integer INTO fighter_a_assignments
  FROM (
    SELECT m.id
    FROM public.matches m
    LEFT JOIN public.bouts b
      ON b.match_id = m.id
      AND b.status NOT IN ('cancelled', 'no_show')
    WHERE m.event_id = target_event_id
      AND m.match_status <> 'cancelled'
      AND b.id IS NULL
      AND fighter_a IN (m.fighter_a_id, m.fighter_b_id)
    UNION ALL
    SELECT b.id
    FROM public.bouts b
    WHERE b.event_id = target_event_id
      AND b.status NOT IN ('cancelled', 'no_show')
      AND fighter_a IN (b.fighter_a_id, b.fighter_b_id)
  ) assignments;

  SELECT count(*)::integer INTO fighter_b_assignments
  FROM (
    SELECT m.id
    FROM public.matches m
    LEFT JOIN public.bouts b
      ON b.match_id = m.id
      AND b.status NOT IN ('cancelled', 'no_show')
    WHERE m.event_id = target_event_id
      AND m.match_status <> 'cancelled'
      AND b.id IS NULL
      AND fighter_b IN (m.fighter_a_id, m.fighter_b_id)
    UNION ALL
    SELECT b.id
    FROM public.bouts b
    WHERE b.event_id = target_event_id
      AND b.status NOT IN ('cancelled', 'no_show')
      AND fighter_b IN (b.fighter_a_id, b.fighter_b_id)
  ) assignments;

  IF fighter_a_assignments >= max_assignments OR fighter_b_assignments >= max_assignments THEN
    RAISE EXCEPTION 'Uno de los peleadores ya está asignado a una propuesta o bout activo.';
  END IF;

  INSERT INTO public.matches (
    event_id,
    fighter_a_id,
    fighter_b_id,
    fighter_a_status,
    fighter_b_status,
    match_status,
    compatibility_score,
    score_breakdown,
    warnings,
    rule_version,
    proposed_by
  ) VALUES (
    target_event_id,
    fighter_a,
    fighter_b,
    'pending',
    'pending',
    'pending',
    next_compatibility_score,
    COALESCE(next_score_breakdown, '{}'::jsonb),
    COALESCE(next_warnings, '{}'),
    next_rule_version,
    auth.uid()
  )
  RETURNING * INTO created_match;

  RETURN created_match;
END;
$$;

REVOKE ALL ON FUNCTION public.propose_event_match(uuid, uuid, uuid, integer, jsonb, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_event_match(uuid, uuid, uuid, integer, jsonb, text[], integer) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_applications')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_applications' AND policyname = 'event_applications_operator_select') THEN
    CREATE POLICY "event_applications_operator_select" ON public.event_applications
      FOR SELECT USING (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_applications')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_applications' AND policyname = 'event_applications_operator_update') THEN
    CREATE POLICY "event_applications_operator_update" ON public.event_applications
      FOR UPDATE USING (public.is_event_operator(event_id))
      WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_registrations')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_registrations' AND policyname = 'event_registrations_operator_select') THEN
    CREATE POLICY "event_registrations_operator_select" ON public.event_registrations
      FOR SELECT USING (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_registrations')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_registrations' AND policyname = 'event_registrations_operator_insert') THEN
    CREATE POLICY "event_registrations_operator_insert" ON public.event_registrations
      FOR INSERT WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_registrations')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_registrations' AND policyname = 'event_registrations_operator_update') THEN
    CREATE POLICY "event_registrations_operator_update" ON public.event_registrations
      FOR UPDATE USING (public.is_event_operator(event_id))
      WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'matches')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches' AND policyname = 'matches_operator_select') THEN
    CREATE POLICY "matches_operator_select" ON public.matches
      FOR SELECT USING (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'matches')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches' AND policyname = 'matches_operator_insert') THEN
    CREATE POLICY "matches_operator_insert" ON public.matches
      FOR INSERT WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'matches')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matches' AND policyname = 'matches_operator_update') THEN
    CREATE POLICY "matches_operator_update" ON public.matches
      FOR UPDATE USING (public.is_event_operator(event_id))
      WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_requests')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'match_requests' AND policyname = 'match_requests_operator_select') THEN
    CREATE POLICY "match_requests_operator_select" ON public.match_requests
      FOR SELECT USING (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_requests')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'match_requests' AND policyname = 'match_requests_operator_insert') THEN
    CREATE POLICY "match_requests_operator_insert" ON public.match_requests
      FOR INSERT WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_requests')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'match_requests' AND policyname = 'match_requests_operator_update') THEN
    CREATE POLICY "match_requests_operator_update" ON public.match_requests
      FOR UPDATE USING (public.is_event_operator(event_id))
      WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_matchmaking_settings')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_matchmaking_settings' AND policyname = 'settings_operator_manage') THEN
    CREATE POLICY "settings_operator_manage" ON public.event_matchmaking_settings
      FOR ALL USING (public.is_event_operator(event_id))
      WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_divisions')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_divisions' AND policyname = 'divisions_operator_manage') THEN
    CREATE POLICY "divisions_operator_manage" ON public.event_divisions
      FOR ALL USING (public.is_event_operator(event_id))
      WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_mats')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_mats' AND policyname = 'mats_operator_manage') THEN
    CREATE POLICY "mats_operator_manage" ON public.event_mats
      FOR ALL USING (public.is_event_operator(event_id))
      WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bouts')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bouts' AND policyname = 'bouts_operator_manage') THEN
    CREATE POLICY "bouts_operator_manage" ON public.bouts
      FOR ALL USING (public.is_event_operator(event_id))
      WITH CHECK (public.is_event_operator(event_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bout_audit_log')
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bout_audit_log' AND policyname = 'bout_audit_operator_select') THEN
    CREATE POLICY "bout_audit_operator_select" ON public.bout_audit_log
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.bouts b
          WHERE b.id = bout_id
            AND public.is_event_operator(b.event_id)
        )
      );
  END IF;
END $$;
