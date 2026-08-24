-- Event staff RPC errors should return stable codes.
-- User-facing Spanish/English text is handled in the app i18n files.

CREATE OR REPLACE FUNCTION public.add_event_staff_by_email(
  target_event_id uuid,
  staff_email text,
  next_staff_role text DEFAULT 'manager'
)
RETURNS public.event_staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile public.profiles%ROWTYPE;
  staff_row public.event_staff%ROWTYPE;
  normalized_role text;
BEGIN
  IF NOT public.is_event_owner_or_admin(target_event_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  normalized_role := COALESCE(NULLIF(trim(next_staff_role), ''), 'manager');
  IF normalized_role NOT IN ('manager', 'operator', 'producer') THEN
    RAISE EXCEPTION 'event_staff_invalid_role';
  END IF;

  SELECT *
  INTO target_profile
  FROM public.profiles
  WHERE lower(email) = lower(trim(staff_email))
  LIMIT 1;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'event_staff_account_not_found';
  END IF;

  IF target_profile.role NOT IN ('manager', 'promoter', 'admin') THEN
    RAISE EXCEPTION 'event_staff_invalid_role';
  END IF;

  INSERT INTO public.event_staff (
    event_id,
    profile_id,
    staff_role,
    is_active,
    invited_by
  ) VALUES (
    target_event_id,
    target_profile.id,
    normalized_role,
    true,
    auth.uid()
  )
  ON CONFLICT (event_id, profile_id) DO UPDATE
    SET staff_role = excluded.staff_role,
        is_active = true,
        invited_by = auth.uid(),
        updated_at = now()
  RETURNING * INTO staff_row;

  RETURN staff_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_event_staff_by_email(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_event_staff_by_email(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_event_staff(staff_uuid uuid)
RETURNS public.event_staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_row public.event_staff%ROWTYPE;
BEGIN
  SELECT *
  INTO staff_row
  FROM public.event_staff
  WHERE id = staff_uuid
  FOR UPDATE;

  IF staff_row.id IS NULL THEN
    RAISE EXCEPTION 'event_staff_assignment_not_found';
  END IF;

  IF NOT public.is_event_owner_or_admin(staff_row.event_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.event_staff
  SET is_active = false,
      updated_at = now()
  WHERE id = staff_uuid
  RETURNING * INTO staff_row;

  RETURN staff_row;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_event_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_event_staff(uuid) TO authenticated;
