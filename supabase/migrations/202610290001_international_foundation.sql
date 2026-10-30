-- International foundation for profiles, fighters, manual rosters, events,
-- and immutable event-registration location snapshots.
--
-- Additive only: legacy city/state/country fields remain in place and no auth,
-- event, matchmaking, payment, or public-view behavior is replaced here.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS region_code text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'MXN';

ALTER TABLE public.fighters
  ADD COLUMN IF NOT EXISTS nationalities text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.manual_fighters
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS region_code text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS nationalities text[] NOT NULL DEFAULT '{}';

-- Travel preferences and passport readiness are intentionally separated from
-- directory-facing fighter tables. They are not added to any public view.
CREATE TABLE IF NOT EXISTS public.fighter_travel_preferences (
  fighter_id uuid PRIMARY KEY REFERENCES public.fighters(id) ON DELETE CASCADE,
  available_to_travel_internationally boolean NOT NULL DEFAULT false,
  travel_regions text[] NOT NULL DEFAULT '{}',
  passport_status text NOT NULL DEFAULT 'unknown'
    CHECK (passport_status IN ('unknown', 'available', 'unavailable', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manual_fighter_travel_preferences (
  manual_fighter_id uuid PRIMARY KEY REFERENCES public.manual_fighters(id) ON DELETE CASCADE,
  available_to_travel_internationally boolean NOT NULL DEFAULT false,
  travel_regions text[] NOT NULL DEFAULT '{}',
  passport_status text NOT NULL DEFAULT 'unknown'
    CHECK (passport_status IN ('unknown', 'available', 'unavailable', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS region_code text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MXN';

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS region_code text,
  ADD COLUMN IF NOT EXISTS timezone text;

-- Backfill only unambiguous existing Mexico values. Ambiguous or empty legacy
-- locations intentionally remain NULL for later review.
UPDATE public.profiles
SET country_code = 'MX'
WHERE country_code IS NULL
  AND lower(trim(country)) IN ('mexico', 'méxico');

UPDATE public.manual_fighters
SET country_code = 'MX'
WHERE country_code IS NULL
  AND lower(trim(country)) IN ('mexico', 'méxico');

UPDATE public.event_registrations
SET country_code = 'MX'
WHERE country_code IS NULL
  AND lower(trim(country)) IN ('mexico', 'méxico');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_country_code_format,
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_allowed,
  DROP CONSTRAINT IF EXISTS profiles_preferred_currency_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_country_code_format
    CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT profiles_preferred_language_allowed
    CHECK (preferred_language IN ('es', 'en', 'ru')),
  ADD CONSTRAINT profiles_preferred_currency_format
    CHECK (preferred_currency ~ '^[A-Z]{3}$');

ALTER TABLE public.manual_fighters
  DROP CONSTRAINT IF EXISTS manual_fighters_country_code_format,
  DROP CONSTRAINT IF EXISTS manual_fighters_preferred_language_allowed,
  DROP CONSTRAINT IF EXISTS manual_fighters_preferred_currency_format;

ALTER TABLE public.manual_fighters
  ADD CONSTRAINT manual_fighters_country_code_format
    CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT manual_fighters_preferred_language_allowed
    CHECK (preferred_language IN ('es', 'en', 'ru')),
  ADD CONSTRAINT manual_fighters_preferred_currency_format
    CHECK (preferred_currency ~ '^[A-Z]{3}$');

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_country_code_format,
  DROP CONSTRAINT IF EXISTS events_currency_format;

ALTER TABLE public.events
  ADD CONSTRAINT events_country_code_format
    CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT events_currency_format
    CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_country_code_format;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_country_code_format
    CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

CREATE INDEX IF NOT EXISTS idx_profiles_country_region
  ON public.profiles(country_code, region_code);
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language
  ON public.profiles(preferred_language);
CREATE INDEX IF NOT EXISTS idx_fighters_nationalities
  ON public.fighters USING gin(nationalities);
CREATE INDEX IF NOT EXISTS idx_fighters_travel_regions
  ON public.fighter_travel_preferences USING gin(travel_regions);
CREATE INDEX IF NOT EXISTS idx_manual_fighters_travel_regions
  ON public.manual_fighter_travel_preferences USING gin(travel_regions);
CREATE INDEX IF NOT EXISTS idx_manual_fighters_country_region
  ON public.manual_fighters(country_code, region_code);
CREATE INDEX IF NOT EXISTS idx_events_country_region_date
  ON public.events(country_code, region_code, event_date);

COMMENT ON COLUMN public.profiles.country_code IS 'ISO 3166-1 alpha-2 current-country code.';
COMMENT ON COLUMN public.profiles.timezone IS 'IANA timezone identifier.';
COMMENT ON COLUMN public.profiles.preferred_language IS 'Preferred application language: es, en, or ru.';
COMMENT ON COLUMN public.profiles.preferred_currency IS 'ISO 4217 preferred display currency.';
COMMENT ON COLUMN public.fighters.nationalities IS 'ISO 3166-1 alpha-2 nationality codes.';
COMMENT ON TABLE public.fighter_travel_preferences IS 'Private fighter travel and passport-readiness settings.';
COMMENT ON TABLE public.manual_fighter_travel_preferences IS 'Private manual-roster fighter travel and passport-readiness settings.';
COMMENT ON COLUMN public.events.timezone IS 'IANA timezone used for the event schedule.';
COMMENT ON COLUMN public.events.currency IS 'ISO 4217 event currency; payment-provider support is validated separately.';

ALTER TABLE public.fighter_travel_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_fighter_travel_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fighter_travel_preferences_owner_manager_admin
  ON public.fighter_travel_preferences;
CREATE POLICY fighter_travel_preferences_owner_manager_admin
  ON public.fighter_travel_preferences
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.fighters fighter
      WHERE fighter.id = fighter_travel_preferences.fighter_id
        AND fighter.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.manager_fighters roster
      WHERE roster.fighter_id = fighter_travel_preferences.fighter_id
        AND roster.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.fighters fighter
      WHERE fighter.id = fighter_travel_preferences.fighter_id
        AND fighter.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.manager_fighters roster
      WHERE roster.fighter_id = fighter_travel_preferences.fighter_id
        AND roster.manager_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS manual_fighter_travel_preferences_owner_admin
  ON public.manual_fighter_travel_preferences;
CREATE POLICY manual_fighter_travel_preferences_owner_admin
  ON public.manual_fighter_travel_preferences
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.manual_fighters fighter
      WHERE fighter.id = manual_fighter_travel_preferences.manual_fighter_id
        AND fighter.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.manual_fighters fighter
      WHERE fighter.id = manual_fighter_travel_preferences.manual_fighter_id
        AND fighter.manager_id = auth.uid()
    )
  );

REVOKE ALL ON public.fighter_travel_preferences FROM anon;
REVOKE ALL ON public.manual_fighter_travel_preferences FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fighter_travel_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_fighter_travel_preferences TO authenticated;

NOTIFY pgrst, 'reload schema';
