-- Event Engine Phase 4 follow-up — transactional match proposal creation.
-- This keeps matches as proposal/confirmation records and prevents client-side
-- race conditions from double-assigning fighters.

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

  IF NOT (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = target_event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) THEN
    RAISE EXCEPTION 'No autorizado para crear propuestas en este evento.';
  END IF;

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
