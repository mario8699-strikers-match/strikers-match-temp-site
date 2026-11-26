-- Secure invitation and registration flow for promoter organization teams.
-- Organization roles remain separate from the account's global profile role,
-- so an invite can never grant platform-wide promoter or administrator access.

CREATE TABLE IF NOT EXISTS public.promoter_organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.promoter_organizations(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (char_length(btrim(email)) BETWEEN 3 AND 320),
  organization_role text NOT NULL CHECK (organization_role IN (
    'organization_admin',
    'event_manager',
    'matchmaker',
    'operations',
    'media_producer',
    'finance',
    'read_only'
  )),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  invitation_status text NOT NULL DEFAULT 'pending' CHECK (invitation_status IN (
    'pending', 'accepted', 'revoked', 'expired'
  )),
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promoter_team_invitations_organization
  ON public.promoter_organization_invitations(organization_id, invitation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promoter_team_invitations_email
  ON public.promoter_organization_invitations(lower(email), invitation_status);

DROP TRIGGER IF EXISTS trg_promoter_organization_invitations_updated_at
  ON public.promoter_organization_invitations;
CREATE TRIGGER trg_promoter_organization_invitations_updated_at
BEFORE UPDATE ON public.promoter_organization_invitations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.promoter_organization_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promoter_organization_invitations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_promoter_organization_invitation(
  target_organization_id uuid,
  member_email text,
  next_organization_role text,
  invitation_token_hash text,
  invitation_expires_at timestamptz
)
RETURNS TABLE (
  invitation_id uuid,
  organization_name text,
  normalized_email text,
  assigned_role text,
  invitation_action text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  organization_row public.promoter_organizations%ROWTYPE;
  target_profile public.profiles%ROWTYPE;
  invitation_row public.promoter_organization_invitations%ROWTYPE;
  clean_email text := lower(btrim(member_email));
BEGIN
  SELECT * INTO organization_row
  FROM public.promoter_organizations
  WHERE id = target_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'promoter_team_not_found'; END IF;

  IF NOT public.has_promoter_team_permission(organization_row.owner_id, 'manage_team') THEN
    RAISE EXCEPTION 'promoter_team_not_authorized';
  END IF;
  IF clean_email IS NULL OR clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'promoter_team_invalid_email';
  END IF;
  IF next_organization_role NOT IN (
    'organization_admin','event_manager','matchmaker','operations',
    'media_producer','finance','read_only'
  ) THEN
    RAISE EXCEPTION 'promoter_team_invalid_role';
  END IF;
  IF invitation_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'promoter_team_invalid_invitation_token';
  END IF;
  IF invitation_expires_at <= now() OR invitation_expires_at > now() + interval '30 days' THEN
    RAISE EXCEPTION 'promoter_team_invalid_expiration';
  END IF;

  SELECT * INTO target_profile
  FROM public.profiles
  WHERE lower(email) = clean_email
  LIMIT 1;

  IF FOUND THEN
    IF COALESCE(target_profile.is_banned, false) THEN
      RAISE EXCEPTION 'promoter_team_account_unavailable';
    END IF;
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
          updated_at = now();

    UPDATE public.promoter_organization_invitations
    SET invitation_status = 'revoked', updated_at = now()
    WHERE organization_id = target_organization_id
      AND lower(email) = clean_email
      AND invitation_status = 'pending';

    RETURN QUERY SELECT
      NULL::uuid,
      organization_row.name,
      clean_email,
      next_organization_role,
      'member_added'::text,
      invitation_expires_at;
    RETURN;
  END IF;

  UPDATE public.promoter_organization_invitations
  SET invitation_status = 'revoked', updated_at = now()
  WHERE organization_id = target_organization_id
    AND lower(email) = clean_email
    AND invitation_status = 'pending';

  INSERT INTO public.promoter_organization_invitations (
    organization_id, email, organization_role, token_hash, invited_by, expires_at
  ) VALUES (
    target_organization_id,
    clean_email,
    next_organization_role,
    invitation_token_hash,
    auth.uid(),
    invitation_expires_at
  )
  RETURNING * INTO invitation_row;

  RETURN QUERY SELECT
    invitation_row.id,
    organization_row.name,
    clean_email,
    next_organization_role,
    'invitation_created'::text,
    invitation_row.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_promoter_organization_invitation(
  invitation_token_hash text
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  assigned_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  invitation_row public.promoter_organization_invitations%ROWTYPE;
  organization_row public.promoter_organizations%ROWTYPE;
  current_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  SELECT * INTO current_profile
  FROM public.profiles
  WHERE id = auth.uid()
    AND COALESCE(is_banned, false) = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'promoter_team_account_unavailable'; END IF;

  SELECT * INTO invitation_row
  FROM public.promoter_organization_invitations invitation
  WHERE invitation.token_hash = invitation_token_hash
  FOR UPDATE;
  IF NOT FOUND OR invitation_row.invitation_status <> 'pending' THEN
    RAISE EXCEPTION 'promoter_team_invitation_invalid';
  END IF;
  IF invitation_row.expires_at <= now() THEN
    UPDATE public.promoter_organization_invitations
    SET invitation_status = 'expired', updated_at = now()
    WHERE id = invitation_row.id;
    RAISE EXCEPTION 'promoter_team_invitation_expired';
  END IF;
  IF lower(current_profile.email) <> lower(invitation_row.email) THEN
    RAISE EXCEPTION 'promoter_team_invitation_email_mismatch';
  END IF;

  SELECT * INTO organization_row
  FROM public.promoter_organizations
  WHERE id = invitation_row.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'promoter_team_not_found'; END IF;
  IF organization_row.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'promoter_team_owner_is_implicit';
  END IF;

  INSERT INTO public.promoter_organization_members (
    organization_id, profile_id, organization_role, is_active, invited_by
  ) VALUES (
    invitation_row.organization_id,
    auth.uid(),
    invitation_row.organization_role,
    true,
    invitation_row.invited_by
  )
  ON CONFLICT (organization_id, profile_id) DO UPDATE
    SET organization_role = excluded.organization_role,
        is_active = true,
        invited_by = excluded.invited_by,
        updated_at = now();

  UPDATE public.promoter_organization_invitations
  SET invitation_status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  WHERE id = invitation_row.id;

  RETURN QUERY SELECT
    organization_row.id,
    organization_row.name,
    invitation_row.organization_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_promoter_organization_invitations(
  target_organization_id uuid
)
RETURNS TABLE (
  invitation_id uuid,
  email text,
  organization_role text,
  invitation_status text,
  expires_at timestamptz,
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
    invitation.id,
    invitation.email,
    invitation.organization_role,
    CASE
      WHEN invitation.invitation_status = 'pending' AND invitation.expires_at <= now() THEN 'expired'
      ELSE invitation.invitation_status
    END,
    invitation.expires_at,
    invitation.created_at
  FROM public.promoter_organization_invitations invitation
  WHERE invitation.organization_id = target_organization_id
    AND invitation.invitation_status = 'pending'
  ORDER BY invitation.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_promoter_organization_invitation(
  invitation_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  owner_uuid uuid;
BEGIN
  SELECT organization.owner_id INTO owner_uuid
  FROM public.promoter_organization_invitations invitation
  JOIN public.promoter_organizations organization ON organization.id = invitation.organization_id
  WHERE invitation.id = invitation_uuid;
  IF owner_uuid IS NULL OR NOT public.has_promoter_team_permission(owner_uuid, 'manage_team') THEN
    RAISE EXCEPTION 'promoter_team_not_authorized';
  END IF;

  UPDATE public.promoter_organization_invitations
  SET invitation_status = 'revoked', updated_at = now()
  WHERE id = invitation_uuid
    AND invitation_status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.create_promoter_organization_invitation(uuid,text,text,text,timestamptz)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_promoter_organization_invitation(text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_promoter_organization_invitations(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_promoter_organization_invitation(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_promoter_organization_invitation(uuid,text,text,text,timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_promoter_organization_invitation(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_promoter_organization_invitations(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_promoter_organization_invitation(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
