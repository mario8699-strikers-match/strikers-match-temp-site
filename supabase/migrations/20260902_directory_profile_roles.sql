-- Add Directory profile roles for service providers that are not event staff.
-- These roles appear in registration and can publish a public Directory profile.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY[
    'fighter',
    'spectator',
    'promoter',
    'manager',
    'sponsor',
    'admin',
    'gyms_academies',
    'recovery_wellness',
    'gear_apparel',
    'nutrition_supplements',
    'local_business',
    'other_service',
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

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_additional_roles_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_additional_roles_check
  CHECK (
    additional_roles <@ ARRAY[
      'gyms_academies',
      'recovery_wellness',
      'gear_apparel',
      'nutrition_supplements',
      'local_business',
      'other_service',
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
