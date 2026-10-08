-- Event operators can deliberately create an official bout from any two
-- ready event registrations, even when advisory matchmaking rules such as
-- weight category or age tolerance reject the automatic recommendation.
-- Non-negotiable safety and workflow constraints remain enforced here and by
-- the existing discipline/gender triggers.

CREATE OR REPLACE FUNCTION public.approve_manual_pairing_as_bout(
  target_event_id uuid,
  registration_x_id uuid,
  registration_y_id uuid,
  override_reason text DEFAULT NULL
)
RETURNS public.bouts
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
  created_bout public.bouts%ROWTYPE;
  manual_warnings text[] := ARRAY[]::text[];
  override_failures text[] := ARRAY[]::text[];
  normalized_reason text := NULLIF(trim(override_reason), '');
  requires_override_reason boolean := false;
  maximum_assignments integer := 1;
  resolved_weight_class text;
BEGIN
  IF registration_x_id IS NULL OR registration_y_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona dos peleadores para crear el combate manual.';
  END IF;
  IF registration_x_id = registration_y_id THEN
    RAISE EXCEPTION 'No se puede emparejar a un peleador consigo mismo.';
  END IF;

  PERFORM public.assert_event_operator(target_event_id);

  registration_a_id := least(registration_x_id, registration_y_id);
  registration_b_id := greatest(registration_x_id, registration_y_id);
  PERFORM pg_advisory_xact_lock(hashtext(
    target_event_id::text || ':manual:' || registration_a_id::text || ':' || registration_b_id::text
  ));

  SELECT * INTO registration_a
  FROM public.event_registrations
  WHERE id = registration_a_id
  FOR UPDATE;

  SELECT * INTO registration_b
  FROM public.event_registrations
  WHERE id = registration_b_id
  FOR UPDATE;

  IF registration_a.id IS NULL OR registration_b.id IS NULL
    OR registration_a.event_id <> target_event_id
    OR registration_b.event_id <> target_event_id THEN
    RAISE EXCEPTION 'Ambos peleadores deben estar registrados en este evento.';
  END IF;

  IF registration_a.eligibility_status <> 'eligible'
    OR registration_b.eligibility_status <> 'eligible' THEN
    RAISE EXCEPTION 'Ambos peleadores deben estar marcados como elegibles.';
  END IF;

  IF registration_a.payment_status NOT IN ('confirmed', 'waived')
    OR registration_b.payment_status NOT IN ('confirmed', 'waived') THEN
    RAISE EXCEPTION 'Ambos peleadores deben tener el pago confirmado o exento.';
  END IF;

  IF NOT public.event_registration_disciplines_match(registration_a.id, registration_b.id) THEN
    RAISE EXCEPTION 'No se puede crear un combate manual entre disciplinas diferentes.';
  END IF;

  IF public.canonical_gender_division(registration_a.gender_division) IS NULL
    OR public.canonical_gender_division(registration_b.gender_division) IS NULL THEN
    RAISE EXCEPTION 'Ambos peleadores deben tener una división de género válida.';
  END IF;
  IF public.canonical_gender_division(registration_a.gender_division)
    <> public.canonical_gender_division(registration_b.gender_division) THEN
    RAISE EXCEPTION 'No se puede crear un combate entre divisiones de género diferentes.';
  END IF;

  IF NULLIF(lower(trim(registration_a.experience_level)), '') IS NULL
    OR NULLIF(lower(trim(registration_b.experience_level)), '') IS NULL THEN
    RAISE EXCEPTION 'Ambos peleadores deben tener una clase amateur o profesional definida.';
  END IF;
  IF lower(trim(registration_a.experience_level))
    <> lower(trim(registration_b.experience_level)) THEN
    RAISE EXCEPTION 'No se puede crear un combate manual entre clases amateur y profesional diferentes.';
  END IF;

  IF NULLIF(trim(registration_a.ruleset), '') IS NOT NULL
    AND NULLIF(trim(registration_b.ruleset), '') IS NOT NULL
    AND lower(trim(registration_a.ruleset)) <> lower(trim(registration_b.ruleset)) THEN
    RAISE EXCEPTION 'Corrige el reglamento: ambos peleadores tienen reglamentos diferentes.';
  END IF;

  SELECT * INTO settings_row
  FROM public.event_matchmaking_settings
  WHERE event_id = target_event_id;
  maximum_assignments := COALESCE(settings_row.max_bouts_per_fighter, 1);

  IF public.event_registration_assignment_count(registration_a.id) >= maximum_assignments
    OR public.event_registration_assignment_count(registration_b.id) >= maximum_assignments THEN
    RAISE EXCEPTION 'Uno de los peleadores ya alcanzó el límite de combates activos del evento.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.matches match
    WHERE match.event_id = target_event_id
      AND match.match_status <> 'cancelled'
      AND (
        (match.fighter_a_registration_id = registration_a.id
          AND match.fighter_b_registration_id = registration_b.id)
        OR (match.fighter_a_registration_id = registration_b.id
          AND match.fighter_b_registration_id = registration_a.id)
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.bouts bout
    WHERE bout.event_id = target_event_id
      AND bout.status NOT IN ('cancelled', 'no_show')
      AND (
        (bout.fighter_a_registration_id = registration_a.id
          AND bout.fighter_b_registration_id = registration_b.id)
        OR (bout.fighter_a_registration_id = registration_b.id
          AND bout.fighter_b_registration_id = registration_a.id)
      )
  ) THEN
    RAISE EXCEPTION 'Este combate ya existe y sigue activo.';
  END IF;

  SELECT * INTO suggestion_row
  FROM public.match_suggestions
  WHERE event_id = target_event_id
    AND fighter_a_registration_id = registration_a.id
    AND fighter_b_registration_id = registration_b.id
  ORDER BY updated_at DESC
  LIMIT 1
  FOR UPDATE;

  requires_override_reason := suggestion_row.id IS NULL
    OR NOT suggestion_row.is_eligible
    OR suggestion_row.status NOT IN ('active', 'locked', 'changes_requested');

  IF requires_override_reason AND normalized_reason IS NULL THEN
    RAISE EXCEPTION 'Escribe el motivo para aprobar manualmente una combinación fuera de las recomendaciones automáticas.';
  END IF;

  manual_warnings := COALESCE(suggestion_row.warnings, ARRAY[]::text[]);
  IF suggestion_row.id IS NOT NULL AND NOT suggestion_row.is_eligible THEN
    SELECT COALESCE(array_agg('manual_override:' || failure), ARRAY[]::text[])
    INTO override_failures
    FROM unnest(COALESCE(suggestion_row.hard_failures, ARRAY[]::text[])) AS failure;
    manual_warnings := manual_warnings || override_failures;
  END IF;

  INSERT INTO public.matches (
    event_id,
    fighter_a_registration_id,
    fighter_b_registration_id,
    fighter_a_id,
    fighter_b_id,
    fighter_a_status,
    fighter_b_status,
    match_status,
    compatibility_score,
    score_breakdown,
    warnings,
    rule_version,
    suggestion_id,
    proposed_by,
    fighter_a_confirmation_method,
    fighter_b_confirmation_method,
    fighter_a_confirmed_by,
    fighter_b_confirmed_by,
    fighter_a_confirmed_at,
    fighter_b_confirmed_at
  ) VALUES (
    target_event_id,
    registration_a.id,
    registration_b.id,
    registration_a.fighter_id,
    registration_b.fighter_id,
    'accepted',
    'accepted',
    'confirmed',
    suggestion_row.compatibility_score,
    COALESCE(suggestion_row.score_breakdown, '{}'::jsonb),
    manual_warnings,
    COALESCE(suggestion_row.rule_version, settings_row.rules_version),
    suggestion_row.id,
    auth.uid(),
    'proxy',
    'proxy',
    auth.uid(),
    auth.uid(),
    now(),
    now()
  )
  RETURNING * INTO created_match;

  INSERT INTO public.match_audit_log(match_id, actor_id, action, new_data, reason)
  VALUES (
    created_match.id,
    auth.uid(),
    'operator_manual_pairing_created',
    to_jsonb(created_match),
    normalized_reason
  );

  IF suggestion_row.id IS NOT NULL THEN
    UPDATE public.match_suggestions
    SET status = 'converted',
        review_reason = COALESCE(normalized_reason, review_reason),
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
    WHERE id = suggestion_row.id;
  END IF;

  SELECT * INTO created_bout
  FROM public.approve_confirmed_match_as_bout(created_match.id);

  resolved_weight_class := CASE
    WHEN NULLIF(trim(registration_a.registered_weight_class), '') IS NOT NULL
      AND lower(trim(registration_a.registered_weight_class))
        = lower(trim(registration_b.registered_weight_class))
      THEN registration_a.registered_weight_class
    WHEN registration_a.weigh_in_weight IS NOT NULL
      AND registration_b.weigh_in_weight IS NOT NULL
      THEN least(registration_a.weigh_in_weight, registration_b.weigh_in_weight)::text
        || '–'
        || greatest(registration_a.weigh_in_weight, registration_b.weigh_in_weight)::text
        || ' kg · peso pactado'
    ELSE concat_ws(
      ' / ',
      NULLIF(trim(registration_a.registered_weight_class), ''),
      NULLIF(trim(registration_b.registered_weight_class), '')
    ) || ' · peso pactado'
  END;

  UPDATE public.bouts
  SET weight_class = NULLIF(trim(resolved_weight_class), ''),
      notes = CASE
        WHEN normalized_reason IS NULL THEN notes
        WHEN NULLIF(trim(notes), '') IS NULL THEN 'Emparejamiento manual: ' || normalized_reason
        ELSE notes || E'\nEmparejamiento manual: ' || normalized_reason
      END,
      updated_at = now()
  WHERE id = created_bout.id
  RETURNING * INTO created_bout;

  INSERT INTO public.bout_audit_log(bout_id, actor_id, action, new_data, reason)
  VALUES (
    created_bout.id,
    auth.uid(),
    'operator_manual_pairing_confirmed',
    to_jsonb(created_bout),
    normalized_reason
  );

  RETURN created_bout;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_manual_pairing_as_bout(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_manual_pairing_as_bout(uuid, uuid, uuid, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
