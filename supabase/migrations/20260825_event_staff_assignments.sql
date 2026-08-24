-- Event staff assignments
-- Lets event owners/admins assign specific users to operate a specific event.

CREATE TABLE IF NOT EXISTS public.event_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_role text NOT NULL DEFAULT 'manager' CHECK (staff_role IN ('manager', 'operator', 'producer')),
  is_active boolean NOT NULL DEFAULT true,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_event_staff_event_id ON public.event_staff(event_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_profile_id ON public.event_staff(profile_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_active ON public.event_staff(event_id, profile_id, is_active);

ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_event_owner_or_admin(target_event_id uuid)
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

REVOKE ALL ON FUNCTION public.is_event_owner_or_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_event_owner_or_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_event_operator(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_event_owner_or_admin(target_event_id)
    OR EXISTS (
      SELECT 1
      FROM public.event_staff staff
      WHERE staff.event_id = target_event_id
        AND staff.profile_id = auth.uid()
        AND staff.is_active = true
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_staff' AND policyname = 'event_staff_select_operator') THEN
    CREATE POLICY "event_staff_select_operator" ON public.event_staff
      FOR SELECT USING (public.is_event_operator(event_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_staff' AND policyname = 'event_staff_insert_owner_admin') THEN
    CREATE POLICY "event_staff_insert_owner_admin" ON public.event_staff
      FOR INSERT WITH CHECK (public.is_event_owner_or_admin(event_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_staff' AND policyname = 'event_staff_update_owner_admin') THEN
    CREATE POLICY "event_staff_update_owner_admin" ON public.event_staff
      FOR UPDATE USING (public.is_event_owner_or_admin(event_id))
      WITH CHECK (public.is_event_owner_or_admin(event_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_staff' AND policyname = 'event_staff_delete_owner_admin') THEN
    CREATE POLICY "event_staff_delete_owner_admin" ON public.event_staff
      FOR DELETE USING (public.is_event_owner_or_admin(event_id));
  END IF;
END $$;

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
    RAISE EXCEPTION 'Not authorized';
  END IF;

  normalized_role := COALESCE(NULLIF(trim(next_staff_role), ''), 'manager');
  IF normalized_role NOT IN ('manager', 'operator', 'producer') THEN
    RAISE EXCEPTION 'Invalid staff role';
  END IF;

  SELECT *
  INTO target_profile
  FROM public.profiles
  WHERE lower(email) = lower(trim(staff_email))
  LIMIT 1;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'No se encontró una cuenta con ese email.';
  END IF;

  IF target_profile.role NOT IN ('manager', 'promoter', 'admin') THEN
    RAISE EXCEPTION 'Solo managers, promotores o admins pueden operar un evento.';
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
    RAISE EXCEPTION 'Staff assignment not found';
  END IF;

  IF NOT public.is_event_owner_or_admin(staff_row.event_id) THEN
    RAISE EXCEPTION 'Not authorized';
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
