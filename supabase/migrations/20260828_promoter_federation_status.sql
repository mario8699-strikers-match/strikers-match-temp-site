-- Promoter federation classification.
-- Existing promoters default to independent until explicitly marked federated.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS promoter_federation_status text NOT NULL DEFAULT 'independent';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_promoter_federation_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_promoter_federation_status_check
  CHECK (promoter_federation_status IN ('federated', 'independent'));

CREATE INDEX IF NOT EXISTS idx_profiles_role_federation_status
  ON public.profiles(role, promoter_federation_status);

CREATE OR REPLACE FUNCTION public.admin_update_promoter_federation_status(
  target_profile_id uuid,
  new_status text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_profile public.profiles%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF new_status NOT IN ('federated', 'independent') THEN
    RAISE EXCEPTION 'invalid_promoter_federation_status';
  END IF;

  UPDATE public.profiles
  SET promoter_federation_status = new_status
  WHERE id = target_profile_id
    AND role = 'promoter'
  RETURNING * INTO updated_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'promoter_not_found';
  END IF;

  RETURN updated_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_promoter_federation_status(uuid, text) TO authenticated;
