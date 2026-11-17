-- Stop treating Mexico as the implicit residence for new roster fighters.
-- Nationality remains independent from current country.

ALTER TABLE public.manual_fighters
  ALTER COLUMN country DROP DEFAULT,
  ALTER COLUMN country DROP NOT NULL;

-- These existing roster fighters were created with a U.S. nationality and a
-- San Bernardino location, but inherited the legacy Mexico country default.
UPDATE public.manual_fighters
SET
  country = 'United States',
  country_code = 'US',
  state = COALESCE(NULLIF(trim(state), ''), 'California'),
  region_code = 'US-CA',
  timezone = 'America/Los_Angeles',
  preferred_currency = 'USD',
  updated_at = now()
WHERE country_code IS NULL
  AND nationalities @> ARRAY['US']::text[]
  AND lower(trim(city)) = 'san bernardino';

COMMENT ON COLUMN public.manual_fighters.country IS
  'Current country of residence. This is separate from fighter nationality.';

NOTIFY pgrst, 'reload schema';
