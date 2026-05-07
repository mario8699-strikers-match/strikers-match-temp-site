-- Add two more vendor roles: ringside doctor and ringside medical technician.
-- Without this, signups for these roles fail the profiles_role_check
-- and Supabase Auth returns 500.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY[
    'fighter',
    'promoter',
    'manager',
    'sponsor',
    'admin',
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
  ]::text[]));
