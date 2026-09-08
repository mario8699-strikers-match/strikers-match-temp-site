-- Matchmaking-to-presentation pipeline: registration-based bouts and graphics.

CREATE OR REPLACE FUNCTION public.build_event_registration_bout_snapshot(registration_uuid uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', registration.id,
    'registration_id', registration.id,
    'fighter_id', registration.fighter_id,
    'manual_fighter_id', registration.manual_fighter_id,
    'name', registration.display_name,
    'nickname', registration.nickname,
    'photo_url', registration.photo_url,
    'team', registration.team_name,
    'city', registration.city,
    'state', registration.state,
    'country', registration.country,
    'age', registration.age_at_event,
    'gender_division', registration.gender_division,
    'experience_level', registration.experience_level,
    'skill_rating', registration.skill_rating,
    'record_wins', registration.record_wins,
    'record_losses', registration.record_losses,
    'record_draws', registration.record_draws,
    'ko_wins', registration.ko_wins,
    'tko_wins', registration.tko_wins,
    'ko_losses', registration.ko_losses,
    'tko_losses', registration.tko_losses,
    'registered_weight', registration.weigh_in_weight,
    'requested_weight', registration.requested_weight_kg,
    'acceptable_weight_min', registration.acceptable_weight_min_kg,
    'acceptable_weight_max', registration.acceptable_weight_max_kg,
    'discipline', registration.registered_discipline,
    'ruleset', registration.ruleset
  )
  FROM public.event_registrations registration
  WHERE registration.id = registration_uuid;
$$;

CREATE OR REPLACE FUNCTION public.approve_confirmed_match_as_bout(match_uuid uuid)
RETURNS public.bouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_row public.matches%ROWTYPE;
  registration_a public.event_registrations%ROWTYPE;
  registration_b public.event_registrations%ROWTYPE;
  created_bout public.bouts%ROWTYPE;
BEGIN
  SELECT * INTO match_row FROM public.matches WHERE id = match_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found.'; END IF;
  PERFORM public.assert_event_operator(match_row.event_id);
  IF match_row.match_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Both participants must confirm the proposal first.';
  END IF;

  SELECT * INTO registration_a
  FROM public.event_registrations WHERE id = match_row.fighter_a_registration_id FOR UPDATE;
  SELECT * INTO registration_b
  FROM public.event_registrations WHERE id = match_row.fighter_b_registration_id FOR UPDATE;
  IF registration_a.id IS NULL OR registration_b.id IS NULL THEN
    RAISE EXCEPTION 'Event registrations not found.';
  END IF;
  IF registration_a.eligibility_status <> 'eligible' OR registration_b.eligibility_status <> 'eligible' THEN
    RAISE EXCEPTION 'Both participants must be eligible.';
  END IF;
  IF registration_a.payment_status NOT IN ('confirmed','waived')
    OR registration_b.payment_status NOT IN ('confirmed','waived') THEN
    RAISE EXCEPTION 'Both participants must have confirmed or waived payment.';
  END IF;

  INSERT INTO public.bouts (
    event_id, match_id, fighter_a_registration_id, fighter_b_registration_id,
    fighter_a_id, fighter_b_id, fighter_a_snapshot, fighter_b_snapshot,
    discipline, ruleset, bout_format, weight_class, age_class, belt_level,
    experience_level, approved_by
  ) VALUES (
    match_row.event_id, match_row.id, registration_a.id, registration_b.id,
    registration_a.fighter_id, registration_b.fighter_id,
    public.build_event_registration_bout_snapshot(registration_a.id),
    public.build_event_registration_bout_snapshot(registration_b.id),
    COALESCE(registration_a.registered_discipline, registration_b.registered_discipline),
    COALESCE(registration_a.ruleset, registration_b.ruleset),
    COALESCE(registration_a.bout_format, registration_b.bout_format),
    COALESCE(registration_a.registered_weight_class, registration_b.registered_weight_class),
    COALESCE(registration_a.age_class, registration_b.age_class),
    COALESCE(registration_a.belt_level, registration_b.belt_level),
    COALESCE(registration_a.experience_level, registration_b.experience_level),
    auth.uid()
  )
  ON CONFLICT (match_id) DO UPDATE SET updated_at = public.bouts.updated_at
  RETURNING * INTO created_bout;

  UPDATE public.matches
  SET approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE id = match_uuid;
  INSERT INTO public.bout_audit_log(bout_id, actor_id, action, new_data)
  VALUES (created_bout.id, auth.uid(), 'bout_approved', to_jsonb(created_bout));
  RETURN created_bout;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_bout_fighter(
  bout_uuid uuid,
  replacement_side text,
  replacement_registration_uuid uuid,
  operation_reason text DEFAULT NULL
)
RETURNS public.bouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  before_row public.bouts%ROWTYPE;
  after_row public.bouts%ROWTYPE;
  replacement public.event_registrations%ROWTYPE;
BEGIN
  IF replacement_side NOT IN ('a','b') THEN RAISE EXCEPTION 'Replacement side must be a or b.'; END IF;
  SELECT * INTO before_row FROM public.bouts WHERE id = bout_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bout not found.'; END IF;
  PERFORM public.assert_event_operator(before_row.event_id);
  IF before_row.status IN ('completed','cancelled','no_show') THEN
    RAISE EXCEPTION 'Cannot replace a participant on a terminal bout.';
  END IF;

  SELECT * INTO replacement
  FROM public.event_registrations WHERE id = replacement_registration_uuid FOR UPDATE;
  IF replacement.id IS NULL OR replacement.event_id <> before_row.event_id THEN
    RAISE EXCEPTION 'Replacement registration must belong to this event.';
  END IF;
  IF replacement.payment_status NOT IN ('confirmed','waived') OR replacement.eligibility_status <> 'eligible' THEN
    RAISE EXCEPTION 'Replacement participant must be eligible with confirmed or waived payment.';
  END IF;
  IF replacement.id IN (before_row.fighter_a_registration_id, before_row.fighter_b_registration_id) THEN
    RAISE EXCEPTION 'Replacement participant is already in this bout.';
  END IF;
  IF public.event_registration_assignment_count(replacement.id) > 0 THEN
    RAISE EXCEPTION 'Replacement participant is already assigned.';
  END IF;
  IF replacement_side = 'a' AND NOT public.event_registration_disciplines_match(replacement.id, before_row.fighter_b_registration_id) THEN
    RAISE EXCEPTION 'Replacement participant has an incompatible discipline.';
  END IF;
  IF replacement_side = 'b' AND NOT public.event_registration_disciplines_match(before_row.fighter_a_registration_id, replacement.id) THEN
    RAISE EXCEPTION 'Replacement participant has an incompatible discipline.';
  END IF;

  IF replacement_side = 'a' THEN
    UPDATE public.bouts
    SET fighter_a_registration_id = replacement.id,
        fighter_a_id = replacement.fighter_id,
        fighter_a_snapshot = public.build_event_registration_bout_snapshot(replacement.id),
        winner_id = NULL,
        winner_registration_id = NULL,
        replacement_notes = operation_reason,
        status = CASE WHEN status = 'in_progress' THEN 'approved' ELSE status END,
        updated_at = now()
    WHERE id = bout_uuid RETURNING * INTO after_row;
  ELSE
    UPDATE public.bouts
    SET fighter_b_registration_id = replacement.id,
        fighter_b_id = replacement.fighter_id,
        fighter_b_snapshot = public.build_event_registration_bout_snapshot(replacement.id),
        winner_id = NULL,
        winner_registration_id = NULL,
        replacement_notes = operation_reason,
        status = CASE WHEN status = 'in_progress' THEN 'approved' ELSE status END,
        updated_at = now()
    WHERE id = bout_uuid RETURNING * INTO after_row;
  END IF;

  INSERT INTO public.bout_audit_log(bout_id, actor_id, action, previous_data, new_data, reason)
  VALUES (bout_uuid, auth.uid(), 'fighter_replaced', to_jsonb(before_row), to_jsonb(after_row), operation_reason);
  RETURN after_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_bout_operation_v2(
  bout_uuid uuid,
  next_status text DEFAULT NULL,
  next_mat_id uuid DEFAULT NULL,
  next_mat_order integer DEFAULT NULL,
  next_scheduled_time timestamptz DEFAULT NULL,
  next_winner_registration_id uuid DEFAULT NULL,
  next_method text DEFAULT NULL,
  next_elapsed_seconds integer DEFAULT NULL,
  operation_reason text DEFAULT NULL
)
RETURNS public.bouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  before_row public.bouts%ROWTYPE;
  after_row public.bouts%ROWTYPE;
  resolved_winner_id uuid;
BEGIN
  SELECT * INTO before_row FROM public.bouts WHERE id = bout_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bout not found.'; END IF;
  PERFORM public.assert_event_operator(before_row.event_id);
  IF next_status IS NOT NULL AND next_status NOT IN
    ('approved','confirmed','ready','in_progress','completed','cancelled','no_show') THEN
    RAISE EXCEPTION 'Invalid bout status.';
  END IF;
  IF next_status = 'completed' AND next_winner_registration_id IS NULL THEN
    RAISE EXCEPTION 'Winner is required to complete a bout.';
  END IF;
  IF next_winner_registration_id IS NOT NULL
    AND next_winner_registration_id NOT IN (before_row.fighter_a_registration_id, before_row.fighter_b_registration_id) THEN
    RAISE EXCEPTION 'Winner must be a participant in this bout.';
  END IF;
  IF next_winner_registration_id IS NOT NULL THEN
    SELECT fighter_id INTO resolved_winner_id
    FROM public.event_registrations WHERE id = next_winner_registration_id;
  END IF;
  IF next_mat_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_mats WHERE id = next_mat_id AND event_id = before_row.event_id
  ) THEN RAISE EXCEPTION 'Ring or mat belongs to another event.'; END IF;

  UPDATE public.bouts
  SET status = COALESCE(next_status, status),
      mat_id = COALESCE(next_mat_id, mat_id),
      mat_order = COALESCE(next_mat_order, mat_order),
      scheduled_time = COALESCE(next_scheduled_time, scheduled_time),
      winner_registration_id = COALESCE(next_winner_registration_id, winner_registration_id),
      winner_id = CASE
        WHEN next_winner_registration_id IS NOT NULL THEN resolved_winner_id
        ELSE winner_id
      END,
      method = COALESCE(next_method, method),
      elapsed_seconds = COALESCE(next_elapsed_seconds, elapsed_seconds),
      cancellation_reason = CASE WHEN next_status IN ('cancelled','no_show') THEN operation_reason ELSE cancellation_reason END,
      completed_at = CASE WHEN next_status = 'completed' THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = bout_uuid RETURNING * INTO after_row;

  INSERT INTO public.bout_audit_log(bout_id, actor_id, action, previous_data, new_data, reason)
  VALUES (bout_uuid, auth.uid(), 'bout_updated', to_jsonb(before_row), to_jsonb(after_row), operation_reason);
  RETURN after_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Versioned graphics and screen state.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_graphics_settings (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  template_key text NOT NULL DEFAULT 'strikers-classic',
  template_version integer NOT NULL DEFAULT 1,
  primary_color text NOT NULL DEFAULT '#0A0A0A',
  secondary_color text NOT NULL DEFAULT '#FFFFFF',
  accent_color text NOT NULL DEFAULT '#C0001E',
  logo_url text,
  background_url text,
  sponsor_logo_urls text[] NOT NULL DEFAULT '{}',
  display_duration_seconds integer NOT NULL DEFAULT 12 CHECK (display_duration_seconds BETWEEN 3 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bout_graphics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  bout_id uuid NOT NULL UNIQUE REFERENCES public.bouts(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  template_version integer NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published','stale')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bout_graphics_event_status
  ON public.bout_graphics(event_id, status, created_at);

CREATE TABLE IF NOT EXISTS public.event_display_state (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  active_bout_id uuid REFERENCES public.bouts(id) ON DELETE SET NULL,
  active_graphic_id uuid REFERENCES public.bout_graphics(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual','sequence')),
  is_live boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_display_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'Venue screen',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_display_tokens_event
  ON public.event_display_tokens(event_id, revoked_at, expires_at);

ALTER TABLE public.event_graphics_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bout_graphics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_display_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_display_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_control_event_graphics(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_event_operator(target_event_id) OR public.is_event_producer(target_event_id);
$$;

DROP POLICY IF EXISTS "event_graphics_staff_manage" ON public.event_graphics_settings;
CREATE POLICY "event_graphics_staff_manage" ON public.event_graphics_settings
  FOR ALL USING (public.can_control_event_graphics(event_id))
  WITH CHECK (public.can_control_event_graphics(event_id));
DROP POLICY IF EXISTS "bout_graphics_staff_manage" ON public.bout_graphics;
CREATE POLICY "bout_graphics_staff_manage" ON public.bout_graphics
  FOR ALL USING (public.can_control_event_graphics(event_id))
  WITH CHECK (public.can_control_event_graphics(event_id));
DROP POLICY IF EXISTS "event_display_state_staff_manage" ON public.event_display_state;
CREATE POLICY "event_display_state_staff_manage" ON public.event_display_state
  FOR ALL USING (public.can_control_event_graphics(event_id))
  WITH CHECK (public.can_control_event_graphics(event_id));
DROP POLICY IF EXISTS "event_display_tokens_staff_manage" ON public.event_display_tokens;
CREATE POLICY "event_display_tokens_staff_manage" ON public.event_display_tokens
  FOR ALL USING (public.can_control_event_graphics(event_id))
  WITH CHECK (public.can_control_event_graphics(event_id));

CREATE OR REPLACE FUNCTION public.generate_bout_graphic(bout_uuid uuid)
RETURNS public.bout_graphics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bout_row public.bouts%ROWTYPE;
  event_row public.events%ROWTYPE;
  settings_row public.event_graphics_settings%ROWTYPE;
  graphic_row public.bout_graphics%ROWTYPE;
  next_payload jsonb;
BEGIN
  SELECT * INTO bout_row FROM public.bouts WHERE id = bout_uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bout not found.'; END IF;
  SELECT * INTO event_row FROM public.events WHERE id = bout_row.event_id;
  SELECT * INTO settings_row FROM public.event_graphics_settings WHERE event_id = bout_row.event_id;

  IF settings_row.event_id IS NULL THEN
    INSERT INTO public.event_graphics_settings(event_id)
    VALUES (bout_row.event_id)
    ON CONFLICT (event_id) DO NOTHING;
    SELECT * INTO settings_row FROM public.event_graphics_settings WHERE event_id = bout_row.event_id;
  END IF;

  next_payload := jsonb_build_object(
    'schemaVersion', 1,
    'event', jsonb_build_object(
      'id', event_row.id,
      'name', event_row.event_name,
      'date', event_row.event_date,
      'city', event_row.city,
      'venue', event_row.venue,
      'logoUrl', settings_row.logo_url,
      'backgroundUrl', settings_row.background_url,
      'sponsorLogoUrls', settings_row.sponsor_logo_urls
    ),
    'bout', jsonb_build_object(
      'id', bout_row.id,
      'number', bout_row.bout_number,
      'discipline', bout_row.discipline,
      'ruleset', bout_row.ruleset,
      'format', bout_row.bout_format,
      'weightClass', bout_row.weight_class,
      'scheduledTime', bout_row.scheduled_time,
      'redCorner', jsonb_build_object(
        'name', bout_row.fighter_a_snapshot->>'name',
        'nickname', bout_row.fighter_a_snapshot->>'nickname',
        'photo_url', bout_row.fighter_a_snapshot->>'photo_url',
        'team', bout_row.fighter_a_snapshot->>'team',
        'record_wins', bout_row.fighter_a_snapshot->'record_wins',
        'record_losses', bout_row.fighter_a_snapshot->'record_losses',
        'record_draws', bout_row.fighter_a_snapshot->'record_draws',
        'ko_wins', bout_row.fighter_a_snapshot->'ko_wins',
        'tko_wins', bout_row.fighter_a_snapshot->'tko_wins'
      ),
      'blueCorner', jsonb_build_object(
        'name', bout_row.fighter_b_snapshot->>'name',
        'nickname', bout_row.fighter_b_snapshot->>'nickname',
        'photo_url', bout_row.fighter_b_snapshot->>'photo_url',
        'team', bout_row.fighter_b_snapshot->>'team',
        'record_wins', bout_row.fighter_b_snapshot->'record_wins',
        'record_losses', bout_row.fighter_b_snapshot->'record_losses',
        'record_draws', bout_row.fighter_b_snapshot->'record_draws',
        'ko_wins', bout_row.fighter_b_snapshot->'ko_wins',
        'tko_wins', bout_row.fighter_b_snapshot->'tko_wins'
      )
    ),
    'theme', jsonb_build_object(
      'primary', settings_row.primary_color,
      'secondary', settings_row.secondary_color,
      'accent', settings_row.accent_color
    )
  );

  INSERT INTO public.bout_graphics(
    event_id, bout_id, template_key, template_version, payload, status
  ) VALUES (
    bout_row.event_id, bout_row.id, settings_row.template_key,
    settings_row.template_version, next_payload, 'draft'
  )
  ON CONFLICT (bout_id) DO UPDATE SET
    template_key = EXCLUDED.template_key,
    template_version = EXCLUDED.template_version,
    payload = EXCLUDED.payload,
    status = CASE WHEN bout_graphics.status = 'published' THEN 'stale' ELSE 'draft' END,
    approved_by = NULL,
    approved_at = NULL,
    published_by = NULL,
    published_at = NULL,
    updated_at = now()
  RETURNING * INTO graphic_row;
  RETURN graphic_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_bout_graphic_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.generate_bout_graphic(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_bout_graphic ON public.bouts;
CREATE TRIGGER trg_generate_bout_graphic
  AFTER INSERT OR UPDATE OF
    fighter_a_registration_id, fighter_b_registration_id,
    fighter_a_snapshot, fighter_b_snapshot, discipline, ruleset,
    bout_format, weight_class, bout_number, scheduled_time
  ON public.bouts
  FOR EACH ROW EXECUTE FUNCTION public.generate_bout_graphic_after_change();

CREATE OR REPLACE FUNCTION public.regenerate_event_graphics_after_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_bout uuid;
BEGIN
  FOR target_bout IN SELECT id FROM public.bouts WHERE event_id = NEW.event_id LOOP
    PERFORM public.generate_bout_graphic(target_bout);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regenerate_event_graphics_from_settings ON public.event_graphics_settings;
CREATE TRIGGER trg_regenerate_event_graphics_from_settings
  AFTER UPDATE OF template_key, template_version, primary_color, secondary_color,
    accent_color, logo_url, background_url, sponsor_logo_urls
  ON public.event_graphics_settings
  FOR EACH ROW EXECUTE FUNCTION public.regenerate_event_graphics_after_settings_change();

CREATE OR REPLACE FUNCTION public.review_bout_graphic(graphic_uuid uuid, review_action text)
RETURNS public.bout_graphics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  graphic_row public.bout_graphics%ROWTYPE;
BEGIN
  SELECT * INTO graphic_row FROM public.bout_graphics WHERE id = graphic_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bout graphic not found.'; END IF;
  IF NOT public.can_control_event_graphics(graphic_row.event_id) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  IF review_action NOT IN ('approve','publish','return_to_draft') THEN RAISE EXCEPTION 'Invalid graphic action.'; END IF;

  UPDATE public.bout_graphics
  SET status = CASE review_action
        WHEN 'approve' THEN 'approved'
        WHEN 'publish' THEN 'published'
        ELSE 'draft'
      END,
      approved_by = CASE WHEN review_action IN ('approve','publish') THEN auth.uid() ELSE NULL END,
      approved_at = CASE WHEN review_action IN ('approve','publish') THEN now() ELSE NULL END,
      published_by = CASE WHEN review_action = 'publish' THEN auth.uid() ELSE NULL END,
      published_at = CASE WHEN review_action = 'publish' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = graphic_uuid RETURNING * INTO graphic_row;
  RETURN graphic_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_event_display_state(
  target_event_id uuid,
  target_graphic_id uuid DEFAULT NULL,
  next_mode text DEFAULT 'manual',
  next_is_live boolean DEFAULT true
)
RETURNS public.event_display_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  graphic_row public.bout_graphics%ROWTYPE;
  state_row public.event_display_state%ROWTYPE;
BEGIN
  IF NOT public.can_control_event_graphics(target_event_id) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  IF next_mode NOT IN ('manual','sequence') THEN RAISE EXCEPTION 'Invalid display mode.'; END IF;
  IF target_graphic_id IS NOT NULL THEN
    SELECT * INTO graphic_row FROM public.bout_graphics WHERE id = target_graphic_id;
    IF graphic_row.id IS NULL OR graphic_row.event_id <> target_event_id OR graphic_row.status <> 'published' THEN
      RAISE EXCEPTION 'Only a published graphic from this event can be displayed.';
    END IF;
  END IF;

  INSERT INTO public.event_display_state(
    event_id, active_bout_id, active_graphic_id, mode, is_live, revision, updated_by, updated_at
  ) VALUES (
    target_event_id, graphic_row.bout_id, target_graphic_id, next_mode, next_is_live, 1, auth.uid(), now()
  )
  ON CONFLICT (event_id) DO UPDATE SET
    active_bout_id = EXCLUDED.active_bout_id,
    active_graphic_id = EXCLUDED.active_graphic_id,
    mode = EXCLUDED.mode,
    is_live = EXCLUDED.is_live,
    revision = event_display_state.revision + 1,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING * INTO state_row;
  RETURN state_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_event_display_token(
  target_event_id uuid,
  token_label text DEFAULT 'Venue screen',
  token_expires_at timestamptz DEFAULT NULL
)
RETURNS public.event_display_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_row public.event_display_tokens%ROWTYPE;
BEGIN
  IF NOT public.can_control_event_graphics(target_event_id) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  INSERT INTO public.event_display_tokens(event_id, label, expires_at, created_by)
  VALUES (target_event_id, COALESCE(nullif(trim(token_label), ''), 'Venue screen'), token_expires_at, auth.uid())
  RETURNING * INTO token_row;
  RETURN token_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_display(display_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'eventId', token.event_id,
    'displayDurationSeconds', COALESCE(settings.display_duration_seconds, 12),
    'state', CASE WHEN state.event_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
      'event_id', state.event_id,
      'active_bout_id', state.active_bout_id,
      'active_graphic_id', state.active_graphic_id,
      'mode', state.mode,
      'is_live', state.is_live,
      'revision', state.revision,
      'updated_at', state.updated_at
    ) END,
    'graphics', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', graphic.id,
        'boutId', graphic.bout_id,
        'templateKey', graphic.template_key,
        'templateVersion', graphic.template_version,
        'payload', graphic.payload,
        'updatedAt', graphic.updated_at
      ) ORDER BY COALESCE((graphic.payload->'bout'->>'number')::integer, 2147483647), graphic.created_at)
      FROM public.bout_graphics graphic
      WHERE graphic.event_id = token.event_id AND graphic.status = 'published'
    ), '[]'::jsonb)
  )
  FROM public.event_display_tokens token
  LEFT JOIN public.event_display_state state ON state.event_id = token.event_id
  LEFT JOIN public.event_graphics_settings settings ON settings.event_id = token.event_id
  WHERE token.token = display_token
    AND token.revoked_at IS NULL
    AND (token.expires_at IS NULL OR token.expires_at > now());
$$;

CREATE OR REPLACE FUNCTION public.revoke_event_display_token(token_uuid uuid)
RETURNS public.event_display_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_row public.event_display_tokens%ROWTYPE;
BEGIN
  SELECT * INTO token_row FROM public.event_display_tokens WHERE id = token_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Display token not found.'; END IF;
  IF NOT public.can_control_event_graphics(token_row.event_id) THEN RAISE EXCEPTION 'Not authorized.'; END IF;
  UPDATE public.event_display_tokens
  SET revoked_at = now()
  WHERE id = token_uuid
  RETURNING * INTO token_row;
  RETURN token_row;
END;
$$;

REVOKE ALL ON FUNCTION public.build_event_registration_bout_snapshot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_confirmed_match_as_bout(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_bout_fighter(uuid,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_bout_operation_v2(uuid,text,uuid,integer,timestamptz,uuid,text,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_control_event_graphics(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_bout_graphic(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_bout_graphic(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_event_display_state(uuid,uuid,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_event_display_token(uuid,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_event_display(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_event_display_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_confirmed_match_as_bout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_bout_fighter(uuid,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_bout_operation_v2(uuid,text,uuid,integer,timestamptz,uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_control_event_graphics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_bout_graphic(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_event_display_state(uuid,uuid,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_display_token(uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_display(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_event_display_token(uuid) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bouts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bout_graphics FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_display_state FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_display_tokens FROM anon, authenticated;

-- Generate graphics for existing approved bouts.
DO $$
DECLARE
  existing_bout uuid;
BEGIN
  FOR existing_bout IN SELECT id FROM public.bouts LOOP
    PERFORM public.generate_bout_graphic(existing_bout);
  END LOOP;
END;
$$;
