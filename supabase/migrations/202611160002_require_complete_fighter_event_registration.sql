-- Require the public fighter-profile essentials for new fighter-initiated
-- event applications and registrations. Existing rows are intentionally not
-- updated, rejected, or deleted.

CREATE OR REPLACE FUNCTION public.fighter_registration_profile_missing_fields(
  target_fighter_id uuid
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN NULLIF(trim(fighter.photo_url), '') IS NULL THEN 'photo' END,
    CASE WHEN NULLIF(trim(profile.full_name), '') IS NULL
      OR trim(profile.full_name) !~ '[[:space:]]' THEN 'fullName' END,
    CASE WHEN NULLIF(trim(profile.country_code), '') IS NULL
      AND NULLIF(trim(profile.country), '') IS NULL THEN 'country' END,
    CASE WHEN COALESCE(cardinality(fighter.nationalities), 0) = 0 THEN 'nationality' END,
    CASE WHEN NULLIF(trim(profile.instagram), '') IS NULL
      OR trim(profile.instagram) !~* '^(@?[A-Za-z0-9._-]{1,100}|https?://(www\.)?instagram\.com/[^[:space:]]+|www\.instagram\.com/[^[:space:]]+)$'
      THEN 'instagram' END,
    CASE WHEN COALESCE(cardinality(fighter.disciplines), 0) = 0 THEN 'discipline' END,
    CASE WHEN NULLIF(trim(fighter.weight_class), '') IS NULL THEN 'weight' END,
    CASE WHEN NULLIF(trim(fighter.gym_name), '') IS NULL THEN 'team' END
  ], NULL)
  FROM public.fighters fighter
  JOIN public.profiles profile ON profile.id = fighter.profile_id
  WHERE fighter.id = target_fighter_id;
$$;

CREATE OR REPLACE FUNCTION public.register_self_for_event(
  target_event_id uuid,
  target_fighter_id uuid
)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_row public.event_registrations%ROWTYPE;
  missing_fields text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.fighters fighter
    WHERE fighter.id = target_fighter_id AND fighter.profile_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not authorized for this fighter.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events event
    WHERE event.id = target_event_id AND event.status = 'published'
  ) THEN RAISE EXCEPTION 'Event is not open for registration.'; END IF;

  missing_fields := public.fighter_registration_profile_missing_fields(target_fighter_id);
  IF COALESCE(cardinality(missing_fields), 0) > 0 THEN
    RAISE EXCEPTION 'fighter_profile_incomplete:%', array_to_string(missing_fields, ',');
  END IF;

  INSERT INTO public.event_registrations (
    event_id, fighter_id, registration_source, created_by,
    approval_status, payment_status
  ) VALUES (
    target_event_id, target_fighter_id, 'self', auth.uid(), 'pending', 'pending'
  )
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_complete_profile_for_fighter_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fighter_owner uuid;
  missing_fields text[];
BEGIN
  SELECT fighter.profile_id INTO fighter_owner
  FROM public.fighters fighter
  WHERE fighter.id = NEW.fighter_id;

  -- Only fighter-originated applications are gated. Organizer-managed roster
  -- and participant workflows retain their existing behavior.
  IF fighter_owner IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  missing_fields := public.fighter_registration_profile_missing_fields(NEW.fighter_id);
  IF COALESCE(cardinality(missing_fields), 0) > 0 THEN
    RAISE EXCEPTION 'fighter_profile_incomplete:%', array_to_string(missing_fields, ',');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_complete_profile_for_fighter_application
  ON public.event_applications;
CREATE TRIGGER trg_require_complete_profile_for_fighter_application
  BEFORE INSERT ON public.event_applications
  FOR EACH ROW EXECUTE FUNCTION public.require_complete_profile_for_fighter_application();

REVOKE ALL ON FUNCTION public.fighter_registration_profile_missing_fields(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_complete_profile_for_fighter_application()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_self_for_event(uuid,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_self_for_event(uuid,uuid) TO authenticated;

COMMENT ON FUNCTION public.fighter_registration_profile_missing_fields(uuid) IS
  'Returns missing public-profile essentials required for new fighter-initiated event participation.';

NOTIFY pgrst, 'reload schema';
