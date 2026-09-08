-- Guided promoter/manager onboarding and resumable contextual help.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarding_updated_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_onboarding_step_range,
  ADD CONSTRAINT profiles_onboarding_step_range CHECK (onboarding_step BETWEEN 0 AND 8);

CREATE OR REPLACE FUNCTION public.update_guided_onboarding(
  next_step integer DEFAULT NULL,
  next_event_id uuid DEFAULT NULL,
  next_completed boolean DEFAULT NULL,
  next_dismissed boolean DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_row public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF next_step IS NOT NULL AND (next_step < 0 OR next_step > 8) THEN
    RAISE EXCEPTION 'Onboarding step must be between 0 and 8.';
  END IF;
  IF next_event_id IS NOT NULL AND NOT public.is_event_operator(next_event_id) THEN
    RAISE EXCEPTION 'The onboarding event must be managed by the current user.';
  END IF;

  UPDATE public.profiles
  SET onboarding_step = COALESCE(next_step, onboarding_step),
      onboarding_event_id = COALESCE(next_event_id, onboarding_event_id),
      onboarding_completed = COALESCE(next_completed, onboarding_completed),
      onboarding_dismissed = COALESCE(next_dismissed, onboarding_dismissed),
      onboarding_updated_at = now(),
      updated_at = now()
  WHERE id = auth.uid()
    AND role IN ('promoter','manager')
  RETURNING * INTO profile_row;

  IF profile_row.id IS NULL THEN
    RAISE EXCEPTION 'Guided onboarding is only available to promoters and managers.';
  END IF;
  RETURN profile_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_guided_onboarding(integer,uuid,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_guided_onboarding(integer,uuid,boolean,boolean) TO authenticated;

COMMENT ON COLUMN public.profiles.onboarding_step IS
  'Current guided promoter/manager onboarding step. Zero means the welcome screen; valid guided steps are 1 through 8.';
