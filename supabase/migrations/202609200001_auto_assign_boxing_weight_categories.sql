-- Automatically assign the event-specific boxing bracket from the fighter's
-- age on the event date and exact registered/profile weight.

CREATE OR REPLACE FUNCTION public.boxing_weight_category(
  fighter_age integer,
  fighter_weight_kg numeric
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF fighter_age IS NULL OR fighter_weight_kg IS NULL OR fighter_weight_kg <= 0 THEN
    RETURN NULL;
  END IF;

  IF fighter_age BETWEEN 13 AND 14 THEN
    RETURN CASE
      WHEN fighter_weight_kg < 35 THEN NULL
      WHEN fighter_weight_kg <= 37 THEN '35–37 kg'
      WHEN fighter_weight_kg <= 40 THEN '37.1–40 kg'
      WHEN fighter_weight_kg <= 42 THEN '40.1–42 kg'
      WHEN fighter_weight_kg <= 44 THEN '42.1–44 kg'
      WHEN fighter_weight_kg <= 46 THEN '44.1–46 kg'
      WHEN fighter_weight_kg <= 48 THEN '46.1–48 kg'
      WHEN fighter_weight_kg <= 50 THEN '48.1–50 kg'
      WHEN fighter_weight_kg <= 53 THEN '50.1–53 kg'
      WHEN fighter_weight_kg <= 55 THEN '53.1–55 kg'
      WHEN fighter_weight_kg <= 57 THEN '55.1–57 kg'
      WHEN fighter_weight_kg <= 60 THEN '57.1–60 kg'
      WHEN fighter_weight_kg <= 63 THEN '60.1–63 kg'
      WHEN fighter_weight_kg <= 66 THEN '63.1–66 kg'
      WHEN fighter_weight_kg <= 69 THEN '66.1–69 kg'
      WHEN fighter_weight_kg <= 72 THEN '69.1–72 kg'
      WHEN fighter_weight_kg <= 75 THEN '72.1–75 kg'
      WHEN fighter_weight_kg <= 78 THEN '75.1–78 kg'
      WHEN fighter_weight_kg <= 81 THEN '78.1–81 kg'
      WHEN fighter_weight_kg <= 85 THEN '81.1–85 kg'
      WHEN fighter_weight_kg <= 90 THEN '85.1–90 kg'
      ELSE '90.1 kg o más'
    END;
  END IF;

  IF fighter_age BETWEEN 15 AND 17 THEN
    RETURN CASE
      WHEN fighter_weight_kg < 46 THEN NULL
      WHEN fighter_weight_kg <= 48 THEN '46–48 kg'
      WHEN fighter_weight_kg <= 51 THEN '48.1–51 kg'
      WHEN fighter_weight_kg <= 54 THEN '51.1–54 kg'
      WHEN fighter_weight_kg <= 57 THEN '54.1–57 kg'
      WHEN fighter_weight_kg <= 60 THEN '57.1–60 kg'
      WHEN fighter_weight_kg <= 63 THEN '60.1–63 kg'
      WHEN fighter_weight_kg <= 66 THEN '63.1–66 kg'
      WHEN fighter_weight_kg <= 69 THEN '66.1–69 kg'
      WHEN fighter_weight_kg <= 72 THEN '69.1–72 kg'
      WHEN fighter_weight_kg <= 75 THEN '72.1–75 kg'
      WHEN fighter_weight_kg <= 78 THEN '75.1–78 kg'
      WHEN fighter_weight_kg <= 81 THEN '78.1–81 kg'
      WHEN fighter_weight_kg <= 85 THEN '81.1–85 kg'
      WHEN fighter_weight_kg <= 90 THEN '85.1–90 kg'
      ELSE '90.1 kg o más'
    END;
  END IF;

  IF fighter_age >= 18 THEN
    RETURN CASE
      WHEN fighter_weight_kg < 46 THEN NULL
      WHEN fighter_weight_kg <= 48 THEN '46–48 kg'
      WHEN fighter_weight_kg <= 51 THEN '48.1–51 kg'
      WHEN fighter_weight_kg <= 54 THEN '51.1–54 kg'
      WHEN fighter_weight_kg <= 57 THEN '54.1–57 kg'
      WHEN fighter_weight_kg <= 60 THEN '57.1–60 kg'
      WHEN fighter_weight_kg <= 63 THEN '60.1–63 kg'
      WHEN fighter_weight_kg <= 66 THEN '63.1–66 kg'
      WHEN fighter_weight_kg <= 69 THEN '66.1–69 kg'
      WHEN fighter_weight_kg <= 72 THEN '69.1–72 kg'
      WHEN fighter_weight_kg <= 76 THEN '72.1–76 kg'
      WHEN fighter_weight_kg <= 80 THEN '76.1–80 kg'
      WHEN fighter_weight_kg <= 85 THEN '80.1–85 kg'
      WHEN fighter_weight_kg <= 90 THEN '85.1–90 kg'
      WHEN fighter_weight_kg <= 95 THEN '90.1–95 kg'
      ELSE '95.1 kg o más (A+)'
    END;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.boxing_weight_category(integer,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boxing_weight_category(integer,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_boxing_registration_weight_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_day date;
  calculated_age integer;
  calculated_category text;
BEGIN
  IF lower(trim(COALESCE(NEW.registered_discipline, ''))) <> 'boxeo' THEN
    RETURN NEW;
  END IF;

  SELECT event_date INTO event_day FROM public.events WHERE id = NEW.event_id;
  calculated_age := CASE
    WHEN NEW.date_of_birth IS NOT NULL AND event_day IS NOT NULL
      THEN EXTRACT(YEAR FROM age(event_day, NEW.date_of_birth))::integer
    ELSE NEW.age_at_event
  END;
  NEW.age_at_event := calculated_age;
  calculated_category := public.boxing_weight_category(calculated_age, NEW.weigh_in_weight);

  IF calculated_category IS NOT NULL THEN
    NEW.registered_weight_class := calculated_category;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_boxing_registration_weight_category() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_z_assign_boxing_registration_weight_category
  ON public.event_registrations;
CREATE TRIGGER trg_z_assign_boxing_registration_weight_category
  BEFORE INSERT OR UPDATE OF registered_discipline, weigh_in_weight, date_of_birth, age_at_event
  ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.assign_boxing_registration_weight_category();

CREATE OR REPLACE FUNCTION public.assign_boxing_application_weight_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fighter_row public.fighters%ROWTYPE;
  fighter_birth_date date;
  event_day date;
  effective_discipline text;
  calculated_age integer;
  calculated_category text;
BEGIN
  SELECT * INTO fighter_row FROM public.fighters WHERE id = NEW.fighter_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  effective_discipline := COALESCE(NEW.fighter_discipline, (fighter_row.disciplines)[1]);
  IF lower(trim(COALESCE(effective_discipline, ''))) <> 'boxeo' THEN RETURN NEW; END IF;

  SELECT date_of_birth INTO fighter_birth_date
  FROM public.profiles WHERE id = fighter_row.profile_id;
  SELECT event_date INTO event_day FROM public.events WHERE id = NEW.event_id;
  IF fighter_birth_date IS NULL OR event_day IS NULL THEN RETURN NEW; END IF;

  calculated_age := EXTRACT(YEAR FROM age(event_day, fighter_birth_date))::integer;
  calculated_category := public.boxing_weight_category(calculated_age, fighter_row.exact_weight);
  IF calculated_category IS NOT NULL THEN
    NEW.fighter_weight_class := calculated_category;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_boxing_application_weight_category() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_assign_boxing_application_weight_category
  ON public.event_applications;
CREATE TRIGGER trg_assign_boxing_application_weight_category
  BEFORE INSERT OR UPDATE OF fighter_id, fighter_discipline, event_id
  ON public.event_applications
  FOR EACH ROW EXECUTE FUNCTION public.assign_boxing_application_weight_category();

-- Backfill existing applications and registrations with complete boxing data.
UPDATE public.event_applications application
SET fighter_weight_class = public.boxing_weight_category(
      EXTRACT(YEAR FROM age(event.event_date, profile.date_of_birth))::integer,
      fighter.exact_weight
    )
FROM public.fighters fighter
JOIN public.profiles profile ON profile.id = fighter.profile_id
JOIN public.events event ON true
WHERE application.fighter_id = fighter.id
  AND event.id = application.event_id
  AND event.event_date IS NOT NULL
  AND profile.date_of_birth IS NOT NULL
  AND fighter.exact_weight IS NOT NULL
  AND lower(trim(COALESCE(application.fighter_discipline, (fighter.disciplines)[1], ''))) = 'boxeo'
  AND public.boxing_weight_category(
        EXTRACT(YEAR FROM age(event.event_date, profile.date_of_birth))::integer,
        fighter.exact_weight
      ) IS NOT NULL;

UPDATE public.event_registrations registration
SET registered_weight_class = public.boxing_weight_category(
      COALESCE(
        registration.age_at_event,
        EXTRACT(YEAR FROM age(event.event_date, registration.date_of_birth))::integer
      ),
      registration.weigh_in_weight
    ),
    updated_at = now()
FROM public.events event
WHERE event.id = registration.event_id
  AND lower(trim(COALESCE(registration.registered_discipline, ''))) = 'boxeo'
  AND registration.weigh_in_weight IS NOT NULL
  AND public.boxing_weight_category(
        COALESCE(
          registration.age_at_event,
          EXTRACT(YEAR FROM age(event.event_date, registration.date_of_birth))::integer
        ),
        registration.weigh_in_weight
      ) IS NOT NULL;

NOTIFY pgrst, 'reload schema';
