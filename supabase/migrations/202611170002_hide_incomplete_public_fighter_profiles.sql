-- Incomplete athlete profiles remain editable by their owners and visible to
-- authorized operational/admin flows, but never enter the public directory,
-- public detail pages, search results, SEO metadata, or sitemap.

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
  NULL::text AS gender_division,
  fighter.ko_wins,
  fighter.tko_wins,
  fighter.ko_losses,
  fighter.tko_losses,
  fighter.skill_rating,
  fighter.preferred_rulesets,
  NULL::numeric AS requested_weight_kg,
  NULL::numeric AS acceptable_weight_min_kg,
  NULL::numeric AS acceptable_weight_max_kg,
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
  fighter.nationalities,
  COALESCE(travel.available_to_travel_internationally, false)
    AS available_to_travel_internationally
FROM public.fighters fighter
JOIN public.profiles profile ON profile.id = fighter.profile_id
LEFT JOIN public.fighter_travel_preferences travel ON travel.fighter_id = fighter.id
WHERE COALESCE(fighter.is_hidden, false) = false
  AND COALESCE(profile.is_banned, false) = false
  AND (
    fighter.created_at < TIMESTAMPTZ '2026-11-17T23:22:40Z'
    OR (
      NULLIF(btrim(fighter.photo_url), '') IS NOT NULL
      AND btrim(profile.full_name) ~ '^[^[:space:]]+[[:space:]]+.+$'
      AND (
        NULLIF(btrim(profile.country_code), '') IS NOT NULL
        OR NULLIF(btrim(profile.country), '') IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(fighter.nationalities, ARRAY[]::text[])) AS nationality(value)
        WHERE NULLIF(btrim(nationality.value), '') IS NOT NULL
      )
      AND NULLIF(btrim(profile.instagram), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(fighter.disciplines, ARRAY[]::text[])) AS discipline(value)
        WHERE NULLIF(btrim(discipline.value), '') IS NOT NULL
      )
      AND NULLIF(btrim(fighter.weight_class), '') IS NOT NULL
      AND NULLIF(btrim(fighter.gym_name), '') IS NOT NULL
    )
  );

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
  NULL::text AS gender_division,
  fighter.exact_weight,
  fighter.ko_wins,
  fighter.tko_wins,
  fighter.ko_losses,
  fighter.tko_losses,
  fighter.skill_rating,
  fighter.preferred_rulesets,
  NULL::numeric AS requested_weight_kg,
  NULL::numeric AS acceptable_weight_min_kg,
  NULL::numeric AS acceptable_weight_max_kg,
  fighter.last_fight_at,
  fighter.created_at,
  fighter.updated_at,
  CASE WHEN fighter.date_of_birth IS NULL THEN NULL
    ELSE EXTRACT(YEAR FROM age(current_date, fighter.date_of_birth))::integer END AS age,
  jsonb_build_object('full_name', creator.full_name, 'role', creator.role) AS profiles,
  fighter.disciplines,
  fighter.nationalities,
  fighter.country_code,
  fighter.instagram,
  COALESCE(travel.available_to_travel_internationally, false)
    AS available_to_travel_internationally
FROM public.manual_fighters fighter
JOIN public.profiles creator ON creator.id = fighter.manager_id
LEFT JOIN public.manual_fighter_travel_preferences travel
  ON travel.manual_fighter_id = fighter.id
WHERE fighter.is_public = true
  AND COALESCE(creator.is_banned, false) = false
  AND (
    fighter.created_at < TIMESTAMPTZ '2026-11-17T23:22:40Z'
    OR (
      NULLIF(btrim(fighter.photo_url), '') IS NOT NULL
      AND btrim(fighter.full_name) ~ '^[^[:space:]]+[[:space:]]+.+$'
      AND (
        NULLIF(btrim(fighter.country_code), '') IS NOT NULL
        OR NULLIF(btrim(fighter.country), '') IS NOT NULL
      )
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(fighter.nationalities, ARRAY[]::text[])) AS nationality(value)
        WHERE NULLIF(btrim(nationality.value), '') IS NOT NULL
      )
      AND NULLIF(btrim(fighter.instagram), '') IS NOT NULL
      AND (
        NULLIF(btrim(fighter.discipline), '') IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(fighter.disciplines, ARRAY[]::text[])) AS discipline(value)
          WHERE NULLIF(btrim(discipline.value), '') IS NOT NULL
        )
      )
      AND NULLIF(btrim(fighter.weight_class), '') IS NOT NULL
      AND NULLIF(btrim(fighter.gym_name), '') IS NOT NULL
    )
  );

REVOKE ALL ON public.public_fighters FROM PUBLIC;
REVOKE ALL ON public.public_manual_fighters FROM PUBLIC;
GRANT SELECT ON public.public_fighters TO anon, authenticated;
GRANT SELECT ON public.public_manual_fighters TO anon, authenticated;

COMMENT ON VIEW public.public_fighters IS
  'Grandfathered athlete profiles plus new profiles that meet all required public fields.';
COMMENT ON VIEW public.public_manual_fighters IS
  'Grandfathered roster profiles plus new profiles that meet all required public fields.';

NOTIFY pgrst, 'reload schema';
