-- Manual roster fighters can practice multiple disciplines just like platform
-- fighters. Keep the historical singular column synchronized as a compatibility
-- mirror so existing registrations and older clients continue to work.

ALTER TABLE public.manual_fighters
  ADD COLUMN IF NOT EXISTS disciplines text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.manual_fighters
SET disciplines = ARRAY[trim(discipline)]
WHERE cardinality(disciplines) = 0
  AND NULLIF(trim(discipline), '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_manual_fighter_disciplines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  source_values text[];
  normalized_values text[];
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.discipline IS DISTINCT FROM OLD.discipline
    AND NEW.disciplines IS NOT DISTINCT FROM OLD.disciplines THEN
    source_values := CASE
      WHEN NULLIF(trim(NEW.discipline), '') IS NULL THEN '{}'::text[]
      ELSE ARRAY[trim(NEW.discipline)]
    END;
  ELSE
    source_values := COALESCE(NEW.disciplines, '{}'::text[]);
  END IF;

  IF TG_OP = 'INSERT'
    AND cardinality(source_values) = 0
    AND NULLIF(trim(NEW.discipline), '') IS NOT NULL THEN
    source_values := ARRAY[trim(NEW.discipline)];
  END IF;

  SELECT COALESCE(array_agg(discipline_value ORDER BY original_position), '{}'::text[])
  INTO normalized_values
  FROM (
    SELECT DISTINCT ON (lower(trim(item)))
      trim(item) AS discipline_value,
      original_position
    FROM unnest(source_values) WITH ORDINALITY AS entries(item, original_position)
    WHERE NULLIF(trim(item), '') IS NOT NULL
    ORDER BY lower(trim(item)), original_position
  ) normalized;

  NEW.disciplines := normalized_values;
  NEW.discipline := normalized_values[1];
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_manual_fighter_disciplines
  ON public.manual_fighters;
CREATE TRIGGER trg_sync_manual_fighter_disciplines
  BEFORE INSERT OR UPDATE OF discipline, disciplines
  ON public.manual_fighters
  FOR EACH ROW EXECUTE FUNCTION public.sync_manual_fighter_disciplines();

CREATE INDEX IF NOT EXISTS idx_manual_fighters_disciplines
  ON public.manual_fighters USING gin (disciplines);

COMMENT ON COLUMN public.manual_fighters.disciplines IS
  'All combat disciplines practiced by this manual roster fighter.';
COMMENT ON COLUMN public.manual_fighters.discipline IS
  'Compatibility mirror of the first value in disciplines.';

-- Preserve the existing public view column order and append disciplines so
-- CREATE OR REPLACE remains compatible with current consumers.
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
  fighter.disciplines
FROM public.manual_fighters fighter
JOIN public.profiles creator ON creator.id = fighter.manager_id
WHERE fighter.is_public = true
  AND COALESCE(creator.is_banned, false) = false;

REVOKE ALL ON FUNCTION public.sync_manual_fighter_disciplines() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.public_manual_fighters FROM PUBLIC;
GRANT SELECT ON public.public_manual_fighters TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
