-- Organization-level promoter teams.
--
-- Existing public.event_staff assignments remain event-specific. These tables
-- add reusable roles across every event owned by one organizer.

CREATE TABLE IF NOT EXISTS public.promoter_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promoter_organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.promoter_organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_role text NOT NULL CHECK (organization_role IN (
    'organization_admin',
    'event_manager',
    'matchmaker',
    'operations',
    'media_producer',
    'finance',
    'read_only'
  )),
  is_active boolean NOT NULL DEFAULT true,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_promoter_organization_members_profile
  ON public.promoter_organization_members(profile_id, is_active);
CREATE INDEX IF NOT EXISTS idx_promoter_organization_members_organization
  ON public.promoter_organization_members(organization_id, is_active);

DROP TRIGGER IF EXISTS trg_promoter_organizations_updated_at ON public.promoter_organizations;
CREATE TRIGGER trg_promoter_organizations_updated_at
BEFORE UPDATE ON public.promoter_organizations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_promoter_organization_members_updated_at ON public.promoter_organization_members;
CREATE TRIGGER trg_promoter_organization_members_updated_at
BEFORE UPDATE ON public.promoter_organization_members
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.promoter_organizations (owner_id, name)
SELECT DISTINCT
  event.promoter_id,
  left(COALESCE(NULLIF(btrim(profile.full_name), ''), 'Strikers Match') || ' Team', 120)
FROM public.events event
JOIN public.profiles profile ON profile.id = event.promoter_id
ON CONFLICT (owner_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.promoter_team_permissions_for_role(team_role text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE team_role
    WHEN 'owner' THEN ARRAY[
      'view_dashboard','view_event','view_private','manage_team','create_event',
      'manage_event','matchmaking','bouts','print','operation','production',
      'finance','manage_stripe'
    ]::text[]
    WHEN 'organization_admin' THEN ARRAY[
      'view_dashboard','view_event','view_private','manage_team','create_event',
      'manage_event','matchmaking','bouts','print','operation','production','finance'
    ]::text[]
    WHEN 'event_manager' THEN ARRAY[
      'view_dashboard','view_event','view_private','create_event','manage_event',
      'matchmaking','bouts','print'
    ]::text[]
    WHEN 'matchmaker' THEN ARRAY[
      'view_dashboard','view_event','view_private','matchmaking','bouts','print'
    ]::text[]
    WHEN 'operations' THEN ARRAY[
      'view_dashboard','view_event','view_private','operation','print'
    ]::text[]
    WHEN 'media_producer' THEN ARRAY[
      'view_dashboard','view_event','production'
    ]::text[]
    WHEN 'finance' THEN ARRAY[
      'view_dashboard','view_event','view_private','finance'
    ]::text[]
    WHEN 'read_only' THEN ARRAY[
      'view_dashboard','view_event','view_private'
    ]::text[]
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_promoter_team_permission(
  target_owner_id uuid,
  requested_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles actor
      WHERE actor.id = auth.uid()
        AND COALESCE(actor.is_banned, false) = false
    )
    AND (
      auth.uid() = target_owner_id
      OR EXISTS (
        SELECT 1
        FROM public.profiles profile
        WHERE profile.id = auth.uid()
          AND profile.role = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.promoter_organizations organization
        JOIN public.promoter_organization_members member
          ON member.organization_id = organization.id
        WHERE organization.owner_id = target_owner_id
          AND member.profile_id = auth.uid()
          AND member.is_active = true
          AND requested_permission = ANY (
            public.promoter_team_permissions_for_role(member.organization_role)
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.has_event_team_permission(
  target_event_id uuid,
  requested_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events event
    WHERE event.id = target_event_id
      AND public.has_promoter_team_permission(event.promoter_id, requested_permission)
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_promoter_organization(
  requested_name text DEFAULT NULL
)
RETURNS public.promoter_organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_profile public.profiles%ROWTYPE;
  organization_row public.promoter_organizations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  SELECT * INTO current_profile
  FROM public.profiles
  WHERE id = auth.uid()
    AND COALESCE(is_banned, false) = false;

  IF NOT FOUND OR current_profile.role NOT IN ('admin','manager','promoter','gyms_academies') THEN
    RAISE EXCEPTION 'promoter_team_owner_not_allowed';
  END IF;

  INSERT INTO public.promoter_organizations (owner_id, name)
  VALUES (
    auth.uid(),
    left(COALESCE(NULLIF(btrim(requested_name), ''), NULLIF(btrim(current_profile.full_name), ''), 'Strikers Match') ||
      CASE WHEN NULLIF(btrim(requested_name), '') IS NULL THEN ' Team' ELSE '' END, 120)
  )
  ON CONFLICT (owner_id) DO UPDATE
    SET name = CASE
      WHEN NULLIF(btrim(requested_name), '') IS NOT NULL THEN left(btrim(requested_name), 120)
      ELSE promoter_organizations.name
    END,
    updated_at = now()
  RETURNING * INTO organization_row;

  RETURN organization_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_promoter_organizations()
RETURNS TABLE (
  organization_id uuid,
  owner_id uuid,
  organization_name text,
  team_role text,
  permissions text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (organization.id)
    organization.id,
    organization.owner_id,
    organization.name,
    CASE WHEN organization.owner_id = auth.uid() THEN 'owner' ELSE member.organization_role END,
    public.promoter_team_permissions_for_role(
      CASE WHEN organization.owner_id = auth.uid() THEN 'owner' ELSE member.organization_role END
    )
  FROM public.promoter_organizations organization
  LEFT JOIN public.promoter_organization_members member
    ON member.organization_id = organization.id
   AND member.profile_id = auth.uid()
   AND member.is_active = true
  WHERE auth.uid() IS NOT NULL
    AND (organization.owner_id = auth.uid() OR member.id IS NOT NULL)
  ORDER BY organization.id, CASE WHEN organization.owner_id = auth.uid() THEN 0 ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION public.list_promoter_organization_members(target_organization_id uuid)
RETURNS TABLE (
  member_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  organization_role text,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  owner_uuid uuid;
BEGIN
  SELECT owner_id INTO owner_uuid
  FROM public.promoter_organizations
  WHERE id = target_organization_id;

  IF owner_uuid IS NULL OR NOT public.has_promoter_team_permission(owner_uuid, 'manage_team') THEN
    RAISE EXCEPTION 'promoter_team_not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    member.id,
    member.profile_id,
    profile.full_name,
    profile.email,
    member.organization_role,
    member.is_active,
    member.created_at
  FROM public.promoter_organization_members member
  JOIN public.profiles profile ON profile.id = member.profile_id
  WHERE member.organization_id = target_organization_id
    AND member.is_active = true
  ORDER BY member.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_promoter_organization_member_by_email(
  target_organization_id uuid,
  member_email text,
  next_organization_role text
)
RETURNS public.promoter_organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  organization_row public.promoter_organizations%ROWTYPE;
  target_profile public.profiles%ROWTYPE;
  member_row public.promoter_organization_members%ROWTYPE;
BEGIN
  SELECT * INTO organization_row
  FROM public.promoter_organizations
  WHERE id = target_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'promoter_team_not_found'; END IF;

  IF NOT public.has_promoter_team_permission(organization_row.owner_id, 'manage_team') THEN
    RAISE EXCEPTION 'promoter_team_not_authorized';
  END IF;

  IF next_organization_role NOT IN (
    'organization_admin','event_manager','matchmaker','operations',
    'media_producer','finance','read_only'
  ) THEN
    RAISE EXCEPTION 'promoter_team_invalid_role';
  END IF;

  SELECT * INTO target_profile
  FROM public.profiles
  WHERE lower(email) = lower(btrim(member_email))
    AND COALESCE(is_banned, false) = false
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'promoter_team_account_not_found'; END IF;
  IF target_profile.id = organization_row.owner_id THEN
    RAISE EXCEPTION 'promoter_team_owner_is_implicit';
  END IF;

  INSERT INTO public.promoter_organization_members (
    organization_id, profile_id, organization_role, is_active, invited_by
  ) VALUES (
    target_organization_id, target_profile.id, next_organization_role, true, auth.uid()
  )
  ON CONFLICT (organization_id, profile_id) DO UPDATE
    SET organization_role = excluded.organization_role,
        is_active = true,
        invited_by = auth.uid(),
        updated_at = now()
  RETURNING * INTO member_row;

  RETURN member_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_promoter_organization_member(member_uuid uuid)
RETURNS public.promoter_organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  member_row public.promoter_organization_members%ROWTYPE;
  owner_uuid uuid;
BEGIN
  SELECT * INTO member_row
  FROM public.promoter_organization_members member
  WHERE member.id = member_uuid
  FOR UPDATE;

  IF member_row.id IS NULL THEN RAISE EXCEPTION 'promoter_team_member_not_found'; END IF;

  SELECT organization.owner_id INTO owner_uuid
  FROM public.promoter_organizations organization
  WHERE organization.id = member_row.organization_id;

  IF NOT public.has_promoter_team_permission(owner_uuid, 'manage_team') THEN
    RAISE EXCEPTION 'promoter_team_not_authorized';
  END IF;

  UPDATE public.promoter_organization_members
  SET is_active = false, updated_at = now()
  WHERE id = member_uuid
  RETURNING * INTO member_row;

  RETURN member_row;
END;
$$;

REVOKE ALL ON FUNCTION public.promoter_team_permissions_for_role(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_promoter_team_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_event_team_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_my_promoter_organization(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_promoter_organizations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_promoter_organization_members(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_promoter_organization_member_by_email(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_promoter_organization_member(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.promoter_team_permissions_for_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_promoter_team_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_event_team_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_promoter_organization(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_promoter_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_promoter_organization_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_promoter_organization_member_by_email(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_promoter_organization_member(uuid) TO authenticated;

ALTER TABLE public.promoter_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoter_organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promoter_organizations_select_member ON public.promoter_organizations;
CREATE POLICY promoter_organizations_select_member
ON public.promoter_organizations FOR SELECT TO authenticated
USING (public.has_promoter_team_permission(owner_id, 'view_dashboard'));

DROP POLICY IF EXISTS promoter_organization_members_select_manager ON public.promoter_organization_members;
CREATE POLICY promoter_organization_members_select_manager
ON public.promoter_organization_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.promoter_organizations organization
    WHERE organization.id = promoter_organization_members.organization_id
      AND public.has_promoter_team_permission(organization.owner_id, 'manage_team')
  )
);

GRANT SELECT ON public.promoter_organizations TO authenticated;
GRANT SELECT ON public.promoter_organization_members TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.promoter_organizations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.promoter_organization_members FROM anon, authenticated;

-- Extend existing event permissions with organization roles.
CREATE OR REPLACE FUNCTION public.is_event_staff_member(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_event_team_permission(target_event_id, 'view_event')
    OR EXISTS (
      SELECT 1 FROM public.event_staff staff
      WHERE staff.event_id = target_event_id
        AND staff.profile_id = auth.uid()
        AND staff.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_event_operator(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_event_team_permission(target_event_id, 'matchmaking')
    OR EXISTS (
      SELECT 1 FROM public.event_staff staff
      WHERE staff.event_id = target_event_id
        AND staff.profile_id = auth.uid()
        AND staff.is_active = true
        AND staff.staff_role = 'manager'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_event_day_operator(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_event_team_permission(target_event_id, 'operation')
    OR EXISTS (
      SELECT 1 FROM public.event_staff staff
      WHERE staff.event_id = target_event_id
        AND staff.profile_id = auth.uid()
        AND staff.is_active = true
        AND staff.staff_role = 'operator'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_event_producer(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_event_team_permission(target_event_id, 'production')
    OR EXISTS (
      SELECT 1 FROM public.event_staff staff
      WHERE staff.event_id = target_event_id
        AND staff.profile_id = auth.uid()
        AND staff.is_active = true
        AND staff.staff_role = 'producer'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_event_finance(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_event_team_permission(target_event_id, 'finance')
    OR EXISTS (
      SELECT 1 FROM public.event_staff staff
      WHERE staff.event_id = target_event_id
        AND staff.profile_id = auth.uid()
        AND staff.is_active = true
        AND staff.staff_role = 'manager'
    );
$$;

CREATE OR REPLACE FUNCTION public.assert_event_finance(target_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_event_finance(target_event_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.is_event_finance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_event_finance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_finance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_event_finance(uuid) TO authenticated;

DROP POLICY IF EXISTS events_insert_authorized_creator ON public.events;
CREATE POLICY events_insert_authorized_creator
ON public.events FOR INSERT TO authenticated
WITH CHECK (
  (promoter_id = auth.uid() AND public.can_create_events())
  OR public.has_promoter_team_permission(promoter_id, 'create_event')
);

DROP POLICY IF EXISTS events_update_owner_or_admin ON public.events;
CREATE POLICY events_update_owner_or_admin
ON public.events FOR UPDATE TO authenticated
USING (public.has_promoter_team_permission(promoter_id, 'manage_event'))
WITH CHECK (public.has_promoter_team_permission(promoter_id, 'manage_event'));

-- Deletion and Stripe ownership intentionally remain owner/admin only.

DROP POLICY IF EXISTS event_applications_team_private_select ON public.event_applications;
CREATE POLICY event_applications_team_private_select
ON public.event_applications FOR SELECT TO authenticated
USING (public.has_event_team_permission(event_id, 'view_private'));

DROP POLICY IF EXISTS event_registrations_team_private_select ON public.event_registrations;
CREATE POLICY event_registrations_team_private_select
ON public.event_registrations FOR SELECT TO authenticated
USING (public.has_event_team_permission(event_id, 'view_private'));

DROP POLICY IF EXISTS matches_team_private_select ON public.matches;
CREATE POLICY matches_team_private_select
ON public.matches FOR SELECT TO authenticated
USING (public.has_event_team_permission(event_id, 'view_private'));

DROP POLICY IF EXISTS match_requests_team_private_select ON public.match_requests;
CREATE POLICY match_requests_team_private_select
ON public.match_requests FOR SELECT TO authenticated
USING (public.has_event_team_permission(event_id, 'view_private'));

DROP POLICY IF EXISTS event_matchmaking_settings_team_private_select ON public.event_matchmaking_settings;
CREATE POLICY event_matchmaking_settings_team_private_select
ON public.event_matchmaking_settings FOR SELECT TO authenticated
USING (public.has_event_team_permission(event_id, 'view_private'));

DROP POLICY IF EXISTS event_divisions_team_private_select ON public.event_divisions;
CREATE POLICY event_divisions_team_private_select
ON public.event_divisions FOR SELECT TO authenticated
USING (public.has_event_team_permission(event_id, 'view_private'));

DROP POLICY IF EXISTS event_mats_team_private_select ON public.event_mats;
CREATE POLICY event_mats_team_private_select
ON public.event_mats FOR SELECT TO authenticated
USING (public.has_event_team_permission(event_id, 'view_private'));

DROP POLICY IF EXISTS bouts_team_private_select ON public.bouts;
CREATE POLICY bouts_team_private_select
ON public.bouts FOR SELECT TO authenticated
USING (public.has_event_team_permission(event_id, 'view_private'));

DROP POLICY IF EXISTS registration_payments_team_finance_select ON public.registration_payments;
CREATE POLICY registration_payments_team_finance_select
ON public.registration_payments FOR SELECT TO authenticated
USING (public.has_promoter_team_permission(organizer_id, 'finance'));

-- Organization admins may also manage event-specific temporary staff.
CREATE OR REPLACE FUNCTION public.can_manage_event_staff(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_event_owner_or_admin(target_event_id)
    OR public.has_event_team_permission(target_event_id, 'manage_team');
$$;

REVOKE ALL ON FUNCTION public.can_manage_event_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_event_staff(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_event_staff_by_email(
  target_event_id uuid,
  staff_email text,
  next_staff_role text DEFAULT 'manager'
)
RETURNS public.event_staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_profile public.profiles%ROWTYPE;
  staff_row public.event_staff%ROWTYPE;
  normalized_role text;
BEGIN
  IF NOT public.can_manage_event_staff(target_event_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  normalized_role := COALESCE(NULLIF(trim(next_staff_role), ''), 'manager');
  IF normalized_role NOT IN ('manager', 'operator', 'producer') THEN
    RAISE EXCEPTION 'event_staff_invalid_role';
  END IF;

  SELECT * INTO target_profile
  FROM public.profiles
  WHERE lower(email) = lower(trim(staff_email))
    AND COALESCE(is_banned, false) = false
  LIMIT 1;
  IF target_profile.id IS NULL THEN RAISE EXCEPTION 'event_staff_account_not_found'; END IF;

  INSERT INTO public.event_staff (event_id, profile_id, staff_role, is_active, invited_by)
  VALUES (target_event_id, target_profile.id, normalized_role, true, auth.uid())
  ON CONFLICT (event_id, profile_id) DO UPDATE
    SET staff_role = excluded.staff_role,
        is_active = true,
        invited_by = auth.uid(),
        updated_at = now()
  RETURNING * INTO staff_row;

  RETURN staff_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_event_staff(staff_uuid uuid)
RETURNS public.event_staff
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  staff_row public.event_staff%ROWTYPE;
BEGIN
  SELECT * INTO staff_row
  FROM public.event_staff
  WHERE id = staff_uuid
  FOR UPDATE;
  IF staff_row.id IS NULL THEN RAISE EXCEPTION 'event_staff_assignment_not_found'; END IF;
  IF NOT public.can_manage_event_staff(staff_row.event_id) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  UPDATE public.event_staff
  SET is_active = false, updated_at = now()
  WHERE id = staff_uuid
  RETURNING * INTO staff_row;
  RETURN staff_row;
END;
$$;

-- Finance permission for event registration configuration and confirmation.
CREATE OR REPLACE FUNCTION public.configure_event_payment_settings(
  target_event_id uuid,
  next_registration_type text,
  next_payment_method text,
  next_fee_cents integer
)
RETURNS public.event_payment_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  event_row public.events%ROWTYPE;
  account_row public.organizer_payment_accounts%ROWTYPE;
  settings_row public.event_payment_settings%ROWTYPE;
  normalized_fee integer;
  application_fee integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  SELECT * INTO event_row FROM public.events WHERE id = target_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found.'; END IF;

  IF next_registration_type NOT IN ('free', 'paid') THEN
    RAISE EXCEPTION 'Invalid registration type.';
  END IF;
  IF next_payment_method NOT IN ('stripe', 'manual') THEN
    RAISE EXCEPTION 'Invalid payment method.';
  END IF;

  IF next_registration_type = 'paid' THEN
    PERFORM public.assert_event_finance(target_event_id);
  ELSIF NOT (
    public.is_event_finance(target_event_id)
    OR public.has_event_team_permission(target_event_id, 'manage_event')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  normalized_fee := CASE WHEN next_registration_type = 'paid' THEN COALESCE(next_fee_cents, 0) ELSE 0 END;
  application_fee := 0;

  IF next_registration_type = 'paid' AND normalized_fee <= 0 THEN
    RAISE EXCEPTION 'A paid registration requires a positive fee.';
  END IF;
  IF event_row.status = 'published'
    AND next_registration_type = 'paid'
    AND next_payment_method = 'stripe' THEN
    SELECT * INTO account_row
    FROM public.organizer_payment_accounts
    WHERE user_id = event_row.promoter_id;
    IF NOT FOUND OR NOT account_row.charges_enabled OR NOT account_row.payouts_enabled
      OR NOT account_row.details_submitted OR NOT account_row.onboarding_complete THEN
      RAISE EXCEPTION 'Complete Stripe onboarding before publishing a paid event.';
    END IF;
  END IF;

  INSERT INTO public.event_payment_settings (
    event_id, registration_type, payment_method, registration_fee_cents,
    currency, platform_fee_type, platform_fee_amount
  ) VALUES (
    target_event_id,
    next_registration_type,
    CASE WHEN next_registration_type = 'free' THEN 'manual' ELSE next_payment_method END,
    normalized_fee,
    'mxn',
    'none',
    application_fee
  )
  ON CONFLICT (event_id) DO UPDATE SET
    registration_type = EXCLUDED.registration_type,
    payment_method = EXCLUDED.payment_method,
    registration_fee_cents = EXCLUDED.registration_fee_cents,
    currency = EXCLUDED.currency,
    platform_fee_type = EXCLUDED.platform_fee_type,
    platform_fee_amount = EXCLUDED.platform_fee_amount,
    updated_at = now()
  RETURNING * INTO settings_row;

  UPDATE public.events
  SET signup_fee = CASE WHEN normalized_fee > 0 THEN normalized_fee::numeric / 100 ELSE NULL END
  WHERE id = target_event_id;

  RETURN settings_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.configure_event_payment_settings(uuid,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_event_registration_payment(registration_uuid uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  registration_row public.event_registrations%ROWTYPE;
  settings_row public.event_payment_settings%ROWTYPE;
BEGIN
  SELECT * INTO registration_row FROM public.event_registrations
  WHERE id = registration_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM public.assert_event_finance(registration_row.event_id);

  SELECT * INTO settings_row FROM public.event_payment_settings
  WHERE event_id = registration_row.event_id;
  IF FOUND AND settings_row.registration_type = 'paid' AND settings_row.payment_method = 'stripe' THEN
    RAISE EXCEPTION 'Stripe payments can only be confirmed by a verified webhook.';
  END IF;
  IF registration_row.payment_status <> 'submitted' THEN
    RAISE EXCEPTION 'Only a submitted payment can be confirmed.';
  END IF;

  UPDATE public.event_registrations
  SET payment_status = 'confirmed', registration_status = 'confirmed',
      confirmed_at = now(), updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_manual_event_registration_payment(registration_uuid uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  registration_row public.event_registrations%ROWTYPE;
  settings_row public.event_payment_settings%ROWTYPE;
  has_settings boolean := false;
BEGIN
  SELECT * INTO registration_row FROM public.event_registrations
  WHERE id = registration_uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM public.assert_event_finance(registration_row.event_id);

  SELECT * INTO settings_row FROM public.event_payment_settings
  WHERE event_id = registration_row.event_id;
  has_settings := FOUND;
  IF has_settings AND settings_row.registration_type = 'paid' AND settings_row.payment_method = 'stripe' THEN
    RAISE EXCEPTION 'Stripe payments can only be confirmed by a verified webhook.';
  END IF;

  UPDATE public.event_registrations
  SET payment_status = CASE WHEN has_settings AND settings_row.registration_type = 'free' THEN 'waived' ELSE 'confirmed' END,
      registration_status = 'confirmed',
      confirmed_at = CASE WHEN has_settings AND settings_row.registration_type = 'free' THEN confirmed_at ELSE COALESCE(confirmed_at, now()) END,
      updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_accepted_manual_event_registration_payments(event_uuid uuid)
RETURNS SETOF public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  settings_row public.event_payment_settings%ROWTYPE;
  has_settings boolean := false;
BEGIN
  PERFORM public.assert_event_finance(event_uuid);
  SELECT * INTO settings_row FROM public.event_payment_settings WHERE event_id = event_uuid;
  has_settings := FOUND;
  IF has_settings AND settings_row.registration_type = 'paid' AND settings_row.payment_method = 'stripe' THEN
    RAISE EXCEPTION 'Stripe payments can only be confirmed by a verified webhook.';
  END IF;

  RETURN QUERY
  UPDATE public.event_registrations
  SET payment_status = CASE WHEN has_settings AND settings_row.registration_type = 'free' THEN 'waived' ELSE 'confirmed' END,
      registration_status = 'confirmed',
      confirmed_at = CASE WHEN has_settings AND settings_row.registration_type = 'free' THEN confirmed_at ELSE COALESCE(confirmed_at, now()) END,
      updated_at = now()
  WHERE event_id = event_uuid
    AND approval_status = 'accepted'
    AND payment_status NOT IN ('confirmed', 'waived')
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_event_registration_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_manual_event_registration_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_accepted_manual_event_registration_payments(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
