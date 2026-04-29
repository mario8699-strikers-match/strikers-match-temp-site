-- =============================================
-- Fix: fighter profiles missing fighters row
-- =============================================
-- Bug: handle_new_user trigger created profiles but never a fighters row,
-- so every signup with role='fighter' was invisible on /fighters, /search,
-- /admin/fighters, and could not register for events (fighterService.getByProfileId
-- returned null).
--
-- This migration:
--   1. Backfills a fighters row for every orphan fighter profile.
--   2. Rewrites handle_new_user so it also inserts the fighters row when
--      role='fighter' (uses gym_name from raw_user_meta_data).

-- ── 1. Backfill orphan fighter profiles ──
INSERT INTO public.fighters (profile_id, gym_name)
SELECT p.id, NULL
FROM public.profiles p
WHERE p.role = 'fighter'
  AND NOT EXISTS (SELECT 1 FROM public.fighters f WHERE f.profile_id = p.id);

-- ── 2. Rewrite trigger function to auto-create fighters row ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
BEGIN
  v_role := coalesce(new.raw_user_meta_data->>'role', 'promoter');

  INSERT INTO public.profiles (id, full_name, email, role, city, phone, date_of_birth)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    v_role,
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone',
    CASE
      WHEN new.raw_user_meta_data->>'date_of_birth' IS NOT NULL
      THEN (new.raw_user_meta_data->>'date_of_birth')::date
      ELSE NULL
    END
  );

  -- Auto-create fighters row for fighter role so they're visible immediately
  IF v_role = 'fighter' THEN
    INSERT INTO public.fighters (profile_id, gym_name)
    VALUES (new.id, new.raw_user_meta_data->>'gym_name');
  END IF;

  RETURN new;
END;
$function$;
