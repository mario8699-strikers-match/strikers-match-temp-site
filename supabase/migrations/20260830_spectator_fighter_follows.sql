-- Spectator accounts and fighter follows.
-- Spectators can follow registered fighter profiles and see their progress.

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

CREATE TABLE IF NOT EXISTS public.fighter_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spectator_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fighter_id uuid NOT NULL REFERENCES public.fighters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fighter_follows_unique UNIQUE (spectator_profile_id, fighter_id)
);

CREATE INDEX IF NOT EXISTS idx_fighter_follows_spectator
  ON public.fighter_follows(spectator_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fighter_follows_fighter
  ON public.fighter_follows(fighter_id);

ALTER TABLE public.fighter_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fighter_follows_select_own" ON public.fighter_follows;
DROP POLICY IF EXISTS "fighter_follows_insert_own_spectator" ON public.fighter_follows;
DROP POLICY IF EXISTS "fighter_follows_delete_own" ON public.fighter_follows;
DROP POLICY IF EXISTS "fighter_follows_admin_all" ON public.fighter_follows;

CREATE POLICY "fighter_follows_select_own" ON public.fighter_follows
  FOR SELECT USING (spectator_profile_id = auth.uid());

CREATE POLICY "fighter_follows_insert_own_spectator" ON public.fighter_follows
  FOR INSERT WITH CHECK (
    spectator_profile_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'spectator'
        AND coalesce(profiles.is_banned, false) = false
    )
  );

CREATE POLICY "fighter_follows_delete_own" ON public.fighter_follows
  FOR DELETE USING (spectator_profile_id = auth.uid());

CREATE POLICY "fighter_follows_admin_all" ON public.fighter_follows
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
