-- ============================================================
-- Event Engine Phases 2–5 — rules, secure proposals, mats, bouts
-- Additive migration. Existing event and match reads remain compatible.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_matchmaking_settings (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  weight_tolerance_kg numeric NOT NULL DEFAULT 2 CHECK (weight_tolerance_kg >= 0),
  age_tolerance_years integer NOT NULL DEFAULT 3 CHECK (age_tolerance_years >= 0),
  experience_tolerance_fights integer NOT NULL DEFAULT 5 CHECK (experience_tolerance_fights >= 0),
  allow_same_team boolean NOT NULL DEFAULT false,
  recent_opponent_lookback_days integer NOT NULL DEFAULT 365 CHECK (recent_opponent_lookback_days >= 0),
  max_bouts_per_fighter integer NOT NULL DEFAULT 1 CHECK (max_bouts_per_fighter > 0),
  minimum_rest_minutes integer NOT NULL DEFAULT 30 CHECK (minimum_rest_minutes >= 0),
  rules_version integer NOT NULL DEFAULT 1 CHECK (rules_version > 0),
  registration_closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  discipline text NOT NULL,
  ruleset text NOT NULL,
  bout_format text,
  weight_class text,
  minimum_weight_kg numeric,
  maximum_weight_kg numeric,
  age_class text,
  minimum_age integer CHECK (minimum_age IS NULL OR minimum_age >= 0),
  maximum_age integer CHECK (maximum_age IS NULL OR maximum_age >= 0),
  gender_division text,
  belt_level text,
  experience_level text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (minimum_weight_kg IS NULL OR maximum_weight_kg IS NULL OR minimum_weight_kg <= maximum_weight_kg),
  CHECK (minimum_age IS NULL OR maximum_age IS NULL OR minimum_age <= maximum_age)
);

CREATE TABLE IF NOT EXISTS public.event_mats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  mat_number integer NOT NULL CHECK (mat_number > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, mat_number)
);

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS compatibility_score integer CHECK (compatibility_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS warnings text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rule_version integer,
  ADD COLUMN IF NOT EXISTS proposed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS unique_match_pairing;
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_active_pair_unique
  ON public.matches(event_id, fighter_a_id, fighter_b_id)
  WHERE match_status <> 'cancelled';

CREATE TABLE IF NOT EXISTS public.bouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id uuid UNIQUE REFERENCES public.matches(id) ON DELETE SET NULL,
  division_id uuid REFERENCES public.event_divisions(id) ON DELETE SET NULL,
  fighter_a_registration_id uuid NOT NULL REFERENCES public.event_registrations(id),
  fighter_b_registration_id uuid NOT NULL REFERENCES public.event_registrations(id),
  fighter_a_id uuid NOT NULL REFERENCES public.fighters(id),
  fighter_b_id uuid NOT NULL REFERENCES public.fighters(id),
  fighter_a_snapshot jsonb NOT NULL,
  fighter_b_snapshot jsonb NOT NULL,
  discipline text,
  ruleset text,
  bout_format text,
  weight_class text,
  age_class text,
  belt_level text,
  experience_level text,
  mat_id uuid REFERENCES public.event_mats(id) ON DELETE SET NULL,
  bout_number integer,
  mat_order integer,
  scheduled_time timestamptz,
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('approved','confirmed','ready','in_progress','completed','cancelled','no_show')),
  winner_id uuid REFERENCES public.fighters(id) ON DELETE SET NULL,
  result text,
  method text,
  elapsed_seconds integer CHECK (elapsed_seconds IS NULL OR elapsed_seconds >= 0),
  notes text,
  cancellation_reason text,
  replacement_notes text,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fighter_a_registration_id <> fighter_b_registration_id),
  CHECK (fighter_a_id <> fighter_b_id),
  UNIQUE (event_id, bout_number)
);

CREATE TABLE IF NOT EXISTS public.bout_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bout_id uuid NOT NULL REFERENCES public.bouts(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_divisions_event ON public.event_divisions(event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_mats_event ON public.event_mats(event_id, mat_number);
CREATE INDEX IF NOT EXISTS idx_bouts_event_status ON public.bouts(event_id, status);
CREATE INDEX IF NOT EXISTS idx_bouts_event_order ON public.bouts(event_id, bout_number);
CREATE INDEX IF NOT EXISTS idx_bouts_mat_order ON public.bouts(mat_id, mat_order);
CREATE INDEX IF NOT EXISTS idx_bout_audit_bout ON public.bout_audit_log(bout_id, created_at);

ALTER TABLE public.event_matchmaking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_mats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bout_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_event_participants" ON public.event_matchmaking_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id)
  );
CREATE POLICY "settings_manage_event_owner" ON public.event_matchmaking_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "divisions_select_all" ON public.event_divisions FOR SELECT USING (true);
CREATE POLICY "divisions_manage_event_owner" ON public.event_divisions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "mats_select_all" ON public.event_mats FOR SELECT USING (true);
CREATE POLICY "mats_manage_event_owner" ON public.event_mats
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "bouts_select_participant_or_owner" ON public.bouts FOR SELECT USING (
  fighter_a_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
  OR fighter_b_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.promoter_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "bouts_manage_event_owner" ON public.bouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
CREATE POLICY "bout_audit_select_owner" ON public.bout_audit_log FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bouts b
    JOIN public.events e ON e.id = b.event_id
    WHERE b.id = bout_id
      AND (e.promoter_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      ))
  )
);

CREATE OR REPLACE FUNCTION public.approve_confirmed_match_as_bout(match_uuid uuid)
RETURNS public.bouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.matches%ROWTYPE;
  reg_a public.event_registrations%ROWTYPE;
  reg_b public.event_registrations%ROWTYPE;
  profile_a public.profiles%ROWTYPE;
  profile_b public.profiles%ROWTYPE;
  fighter_a public.fighters%ROWTYPE;
  fighter_b public.fighters%ROWTYPE;
  created_bout public.bouts%ROWTYPE;
BEGIN
  SELECT * INTO match_row FROM public.matches WHERE id = match_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = match_row.event_id AND e.promoter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF match_row.match_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Both fighters must confirm the proposal first';
  END IF;

  SELECT * INTO reg_a FROM public.event_registrations
    WHERE event_id = match_row.event_id AND fighter_id = match_row.fighter_a_id FOR UPDATE;
  SELECT * INTO reg_b FROM public.event_registrations
    WHERE event_id = match_row.event_id AND fighter_id = match_row.fighter_b_id FOR UPDATE;
  IF reg_a.id IS NULL OR reg_b.id IS NULL THEN RAISE EXCEPTION 'Event registrations not found'; END IF;
  IF reg_a.eligibility_status <> 'eligible' OR reg_b.eligibility_status <> 'eligible' THEN
    RAISE EXCEPTION 'Both fighters must be eligible';
  END IF;

  SELECT * INTO fighter_a FROM public.fighters WHERE id = match_row.fighter_a_id;
  SELECT * INTO fighter_b FROM public.fighters WHERE id = match_row.fighter_b_id;
  SELECT * INTO profile_a FROM public.profiles WHERE id = fighter_a.profile_id;
  SELECT * INTO profile_b FROM public.profiles WHERE id = fighter_b.profile_id;

  INSERT INTO public.bouts (
    event_id, match_id, fighter_a_registration_id, fighter_b_registration_id,
    fighter_a_id, fighter_b_id, fighter_a_snapshot, fighter_b_snapshot,
    discipline, ruleset, bout_format, weight_class, age_class, belt_level,
    experience_level, approved_by
  ) VALUES (
    match_row.event_id, match_row.id, reg_a.id, reg_b.id,
    fighter_a.id, fighter_b.id,
    jsonb_build_object('id', fighter_a.id, 'name', profile_a.full_name, 'team', reg_a.team_name,
      'record_wins', reg_a.record_wins, 'record_losses', reg_a.record_losses, 'record_draws', reg_a.record_draws),
    jsonb_build_object('id', fighter_b.id, 'name', profile_b.full_name, 'team', reg_b.team_name,
      'record_wins', reg_b.record_wins, 'record_losses', reg_b.record_losses, 'record_draws', reg_b.record_draws),
    COALESCE(reg_a.registered_discipline, reg_b.registered_discipline),
    COALESCE(reg_a.ruleset, reg_b.ruleset), COALESCE(reg_a.bout_format, reg_b.bout_format),
    COALESCE(reg_a.registered_weight_class, reg_b.registered_weight_class),
    COALESCE(reg_a.age_class, reg_b.age_class), COALESCE(reg_a.belt_level, reg_b.belt_level),
    COALESCE(reg_a.experience_level, reg_b.experience_level), auth.uid()
  )
  ON CONFLICT (match_id) DO UPDATE SET updated_at = public.bouts.updated_at
  RETURNING * INTO created_bout;

  UPDATE public.matches SET approved_by = auth.uid(), approved_at = now(), updated_at = now()
    WHERE id = match_uuid;
  INSERT INTO public.bout_audit_log (bout_id, actor_id, action, new_data)
    VALUES (created_bout.id, auth.uid(), 'bout_approved', to_jsonb(created_bout));
  RETURN created_bout;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_confirmed_match_as_bout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_confirmed_match_as_bout(uuid) TO authenticated;

