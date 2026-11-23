-- Stable, human-readable public URLs for events and fighter profiles.
-- Existing UUID URLs remain valid because application routes resolve either
-- the UUID primary key or this slug.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.fighters ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.manual_fighters ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.url_slug(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
  SELECT trim(BOTH '-' FROM regexp_replace(
    translate(
      lower(value),
      'áàäâãåéèëêíìïîóòöôõúùüûñçýÿæœ',
      'aaaaaaeeeeiiiiooooouuuuncyyao'
    ),
    '[^[:alnum:]]+',
    '-',
    'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.assign_event_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  base_slug text;
  candidate text;
  suffix integer := 2;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    NEW.slug := OLD.slug;
    RETURN NEW;
  END IF;

  base_slug := NULLIF(public.url_slug(NEW.event_name), '');
  base_slug := COALESCE(base_slug, 'event');
  IF base_slug = 'create' THEN
    base_slug := 'event-create';
  END IF;
  candidate := base_slug;

  WHILE EXISTS (
    SELECT 1 FROM public.events existing
    WHERE existing.slug = candidate AND existing.id <> NEW.id
  ) LOOP
    candidate := base_slug || '-' || suffix;
    suffix := suffix + 1;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_fighter_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  fighter_name text;
  base_slug text;
  candidate text;
  suffix integer := 2;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    NEW.slug := OLD.slug;
    RETURN NEW;
  END IF;

  SELECT profile.full_name INTO fighter_name
  FROM public.profiles profile
  WHERE profile.id = NEW.profile_id;

  base_slug := NULLIF(public.url_slug(COALESCE(fighter_name, '')), '');
  base_slug := COALESCE(base_slug, 'fighter');
  IF base_slug = 'manual' THEN
    base_slug := 'fighter-manual';
  END IF;
  candidate := base_slug;

  WHILE EXISTS (
    SELECT 1 FROM public.fighters existing
    WHERE existing.slug = candidate AND existing.id <> NEW.id
  ) LOOP
    candidate := base_slug || '-' || suffix;
    suffix := suffix + 1;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_manual_fighter_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  base_slug text;
  candidate text;
  suffix integer := 2;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    NEW.slug := OLD.slug;
    RETURN NEW;
  END IF;

  base_slug := NULLIF(public.url_slug(NEW.full_name), '');
  base_slug := COALESCE(base_slug, 'fighter');
  candidate := base_slug;

  WHILE EXISTS (
    SELECT 1 FROM public.manual_fighters existing
    WHERE existing.slug = candidate AND existing.id <> NEW.id
  ) LOOP
    candidate := base_slug || '-' || suffix;
    suffix := suffix + 1;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_event_slug ON public.events;
CREATE TRIGGER assign_event_slug
  BEFORE INSERT OR UPDATE OF slug, event_name ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.assign_event_slug();

DROP TRIGGER IF EXISTS assign_fighter_slug ON public.fighters;
CREATE TRIGGER assign_fighter_slug
  BEFORE INSERT OR UPDATE OF slug, profile_id ON public.fighters
  FOR EACH ROW EXECUTE FUNCTION public.assign_fighter_slug();

DROP TRIGGER IF EXISTS assign_manual_fighter_slug ON public.manual_fighters;
CREATE TRIGGER assign_manual_fighter_slug
  BEFORE INSERT OR UPDATE OF slug, full_name ON public.manual_fighters
  FOR EACH ROW EXECUTE FUNCTION public.assign_manual_fighter_slug();

-- Backfill through the same collision-safe trigger logic used for new rows.
DO $$
DECLARE row_id uuid;
BEGIN
  FOR row_id IN SELECT id FROM public.events WHERE slug IS NULL ORDER BY created_at, id LOOP
    UPDATE public.events SET slug = NULL WHERE id = row_id;
  END LOOP;
  FOR row_id IN SELECT id FROM public.fighters WHERE slug IS NULL ORDER BY created_at, id LOOP
    UPDATE public.fighters SET slug = NULL WHERE id = row_id;
  END LOOP;
  FOR row_id IN SELECT id FROM public.manual_fighters WHERE slug IS NULL ORDER BY created_at, id LOOP
    UPDATE public.manual_fighters SET slug = NULL WHERE id = row_id;
  END LOOP;
END;
$$;

ALTER TABLE public.events ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.fighters ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.manual_fighters ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_key ON public.events(slug);
CREATE UNIQUE INDEX IF NOT EXISTS fighters_slug_key ON public.fighters(slug);
CREATE UNIQUE INDEX IF NOT EXISTS manual_fighters_slug_key ON public.manual_fighters(slug);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_slug_format;
ALTER TABLE public.events ADD CONSTRAINT events_slug_format CHECK (slug ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$');
ALTER TABLE public.fighters DROP CONSTRAINT IF EXISTS fighters_slug_format;
ALTER TABLE public.fighters ADD CONSTRAINT fighters_slug_format CHECK (slug ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$');
ALTER TABLE public.manual_fighters DROP CONSTRAINT IF EXISTS manual_fighters_slug_format;
ALTER TABLE public.manual_fighters ADD CONSTRAINT manual_fighters_slug_format CHECK (slug ~ '^[[:alnum:]]+(-[[:alnum:]]+)*$');

-- Preserve all currently deployed public-view columns and append the slug.
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
    AS available_to_travel_internationally,
  fighter.slug
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
      AND (NULLIF(btrim(profile.country_code), '') IS NOT NULL OR NULLIF(btrim(profile.country), '') IS NOT NULL)
      AND EXISTS (SELECT 1 FROM unnest(COALESCE(fighter.nationalities, ARRAY[]::text[])) AS nationality(value) WHERE NULLIF(btrim(nationality.value), '') IS NOT NULL)
      AND NULLIF(btrim(profile.instagram), '') IS NOT NULL
      AND EXISTS (SELECT 1 FROM unnest(COALESCE(fighter.disciplines, ARRAY[]::text[])) AS discipline(value) WHERE NULLIF(btrim(discipline.value), '') IS NOT NULL)
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
    AS available_to_travel_internationally,
  fighter.slug
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
      AND (NULLIF(btrim(fighter.country_code), '') IS NOT NULL OR NULLIF(btrim(fighter.country), '') IS NOT NULL)
      AND EXISTS (SELECT 1 FROM unnest(COALESCE(fighter.nationalities, ARRAY[]::text[])) AS nationality(value) WHERE NULLIF(btrim(nationality.value), '') IS NOT NULL)
      AND NULLIF(btrim(fighter.instagram), '') IS NOT NULL
      AND (
        NULLIF(btrim(fighter.discipline), '') IS NOT NULL
        OR EXISTS (SELECT 1 FROM unnest(COALESCE(fighter.disciplines, ARRAY[]::text[])) AS discipline(value) WHERE NULLIF(btrim(discipline.value), '') IS NOT NULL)
      )
      AND NULLIF(btrim(fighter.weight_class), '') IS NOT NULL
      AND NULLIF(btrim(fighter.gym_name), '') IS NOT NULL
    )
  );

REVOKE ALL ON public.public_fighters FROM PUBLIC;
REVOKE ALL ON public.public_manual_fighters FROM PUBLIC;
GRANT SELECT ON public.public_fighters TO anon, authenticated;
GRANT SELECT ON public.public_manual_fighters TO anon, authenticated;

REVOKE ALL ON FUNCTION public.url_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_event_slug() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_fighter_slug() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_manual_fighter_slug() FROM PUBLIC;

COMMENT ON COLUMN public.events.slug IS 'Stable human-readable public URL identifier.';
COMMENT ON COLUMN public.fighters.slug IS 'Stable human-readable public URL identifier.';
COMMENT ON COLUMN public.manual_fighters.slug IS 'Stable human-readable public URL identifier.';

NOTIFY pgrst, 'reload schema';
