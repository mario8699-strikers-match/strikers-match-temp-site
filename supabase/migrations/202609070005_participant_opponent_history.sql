-- Read-only opponent history for authorized event matchmaking staff.

CREATE OR REPLACE FUNCTION public.get_event_registration_opponent_history(
  registration_uuid uuid
)
RETURNS TABLE (
  bout_id uuid,
  event_id uuid,
  event_name text,
  event_date date,
  opponent_name text,
  bout_status text,
  scheduled_time timestamptz,
  result text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_registration public.event_registrations%ROWTYPE;
BEGIN
  SELECT * INTO current_registration
  FROM public.event_registrations
  WHERE id = registration_uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event registration not found.'; END IF;
  PERFORM public.assert_event_operator(current_registration.event_id);

  RETURN QUERY
  SELECT
    bout.id,
    bout.event_id,
    event.event_name,
    event.event_date,
    CASE
      WHEN (
        (current_registration.fighter_id IS NOT NULL AND registration_a.fighter_id = current_registration.fighter_id)
        OR (current_registration.manual_fighter_id IS NOT NULL AND registration_a.manual_fighter_id = current_registration.manual_fighter_id)
      ) THEN COALESCE(bout.fighter_b_snapshot->>'name', registration_b.display_name, '—')
      ELSE COALESCE(bout.fighter_a_snapshot->>'name', registration_a.display_name, '—')
    END,
    bout.status,
    bout.scheduled_time,
    bout.result
  FROM public.bouts bout
  JOIN public.events event ON event.id = bout.event_id
  JOIN public.event_registrations registration_a ON registration_a.id = bout.fighter_a_registration_id
  JOIN public.event_registrations registration_b ON registration_b.id = bout.fighter_b_registration_id
  WHERE bout.status NOT IN ('cancelled','no_show')
    AND (
      (current_registration.fighter_id IS NOT NULL AND current_registration.fighter_id IN (registration_a.fighter_id, registration_b.fighter_id))
      OR (current_registration.manual_fighter_id IS NOT NULL AND current_registration.manual_fighter_id IN (registration_a.manual_fighter_id, registration_b.manual_fighter_id))
    )
  ORDER BY COALESCE(bout.scheduled_time, bout.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_registration_opponent_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_registration_opponent_history(uuid) TO authenticated;
