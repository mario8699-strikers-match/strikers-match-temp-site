-- Allow vendors to declare multiple service specialties on one profile.
-- The primary `role` column still drives auth redirects, dashboards,
-- monetization, and RLS. `additional_roles` is a free-form ARRAY of
-- vendor roles that a profile *also* offers (e.g. a cutman who is
-- also a ringside EMT).
--
-- Constraint: every entry must be a known vendor role. The primary
-- role itself MAY appear in the list but the UI strips it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS additional_roles text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_additional_roles_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_additional_roles_check
  CHECK (
    additional_roles <@ ARRAY[
      'ring_card_girl',
      'photographer',
      'videographer',
      'broadcast_personality',
      'catering_vendor',
      'venue_rental',
      'judge',
      'ring_rental',
      'ring_announcer',
      'cutman',
      'merchandise_vendor',
      'ringside_doctor',
      'ringside_emt'
    ]::text[]
  );

-- GIN index so we can filter by `additional_roles && ARRAY['cutman']` cheaply
CREATE INDEX IF NOT EXISTS idx_profiles_additional_roles
  ON public.profiles USING GIN (additional_roles);
