-- Let new promoters self-declare federated or independent status during signup.
-- This is intentionally additive: the existing Auth profile-creation trigger is
-- left untouched, and only the classification column is populated here.

CREATE OR REPLACE FUNCTION public.apply_promoter_federation_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_status text;
BEGIN
  IF NEW.role <> 'promoter' THEN
    NEW.promoter_federation_status := 'independent';
    RETURN NEW;
  END IF;

  SELECT NULLIF(user_row.raw_user_meta_data->>'promoter_federation_status', '')
  INTO requested_status
  FROM auth.users user_row
  WHERE user_row.id = NEW.id;

  NEW.promoter_federation_status := CASE
    WHEN requested_status IN ('federated', 'independent') THEN requested_status
    ELSE 'independent'
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_promoter_federation_signup() FROM PUBLIC;

DROP TRIGGER IF EXISTS apply_promoter_federation_signup ON public.profiles;
CREATE TRIGGER apply_promoter_federation_signup
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.apply_promoter_federation_signup();
