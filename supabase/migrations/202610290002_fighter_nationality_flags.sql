-- Publish the fighter-selected nationality code used to render country flags.
-- Passport status and travel preferences remain private and are not exposed.

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
    'country_code', profile.country_code,
    'instagram', profile.instagram,
    'tiktok', profile.tiktok,
    'facebook', profile.facebook,
    'youtube', profile.youtube,
    'x_handle', profile.x_handle,
    'is_banned', profile.is_banned,
    'reliability_score', profile.reliability_score,
    'total_matches', profile.total_matches,
    'cancellations', profile.cancellations,
    'no_shows', profile.no_shows
  ) AS profiles,
  fighter.nationalities
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
  jsonb_build_object('full_name', creator.full_name, 'role', creator.role) AS profiles,
  fighter.nationalities,
  fighter.country_code
FROM public.manual_fighters fighter
JOIN public.profiles creator ON creator.id = fighter.manager_id
WHERE fighter.is_public = true
  AND COALESCE(creator.is_banned, false) = false;

REVOKE ALL ON public.public_fighters FROM PUBLIC;
REVOKE ALL ON public.public_manual_fighters FROM PUBLIC;
GRANT SELECT ON public.public_fighters TO anon, authenticated;
GRANT SELECT ON public.public_manual_fighters TO anon, authenticated;

COMMENT ON COLUMN public.public_fighters.nationalities IS 'Public ISO country codes selected by the fighter for nationality flags.';
COMMENT ON COLUMN public.public_manual_fighters.nationalities IS 'Public ISO country codes selected by the roster manager for nationality flags.';

NOTIFY pgrst, 'reload schema';
