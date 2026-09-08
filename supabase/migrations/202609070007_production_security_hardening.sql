-- Production security hardening for authentication, public profile data,
-- fighter registration, and protected moderation fields.

-- ---------------------------------------------------------------------------
-- Signup roles: public signup can never create an administrator.
-- Existing users, passwords, sessions, and profile rows are not modified.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text := COALESCE(NULLIF(new.raw_user_meta_data->>'role', ''), 'promoter');
  safe_role text;
BEGIN
  safe_role := CASE
    WHEN requested_role IN (
      'fighter','spectator','promoter','manager','sponsor',
      'gyms_academies','recovery_wellness','gear_apparel',
      'nutrition_supplements','local_business','other_service',
      'ring_card_girl','photographer','videographer','broadcast_personality',
      'catering_vendor','venue_rental','judge','ring_rental','ring_announcer',
      'cutman','merchandise_vendor','ringside_doctor','ringside_emt'
    ) THEN requested_role
    ELSE 'spectator'
  END;

  INSERT INTO public.profiles (
    id, full_name, email, role, city, phone, date_of_birth, bio, instagram
  ) VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.email, ''),
    safe_role,
    NULLIF(new.raw_user_meta_data->>'city', ''),
    NULLIF(new.raw_user_meta_data->>'phone', ''),
    NULLIF(new.raw_user_meta_data->>'date_of_birth', '')::date,
    NULLIF(new.raw_user_meta_data->>'bio', ''),
    NULLIF(new.raw_user_meta_data->>'instagram', '')
  );

  IF safe_role = 'fighter' THEN
    INSERT INTO public.fighters (profile_id, gym_name)
    VALUES (new.id, NULLIF(new.raw_user_meta_data->>'gym_name', ''));
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- A signed-in user may edit normal profile fields, but never grant themselves
-- admin access, remove a ban, forge reliability, or change admin classification.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = auth.uid() AND profile.role = 'admin'
  ) INTO actor_is_admin;

  IF actor_is_admin THEN RETURN NEW; END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
    OR NEW.promoter_federation_status IS DISTINCT FROM OLD.promoter_federation_status
    OR NEW.reliability_score IS DISTINCT FROM OLD.reliability_score
    OR NEW.total_matches IS DISTINCT FROM OLD.total_matches
    OR NEW.cancellations IS DISTINCT FROM OLD.cancellations
    OR NEW.no_shows IS DISTINCT FROM OLD.no_shows
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'protected_profile_field';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = auth.uid() AND profile.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP TRIGGER IF EXISTS protect_profile_security_fields ON public.profiles;
CREATE TRIGGER protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Fighter verification and visibility are moderation fields.
CREATE OR REPLACE FUNCTION public.protect_fighter_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = auth.uid() AND profile.role = 'admin'
  ) INTO actor_is_admin;

  IF TG_OP = 'INSERT' THEN
    IF NOT actor_is_admin THEN
      NEW.verified := false;
      NEW.is_hidden := false;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT actor_is_admin AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
    OR NEW.verified IS DISTINCT FROM OLD.verified
    OR NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'protected_fighter_field';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_fighter_security_fields ON public.fighters;
CREATE TRIGGER protect_fighter_security_fields
  BEFORE INSERT OR UPDATE ON public.fighters
  FOR EACH ROW EXECUTE FUNCTION public.protect_fighter_security_fields();

DROP POLICY IF EXISTS "fighters_insert_own" ON public.fighters;
CREATE POLICY "fighters_insert_own" ON public.fighters
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles profile
      WHERE profile.id = auth.uid() AND profile.role = 'fighter'
    )
  );

-- ---------------------------------------------------------------------------
-- Explicit public projections. They expose directory/card information without
-- authentication, while dates of birth, medical data, restrictions, private
-- notes, onboarding state, and representative contact details stay private.
-- Professional/sponsor contact fields remain visible because those profiles
-- intentionally publish a contact card.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT
  profile.id,
  profile.full_name,
  CASE WHEN profile.role = 'sponsor'
      OR profile.role IN (
        'gyms_academies','recovery_wellness','gear_apparel','nutrition_supplements',
        'local_business','other_service','ring_card_girl','photographer','videographer',
        'broadcast_personality','catering_vendor','venue_rental','judge','ring_rental',
        'ring_announcer','cutman','merchandise_vendor','ringside_doctor','ringside_emt'
      )
      OR profile.additional_roles && ARRAY[
        'gyms_academies','recovery_wellness','gear_apparel','nutrition_supplements',
        'local_business','other_service','ring_card_girl','photographer','videographer',
        'broadcast_personality','catering_vendor','venue_rental','judge','ring_rental',
        'ring_announcer','cutman','merchandise_vendor','ringside_doctor','ringside_emt'
      ]::text[]
    THEN profile.email ELSE NULL END AS email,
  profile.role,
  profile.city,
  profile.state,
  profile.country,
  CASE WHEN profile.role = 'sponsor'
      OR profile.role IN (
        'gyms_academies','recovery_wellness','gear_apparel','nutrition_supplements',
        'local_business','other_service','ring_card_girl','photographer','videographer',
        'broadcast_personality','catering_vendor','venue_rental','judge','ring_rental',
        'ring_announcer','cutman','merchandise_vendor','ringside_doctor','ringside_emt'
      )
      OR profile.additional_roles && ARRAY[
        'gyms_academies','recovery_wellness','gear_apparel','nutrition_supplements',
        'local_business','other_service','ring_card_girl','photographer','videographer',
        'broadcast_personality','catering_vendor','venue_rental','judge','ring_rental',
        'ring_announcer','cutman','merchandise_vendor','ringside_doctor','ringside_emt'
      ]::text[]
    THEN profile.phone ELSE NULL END AS phone,
  profile.bio,
  profile.instagram,
  profile.photo_url,
  profile.promoter_federation_status,
  profile.is_available,
  profile.additional_roles,
  false AS is_banned,
  profile.reliability_score,
  profile.total_matches,
  profile.cancellations,
  profile.no_shows,
  profile.created_at,
  profile.updated_at
FROM public.profiles profile
WHERE profile.role <> 'admin' AND COALESCE(profile.is_banned, false) = false;

CREATE OR REPLACE VIEW public.public_fighters
WITH (security_barrier = true)
AS
SELECT
  fighter.id,
  fighter.profile_id,
  fighter.nickname,
  fighter.bio,
  fighter.weight_class,
  fighter.disciplines,
  fighter.exact_weight,
  fighter.height_cm,
  fighter.reach_cm,
  fighter.gym_name,
  fighter.state,
  profile.city AS profile_city,
  fighter.record_wins,
  fighter.record_losses,
  fighter.record_draws,
  fighter.is_available,
  fighter.short_notice_ready,
  fighter.experience_level,
  fighter.photo_url,
  fighter.gender_division,
  fighter.ko_wins,
  fighter.tko_wins,
  fighter.ko_losses,
  fighter.tko_losses,
  fighter.skill_rating,
  fighter.preferred_rulesets,
  fighter.requested_weight_kg,
  fighter.acceptable_weight_min_kg,
  fighter.acceptable_weight_max_kg,
  fighter.last_fight_at,
  fighter.verified,
  fighter.is_hidden,
  fighter.created_at,
  CASE WHEN profile.date_of_birth IS NULL THEN NULL
    ELSE EXTRACT(YEAR FROM age(current_date, profile.date_of_birth))::integer END AS age,
  jsonb_build_object(
    'full_name', profile.full_name,
    'city', profile.city,
    'state', profile.state,
    'country', profile.country,
    'is_banned', profile.is_banned,
    'reliability_score', profile.reliability_score,
    'total_matches', profile.total_matches,
    'cancellations', profile.cancellations,
    'no_shows', profile.no_shows
  ) AS profiles
FROM public.fighters fighter
JOIN public.profiles profile ON profile.id = fighter.profile_id
WHERE COALESCE(fighter.is_hidden, false) = false
  AND COALESCE(profile.is_banned, false) = false;

CREATE OR REPLACE VIEW public.public_manual_fighters
WITH (security_barrier = true)
AS
SELECT
  fighter.id,
  fighter.manager_id,
  fighter.full_name,
  fighter.nickname,
  fighter.weight_class,
  fighter.discipline,
  fighter.record_wins,
  fighter.record_losses,
  fighter.record_draws,
  fighter.city,
  fighter.state,
  fighter.country,
  fighter.gym_name,
  fighter.experience_level,
  fighter.photo_url,
  fighter.bio,
  fighter.height_cm,
  fighter.reach_cm,
  fighter.is_available,
  fighter.is_public,
  fighter.gender_division,
  fighter.exact_weight,
  fighter.ko_wins,
  fighter.tko_wins,
  fighter.ko_losses,
  fighter.tko_losses,
  fighter.skill_rating,
  fighter.preferred_rulesets,
  fighter.requested_weight_kg,
  fighter.acceptable_weight_min_kg,
  fighter.acceptable_weight_max_kg,
  fighter.last_fight_at,
  fighter.created_at,
  fighter.updated_at,
  CASE WHEN fighter.date_of_birth IS NULL THEN NULL
    ELSE EXTRACT(YEAR FROM age(current_date, fighter.date_of_birth))::integer END AS age,
  jsonb_build_object('full_name', creator.full_name, 'role', creator.role) AS profiles
FROM public.manual_fighters fighter
JOIN public.profiles creator ON creator.id = fighter.manager_id
WHERE fighter.is_public = true
  AND COALESCE(creator.is_banned, false) = false;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
REVOKE ALL ON public.public_fighters FROM PUBLIC;
REVOKE ALL ON public.public_manual_fighters FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT SELECT ON public.public_fighters TO anon, authenticated;
GRANT SELECT ON public.public_manual_fighters TO anon, authenticated;

-- Anonymous callers may only read the columns required for safe nested joins.
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, full_name, role, city, state, country, bio, instagram, photo_url,
  promoter_federation_status, is_available, additional_roles, is_banned,
  reliability_score, total_matches, cancellations, no_shows, created_at, updated_at
) ON public.profiles TO anon;

REVOKE SELECT ON public.fighters FROM anon;
GRANT SELECT (
  id, profile_id, nickname, bio, weight_class, disciplines, exact_weight,
  height_cm, reach_cm, gym_name, state, record_wins, record_losses,
  record_draws, is_available, short_notice_ready, experience_level, photo_url,
  gender_division, ko_wins, tko_wins, ko_losses, tko_losses, skill_rating,
  preferred_rulesets, requested_weight_kg, acceptable_weight_min_kg,
  acceptable_weight_max_kg, last_fight_at, verified, is_hidden, created_at
) ON public.fighters TO anon;

REVOKE SELECT ON public.manual_fighters FROM anon;
GRANT SELECT (
  id, manager_id, full_name, nickname, weight_class, discipline, record_wins,
  record_losses, record_draws, city, state, country, gym_name, experience_level,
  photo_url, bio, height_cm, reach_cm, is_available, is_public,
  gender_division, exact_weight, ko_wins, tko_wins, ko_losses, tko_losses,
  skill_rating, preferred_rulesets, requested_weight_kg,
  acceptable_weight_min_kg, acceptable_weight_max_kg, last_fight_at,
  created_at, updated_at
) ON public.manual_fighters TO anon;

-- ---------------------------------------------------------------------------
-- Fighter-owned registration actions are atomic and expose no protected fields.
-- Event operators retain their existing event-scoped management policy.
-- ---------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.submit_event_registration_payment(registration_uuid uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_row public.event_registrations%ROWTYPE;
BEGIN
  SELECT registration.* INTO registration_row
  FROM public.event_registrations registration
  JOIN public.fighters fighter ON fighter.id = registration.fighter_id
  WHERE registration.id = registration_uuid
    AND fighter.profile_id = auth.uid()
  FOR UPDATE OF registration;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found or not authorized.'; END IF;
  IF registration_row.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'Payment was already submitted or confirmed.';
  END IF;

  UPDATE public.event_registrations
  SET payment_status = 'submitted', submitted_at = now(), updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_event_registration_payment(registration_uuid uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_row public.event_registrations%ROWTYPE;
BEGIN
  SELECT * INTO registration_row
  FROM public.event_registrations
  WHERE id = registration_uuid
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM public.assert_event_operator(registration_row.event_id);
  IF registration_row.payment_status <> 'submitted' THEN
    RAISE EXCEPTION 'Only a submitted payment can be confirmed.';
  END IF;

  UPDATE public.event_registrations
  SET payment_status = 'confirmed', confirmed_at = now(), updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

DROP POLICY IF EXISTS "reg_insert_own_fighter" ON public.event_registrations;
DROP POLICY IF EXISTS "reg_update_own_fighter" ON public.event_registrations;
REVOKE INSERT ON public.event_registrations FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.register_self_for_event(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_event_registration_payment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_event_registration_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_self_for_event(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_event_registration_payment(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
