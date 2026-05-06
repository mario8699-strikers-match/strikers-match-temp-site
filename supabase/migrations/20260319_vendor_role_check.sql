-- Widen profiles.role CHECK to include all vendor service roles.
-- Without this, the handle_new_user trigger raises on vendor signup and
-- Supabase Auth returns 500 on /auth/v1/signup.

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
    'merchandise_vendor'
  ]::text[]));
