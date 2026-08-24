-- Event Engine Phase 5/6 follow-up — audited fighter replacement for a bout.

CREATE OR REPLACE FUNCTION public.replace_bout_fighter(
  bout_uuid uuid,
  replacement_side text,
  replacement_registration_uuid uuid,
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
  replacement_registration public.event_registrations%ROWTYPE;
  replacement_fighter public.fighters%ROWTYPE;
  replacement_profile public.profiles%ROWTYPE;
  active_assignment_count integer := 0;
  replacement_snapshot jsonb;
BEGIN
  IF replacement_side NOT IN ('a', 'b') THEN
    RAISE EXCEPTION 'Replacement side must be a or b';
  END IF;

  SELECT * INTO before_row
  FROM public.bouts
  WHERE id = bout_uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bout not found';
  END IF;

  PERFORM public.assert_event_operator(before_row.event_id);

  IF before_row.status IN ('completed', 'cancelled', 'no_show') THEN
    RAISE EXCEPTION 'Cannot replace fighter on a terminal bout';
  END IF;

  SELECT * INTO replacement_registration
  FROM public.event_registrations
  WHERE id = replacement_registration_uuid
  FOR UPDATE;

  IF NOT FOUND OR replacement_registration.event_id <> before_row.event_id THEN
    RAISE EXCEPTION 'Replacement registration must belong to this event';
  END IF;

  IF replacement_registration.payment_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Replacement fighter must have confirmed payment';
  END IF;

  IF replacement_registration.eligibility_status <> 'eligible' THEN
    RAISE EXCEPTION 'Replacement fighter must be eligible';
  END IF;

  IF replacement_side = 'a' AND replacement_registration.fighter_id = before_row.fighter_b_id THEN
    RAISE EXCEPTION 'Replacement fighter is already fighter B';
  END IF;

  IF replacement_side = 'b' AND replacement_registration.fighter_id = before_row.fighter_a_id THEN
    RAISE EXCEPTION 'Replacement fighter is already fighter A';
  END IF;

  SELECT count(*)::integer INTO active_assignment_count
  FROM public.bouts b
  WHERE b.event_id = before_row.event_id
    AND b.id <> before_row.id
    AND b.status NOT IN ('cancelled', 'no_show', 'completed')
    AND replacement_registration.fighter_id IN (b.fighter_a_id, b.fighter_b_id);

  IF active_assignment_count > 0 THEN
    RAISE EXCEPTION 'Replacement fighter is already assigned to an active bout';
  END IF;

  SELECT * INTO replacement_fighter
  FROM public.fighters
  WHERE id = replacement_registration.fighter_id;

  SELECT * INTO replacement_profile
  FROM public.profiles
  WHERE id = replacement_fighter.profile_id;

  replacement_snapshot := jsonb_build_object(
    'id', replacement_fighter.id,
    'name', replacement_profile.full_name,
    'team', replacement_registration.team_name,
    'record_wins', replacement_registration.record_wins,
    'record_losses', replacement_registration.record_losses,
    'record_draws', replacement_registration.record_draws
  );

  IF replacement_side = 'a' THEN
    UPDATE public.bouts
    SET fighter_a_registration_id = replacement_registration.id,
        fighter_a_id = replacement_registration.fighter_id,
        fighter_a_snapshot = replacement_snapshot,
        winner_id = CASE WHEN winner_id = before_row.fighter_a_id THEN NULL ELSE winner_id END,
        replacement_notes = operation_reason,
        status = CASE WHEN status = 'in_progress' THEN 'approved' ELSE status END,
        updated_at = now()
    WHERE id = bout_uuid
    RETURNING * INTO after_row;
  ELSE
    UPDATE public.bouts
    SET fighter_b_registration_id = replacement_registration.id,
        fighter_b_id = replacement_registration.fighter_id,
        fighter_b_snapshot = replacement_snapshot,
        winner_id = CASE WHEN winner_id = before_row.fighter_b_id THEN NULL ELSE winner_id END,
        replacement_notes = operation_reason,
        status = CASE WHEN status = 'in_progress' THEN 'approved' ELSE status END,
        updated_at = now()
    WHERE id = bout_uuid
    RETURNING * INTO after_row;
  END IF;

  INSERT INTO public.bout_audit_log (bout_id, actor_id, action, previous_data, new_data, reason)
  VALUES (bout_uuid, auth.uid(), 'fighter_replaced', to_jsonb(before_row), to_jsonb(after_row), operation_reason);

  RETURN after_row;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_bout_fighter(uuid,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_bout_fighter(uuid,text,uuid,text) TO authenticated;
