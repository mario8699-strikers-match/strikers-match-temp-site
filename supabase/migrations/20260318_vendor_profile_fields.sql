-- 20260318_vendor_profile_fields.sql
-- Add vendor-facing profile fields (bio, instagram, is_available) to profiles.
-- Extend handle_new_user trigger to persist them from auth.users.raw_user_meta_data.
-- profiles.is_available is only *read* for VENDOR_ROLES on /professionals.
-- Fighters continue using fighters.is_available unchanged.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio          text,
  ADD COLUMN IF NOT EXISTS instagram    text,
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_role_available
  ON public.profiles (role, is_available);

-- Rewrite handle_new_user to also carry bio/instagram when provided.
-- Retains the fighter-row auto-insert added in 20260316.
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

  INSERT INTO public.profiles (
    id, full_name, email, role, city, phone, date_of_birth, bio, instagram
  )
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    v_role,
    nullif(new.raw_user_meta_data->>'city', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    nullif(new.raw_user_meta_data->>'bio', ''),
    nullif(new.raw_user_meta_data->>'instagram', '')
  );

  IF v_role = 'fighter' THEN
    INSERT INTO public.fighters (profile_id, gym_name)
    VALUES (new.id, nullif(new.raw_user_meta_data->>'gym_name', ''));
  END IF;

  RETURN new;
END;
$function$;
