-- Matchmaking discipline enforcement
-- A matchup must have a compatible combat discipline before it can become a match or bout.

CREATE OR REPLACE FUNCTION public.event_registration_disciplines_match(
  registration_a_id uuid,
  registration_b_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH registration_data AS (
    SELECT
      lower(nullif(trim(reg_a.registered_discipline), '')) AS registered_a,
      lower(nullif(trim(reg_b.registered_discipline), '')) AS registered_b,
      COALESCE(fighter_a.disciplines, '{}'::text[]) AS disciplines_a,
      COALESCE(fighter_b.disciplines, '{}'::text[]) AS disciplines_b
    FROM public.event_registrations reg_a
    JOIN public.event_registrations reg_b
      ON reg_b.id = registration_b_id
    JOIN public.fighters fighter_a
      ON fighter_a.id = reg_a.fighter_id
    JOIN public.fighters fighter_b
      ON fighter_b.id = reg_b.fighter_id
    WHERE reg_a.id = registration_a_id
      AND reg_a.event_id = reg_b.event_id
  ),
  a_disciplines AS (
    SELECT registered_a AS discipline
    FROM registration_data
    WHERE registered_a IS NOT NULL
    UNION
    SELECT lower(nullif(trim(unnest(disciplines_a)), '')) AS discipline
    FROM registration_data
  ),
  b_disciplines AS (
    SELECT registered_b AS discipline
    FROM registration_data
    WHERE registered_b IS NOT NULL
    UNION
    SELECT lower(nullif(trim(unnest(disciplines_b)), '')) AS discipline
    FROM registration_data
  )
  SELECT COALESCE((
    SELECT CASE
      WHEN data.registered_a IS NOT NULL AND data.registered_b IS NOT NULL
        THEN data.registered_a = data.registered_b
      WHEN data.registered_a IS NOT NULL
        THEN EXISTS (
          SELECT 1
          FROM b_disciplines b
          WHERE b.discipline = data.registered_a
        )
      WHEN data.registered_b IS NOT NULL
        THEN EXISTS (
          SELECT 1
          FROM a_disciplines a
          WHERE a.discipline = data.registered_b
        )
      ELSE EXISTS (
        SELECT 1
        FROM a_disciplines a
        JOIN b_disciplines b
          ON b.discipline = a.discipline
        WHERE a.discipline IS NOT NULL
      )
    END
    FROM registration_data data
  ), false);
$$;

REVOKE ALL ON FUNCTION public.event_registration_disciplines_match(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_registration_disciplines_match(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_match_discipline_compatible(
  target_event_id uuid,
  target_fighter_a_id uuid,
  target_fighter_b_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_a_id uuid;
  registration_b_id uuid;
BEGIN
  IF target_fighter_a_id = target_fighter_b_id THEN
    RAISE EXCEPTION 'No se puede emparejar a un peleador consigo mismo.';
  END IF;

  SELECT id INTO registration_a_id
  FROM public.event_registrations
  WHERE event_id = target_event_id
    AND fighter_id = target_fighter_a_id;

  SELECT id INTO registration_b_id
  FROM public.event_registrations
  WHERE event_id = target_event_id
    AND fighter_id = target_fighter_b_id;

  IF registration_a_id IS NULL OR registration_b_id IS NULL THEN
    RAISE EXCEPTION 'Ambos peleadores deben estar registrados en el evento.';
  END IF;

  IF NOT public.event_registration_disciplines_match(registration_a_id, registration_b_id) THEN
    RAISE EXCEPTION 'Las disciplinas no son compatibles para esta propuesta.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_match_discipline_compatible(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_match_discipline_compatible(uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_match_discipline_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_match_discipline_compatible(
    NEW.event_id,
    NEW.fighter_a_id,
    NEW.fighter_b_id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_bout_discipline_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.event_registration_disciplines_match(
    NEW.fighter_a_registration_id,
    NEW.fighter_b_registration_id
  ) THEN
    RAISE EXCEPTION 'Las disciplinas no son compatibles para este bout.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matches_discipline_compatibility ON public.matches;
CREATE TRIGGER trg_matches_discipline_compatibility
  BEFORE INSERT OR UPDATE OF event_id, fighter_a_id, fighter_b_id
  ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_match_discipline_compatibility();

DROP TRIGGER IF EXISTS trg_bouts_discipline_compatibility ON public.bouts;
CREATE TRIGGER trg_bouts_discipline_compatibility
  BEFORE INSERT OR UPDATE OF fighter_a_registration_id, fighter_b_registration_id
  ON public.bouts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_bout_discipline_compatibility();
