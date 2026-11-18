-- Public directory pages must never expose account contact details in anonymous
-- query results or serialized page props. Keep the existing view shape for
-- backwards compatibility, but make email and phone private for every role.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT
  profile.id,
  profile.full_name,
  NULL::text AS email,
  profile.role,
  profile.city,
  profile.state,
  profile.country,
  NULL::text AS phone,
  profile.bio,
  profile.instagram,
  profile.photo_url,
  profile.promoter_federation_status,
  profile.is_available,
  profile.additional_roles,
  false AS is_banned,
  profile.reliability_score,
  profile.total_matches,
  profile.cancellations,
  profile.no_shows,
  profile.created_at,
  profile.updated_at
FROM public.profiles profile
WHERE profile.role <> 'admin'
  AND COALESCE(profile.is_banned, false) = false;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Contact details are available only after authentication and only for active
-- public professional/sponsor profiles. This avoids putting private data in an
-- anonymous page response while preserving the signed-in contact experience.
CREATE OR REPLACE FUNCTION public.get_professional_contact(target_profile_id uuid)
RETURNS TABLE (
  email text,
  phone text,
  instagram text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT target.email, target.phone, target.instagram
  FROM public.profiles AS target
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS viewer
      WHERE viewer.id = auth.uid()
        AND COALESCE(viewer.is_banned, false) = false
    )
    AND target.id = target_profile_id
    AND COALESCE(target.is_banned, false) = false
    AND (
      target.role = 'sponsor'
      OR target.role IN (
        'gyms_academies','recovery_wellness','gear_apparel','nutrition_supplements',
        'local_business','other_service','ring_card_girl','photographer','videographer',
        'broadcast_personality','catering_vendor','venue_rental','judge','ring_rental',
        'ring_announcer','cutman','merchandise_vendor','ringside_doctor','ringside_emt'
      )
      OR target.additional_roles && ARRAY[
        'gyms_academies','recovery_wellness','gear_apparel','nutrition_supplements',
        'local_business','other_service','ring_card_girl','photographer','videographer',
        'broadcast_personality','catering_vendor','venue_rental','judge','ring_rental',
        'ring_announcer','cutman','merchandise_vendor','ringside_doctor','ringside_emt'
      ]::text[]
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_professional_contact(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_professional_contact(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_professional_contact(uuid) TO authenticated;

COMMENT ON VIEW public.public_profiles IS
  'Public profile projection. Account email, phone, birth date, onboarding state, and other operational fields are never exposed.';

COMMENT ON FUNCTION public.get_professional_contact(uuid) IS
  'Returns contact details for an active public professional or sponsor to authenticated, non-banned users only.';
