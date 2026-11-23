-- Only recognized event organizers may create events. The previous policies
-- checked ownership but did not validate the account role.

CREATE OR REPLACE FUNCTION public.can_create_events()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = auth.uid()
      AND COALESCE(profile.is_banned, false) = false
      AND profile.role = ANY (ARRAY[
        'admin',
        'manager',
        'promoter',
        'gyms_academies'
      ]::text[])
  );
$$;

REVOKE ALL ON FUNCTION public.can_create_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_events() TO authenticated;

DROP POLICY IF EXISTS "events_insert_promoter" ON public.events;
DROP POLICY IF EXISTS "events_insert_promoter_only" ON public.events;
DROP POLICY IF EXISTS "events_insert_authorized_creator" ON public.events;

CREATE POLICY "events_insert_authorized_creator"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    promoter_id = auth.uid()
    AND public.can_create_events()
  );

COMMENT ON FUNCTION public.can_create_events() IS
  'True only for active admins, managers, promoters, and gym/coach accounts.';

NOTIFY pgrst, 'reload schema';
