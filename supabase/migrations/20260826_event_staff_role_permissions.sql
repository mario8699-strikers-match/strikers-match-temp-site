-- Event staff role-specific permissions
-- Owner/admin: all event tools.
-- manager: matchmaking, bouts, print.
-- operator: event-day operation only.
-- producer: diffusion/Studio production only.

CREATE OR REPLACE FUNCTION public.has_event_staff_role(
  target_event_id uuid,
  allowed_roles text[]
)
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
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_staff staff
      WHERE staff.event_id = target_event_id
        AND staff.profile_id = auth.uid()
        AND staff.is_active = true
        AND staff.staff_role = ANY(allowed_roles)
    );
$$;

REVOKE ALL ON FUNCTION public.has_event_staff_role(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_event_staff_role(uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_event_staff_member(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_event_staff_role(target_event_id, ARRAY['manager','operator','producer']);
$$;

REVOKE ALL ON FUNCTION public.is_event_staff_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_staff_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_event_operator(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_event_staff_role(target_event_id, ARRAY['manager']);
$$;

REVOKE ALL ON FUNCTION public.is_event_operator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_operator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_event_day_operator(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_event_staff_role(target_event_id, ARRAY['operator']);
$$;

REVOKE ALL ON FUNCTION public.is_event_day_operator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_day_operator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_event_producer(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_event_staff_role(target_event_id, ARRAY['producer']);
$$;

REVOKE ALL ON FUNCTION public.is_event_producer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_producer(uuid) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.assert_event_day_operator(target_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_event_operator(target_event_id)
    OR public.is_event_day_operator(target_event_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_event_day_operator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_event_day_operator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_event_producer(target_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_event_producer(target_event_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_event_producer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_event_producer(uuid) TO authenticated;

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

  IF next_mat_id IS NOT NULL OR next_mat_order IS NOT NULL OR next_scheduled_time IS NOT NULL THEN
    PERFORM public.assert_event_operator(before_row.event_id);
  ELSE
    PERFORM public.assert_event_day_operator(before_row.event_id);
  END IF;

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

REVOKE ALL ON FUNCTION public.update_bout_operation(uuid,text,uuid,integer,timestamptz,uuid,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_bout_operation(uuid,text,uuid,integer,timestamptz,uuid,text,integer,text) TO authenticated;

DROP POLICY IF EXISTS "event_staff_select_operator" ON public.event_staff;
DROP POLICY IF EXISTS "event_staff_select_member" ON public.event_staff;
CREATE POLICY "event_staff_select_member" ON public.event_staff
  FOR SELECT USING (public.is_event_staff_member(event_id));

DROP POLICY IF EXISTS "event_applications_manager_select" ON public.event_applications;
DROP POLICY IF EXISTS "event_applications_manager_update" ON public.event_applications;
DROP POLICY IF EXISTS "event_registrations_manager_select" ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations_manager_insert" ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations_manager_update" ON public.event_registrations;
DROP POLICY IF EXISTS "matches_manager_select" ON public.matches;
DROP POLICY IF EXISTS "matches_manager_insert" ON public.matches;
DROP POLICY IF EXISTS "matches_manager_update" ON public.matches;
DROP POLICY IF EXISTS "match_requests_manager_select" ON public.match_requests;
DROP POLICY IF EXISTS "match_requests_manager_insert" ON public.match_requests;
DROP POLICY IF EXISTS "match_requests_manager_update" ON public.match_requests;
DROP POLICY IF EXISTS "settings_manager_manage" ON public.event_matchmaking_settings;
DROP POLICY IF EXISTS "divisions_manager_manage" ON public.event_divisions;
DROP POLICY IF EXISTS "mats_manager_manage" ON public.event_mats;
DROP POLICY IF EXISTS "bouts_staff_select" ON public.bouts;
DROP POLICY IF EXISTS "bouts_manager_manage" ON public.bouts;
DROP POLICY IF EXISTS "bout_audit_staff_select" ON public.bout_audit_log;

DROP POLICY IF EXISTS "event_applications_operator_select" ON public.event_applications;
DROP POLICY IF EXISTS "event_applications_operator_update" ON public.event_applications;
DROP POLICY IF EXISTS "event_registrations_operator_select" ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations_operator_insert" ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations_operator_update" ON public.event_registrations;
DROP POLICY IF EXISTS "matches_operator_select" ON public.matches;
DROP POLICY IF EXISTS "matches_operator_insert" ON public.matches;
DROP POLICY IF EXISTS "matches_operator_update" ON public.matches;
DROP POLICY IF EXISTS "match_requests_operator_select" ON public.match_requests;
DROP POLICY IF EXISTS "match_requests_operator_insert" ON public.match_requests;
DROP POLICY IF EXISTS "match_requests_operator_update" ON public.match_requests;
DROP POLICY IF EXISTS "settings_operator_manage" ON public.event_matchmaking_settings;
DROP POLICY IF EXISTS "divisions_operator_manage" ON public.event_divisions;
DROP POLICY IF EXISTS "mats_operator_manage" ON public.event_mats;
DROP POLICY IF EXISTS "bouts_operator_manage" ON public.bouts;
DROP POLICY IF EXISTS "bout_audit_operator_select" ON public.bout_audit_log;

CREATE POLICY "event_applications_manager_select" ON public.event_applications
  FOR SELECT USING (public.is_event_operator(event_id));
CREATE POLICY "event_applications_manager_update" ON public.event_applications
  FOR UPDATE USING (public.is_event_operator(event_id))
  WITH CHECK (public.is_event_operator(event_id));

CREATE POLICY "event_registrations_manager_select" ON public.event_registrations
  FOR SELECT USING (public.is_event_operator(event_id));
CREATE POLICY "event_registrations_manager_insert" ON public.event_registrations
  FOR INSERT WITH CHECK (public.is_event_operator(event_id));
CREATE POLICY "event_registrations_manager_update" ON public.event_registrations
  FOR UPDATE USING (public.is_event_operator(event_id))
  WITH CHECK (public.is_event_operator(event_id));

CREATE POLICY "matches_manager_select" ON public.matches
  FOR SELECT USING (public.is_event_operator(event_id));
CREATE POLICY "matches_manager_insert" ON public.matches
  FOR INSERT WITH CHECK (public.is_event_operator(event_id));
CREATE POLICY "matches_manager_update" ON public.matches
  FOR UPDATE USING (public.is_event_operator(event_id))
  WITH CHECK (public.is_event_operator(event_id));

CREATE POLICY "match_requests_manager_select" ON public.match_requests
  FOR SELECT USING (public.is_event_operator(event_id));
CREATE POLICY "match_requests_manager_insert" ON public.match_requests
  FOR INSERT WITH CHECK (public.is_event_operator(event_id));
CREATE POLICY "match_requests_manager_update" ON public.match_requests
  FOR UPDATE USING (public.is_event_operator(event_id))
  WITH CHECK (public.is_event_operator(event_id));

CREATE POLICY "settings_manager_manage" ON public.event_matchmaking_settings
  FOR ALL USING (public.is_event_operator(event_id))
  WITH CHECK (public.is_event_operator(event_id));
CREATE POLICY "divisions_manager_manage" ON public.event_divisions
  FOR ALL USING (public.is_event_operator(event_id))
  WITH CHECK (public.is_event_operator(event_id));
CREATE POLICY "mats_manager_manage" ON public.event_mats
  FOR ALL USING (public.is_event_operator(event_id))
  WITH CHECK (public.is_event_operator(event_id));

CREATE POLICY "bouts_staff_select" ON public.bouts
  FOR SELECT USING (
    public.is_event_operator(event_id)
    OR public.is_event_day_operator(event_id)
    OR public.is_event_producer(event_id)
  );
CREATE POLICY "bouts_manager_manage" ON public.bouts
  FOR ALL USING (public.is_event_operator(event_id))
  WITH CHECK (public.is_event_operator(event_id));

CREATE POLICY "bout_audit_staff_select" ON public.bout_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.bouts b
      WHERE b.id = bout_id
        AND (
          public.is_event_operator(b.event_id)
          OR public.is_event_day_operator(b.event_id)
          OR public.is_event_producer(b.event_id)
        )
    )
  );
