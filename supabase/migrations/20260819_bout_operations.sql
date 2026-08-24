-- ============================================================
-- Event Engine Phases 6 and 8 — audited bout operations
-- ============================================================

CREATE OR REPLACE FUNCTION public.assert_event_operator(target_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = target_event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_event_bout_order(target_event_id uuid)
RETURNS SETOF public.bouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_event_operator(target_event_id);
  PERFORM pg_advisory_xact_lock(hashtext(target_event_id::text));

  WITH ordered AS (
    SELECT id, row_number() OVER (
      ORDER BY COALESCE(scheduled_time, 'infinity'::timestamptz), created_at, id
    )::integer AS next_number
    FROM public.bouts
    WHERE event_id = target_event_id AND status NOT IN ('cancelled', 'no_show')
  )
  UPDATE public.bouts b
  SET bout_number = ordered.next_number, updated_at = now()
  FROM ordered
  WHERE b.id = ordered.id;

  RETURN QUERY SELECT * FROM public.bouts
    WHERE event_id = target_event_id
    ORDER BY bout_number NULLS LAST, created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_bout_operation(
  bout_uuid uuid,
  next_status text DEFAULT NULL,
  next_mat_id uuid DEFAULT NULL,
  next_mat_order integer DEFAULT NULL,
  next_scheduled_time timestamptz DEFAULT NULL,
  next_winner_id uuid DEFAULT NULL,
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
BEGIN
  SELECT * INTO before_row FROM public.bouts WHERE id = bout_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bout not found'; END IF;
  PERFORM public.assert_event_operator(before_row.event_id);

  IF next_status IS NOT NULL AND next_status NOT IN
    ('approved','confirmed','ready','in_progress','completed','cancelled','no_show') THEN
    RAISE EXCEPTION 'Invalid bout status';
  END IF;
  IF next_status = 'completed' AND next_winner_id IS NULL THEN
    RAISE EXCEPTION 'Winner is required to complete a bout';
  END IF;
  IF next_winner_id IS NOT NULL AND next_winner_id NOT IN (before_row.fighter_a_id, before_row.fighter_b_id) THEN
    RAISE EXCEPTION 'Winner must be a fighter in this bout';
  END IF;
  IF next_mat_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_mats m WHERE m.id = next_mat_id AND m.event_id = before_row.event_id
  ) THEN RAISE EXCEPTION 'Mat belongs to another event'; END IF;

  UPDATE public.bouts
  SET status = COALESCE(next_status, status),
      mat_id = COALESCE(next_mat_id, mat_id),
      mat_order = COALESCE(next_mat_order, mat_order),
      scheduled_time = COALESCE(next_scheduled_time, scheduled_time),
      winner_id = COALESCE(next_winner_id, winner_id),
      method = COALESCE(next_method, method),
      elapsed_seconds = COALESCE(next_elapsed_seconds, elapsed_seconds),
      cancellation_reason = CASE WHEN next_status IN ('cancelled','no_show') THEN operation_reason ELSE cancellation_reason END,
      completed_at = CASE WHEN next_status = 'completed' THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = bout_uuid
  RETURNING * INTO after_row;

  INSERT INTO public.bout_audit_log (bout_id, actor_id, action, previous_data, new_data, reason)
  VALUES (bout_uuid, auth.uid(), 'bout_updated', to_jsonb(before_row), to_jsonb(after_row), operation_reason);
  RETURN after_row;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_event_operator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_event_bout_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_bout_operation(uuid,text,uuid,integer,timestamptz,uuid,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_event_bout_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_bout_operation(uuid,text,uuid,integer,timestamptz,uuid,text,integer,text) TO authenticated;

