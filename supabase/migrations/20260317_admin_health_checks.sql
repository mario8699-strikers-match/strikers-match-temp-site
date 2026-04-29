-- =============================================
-- Admin health check: detect data-integrity drift
-- =============================================
-- Exposes a SECURITY DEFINER RPC that admins call from the dashboard.
-- Currently checks:
--   - orphan_fighter_profiles: profiles with role='fighter' but no fighters row
--
-- Add future checks as additional keys in the returned JSON object.

CREATE OR REPLACE FUNCTION public.admin_health_checks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_role text;
  v_orphan_fighters int;
BEGIN
  -- Only admins may call this
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT COUNT(*) INTO v_orphan_fighters
  FROM public.profiles p
  WHERE p.role = 'fighter'
    AND NOT EXISTS (SELECT 1 FROM public.fighters f WHERE f.profile_id = p.id);

  RETURN jsonb_build_object(
    'orphan_fighters', v_orphan_fighters,
    'checked_at', now()
  );
END;
$function$;

-- Heal: create missing fighters rows. Admin-only.
CREATE OR REPLACE FUNCTION public.admin_heal_orphan_fighters()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_role text;
  v_inserted int;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  WITH inserted AS (
    INSERT INTO public.fighters (profile_id, gym_name)
    SELECT p.id, NULL
    FROM public.profiles p
    WHERE p.role = 'fighter'
      AND NOT EXISTS (SELECT 1 FROM public.fighters f WHERE f.profile_id = p.id)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$function$;

-- Allow authenticated users to invoke (RPC itself gates on role)
GRANT EXECUTE ON FUNCTION public.admin_health_checks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_heal_orphan_fighters() TO authenticated;
