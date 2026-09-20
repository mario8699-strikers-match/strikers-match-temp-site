-- Fighter social handles are stored on the owning profile so Instagram remains
-- the single existing source of truth and the other networks follow it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tiktok text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS youtube text,
  ADD COLUMN IF NOT EXISTS x_handle text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tiktok_length CHECK (tiktok IS NULL OR char_length(tiktok) <= 255),
  ADD CONSTRAINT profiles_facebook_length CHECK (facebook IS NULL OR char_length(facebook) <= 255),
  ADD CONSTRAINT profiles_youtube_length CHECK (youtube IS NULL OR char_length(youtube) <= 255),
  ADD CONSTRAINT profiles_x_handle_length CHECK (x_handle IS NULL OR char_length(x_handle) <= 255);

COMMENT ON COLUMN public.profiles.tiktok IS 'Public TikTok handle or profile URL.';
COMMENT ON COLUMN public.profiles.facebook IS 'Public Facebook handle or profile URL.';
COMMENT ON COLUMN public.profiles.youtube IS 'Public YouTube handle or channel URL.';
COMMENT ON COLUMN public.profiles.x_handle IS 'Public X handle or profile URL.';

-- Keep private account data out of the public response while making only the
-- explicitly supplied social handles available on a fighter's public profile.
CREATE OR REPLACE VIEW public.public_fighters
WITH (security_barrier = true)
AS
SELECT
  fighter.id,
  fighter.profile_id,
  fighter.nickname,
  fighter.bio,
  fighter.weight_class,
  fighter.disciplines,
  fighter.exact_weight,
  fighter.height_cm,
  fighter.reach_cm,
  fighter.gym_name,
  fighter.state,
  profile.city AS profile_city,
  fighter.record_wins,
  fighter.record_losses,
  fighter.record_draws,
  fighter.is_available,
  fighter.short_notice_ready,
  fighter.experience_level,
  fighter.photo_url,
  fighter.gender_division,
  fighter.ko_wins,
  fighter.tko_wins,
  fighter.ko_losses,
  fighter.tko_losses,
  fighter.skill_rating,
  fighter.preferred_rulesets,
  fighter.requested_weight_kg,
  fighter.acceptable_weight_min_kg,
  fighter.acceptable_weight_max_kg,
  fighter.last_fight_at,
  fighter.verified,
  fighter.is_hidden,
  fighter.created_at,
  CASE WHEN profile.date_of_birth IS NULL THEN NULL
    ELSE EXTRACT(YEAR FROM age(current_date, profile.date_of_birth))::integer END AS age,
  jsonb_build_object(
    'full_name', profile.full_name,
    'city', profile.city,
    'state', profile.state,
    'country', profile.country,
    'instagram', profile.instagram,
    'tiktok', profile.tiktok,
    'facebook', profile.facebook,
    'youtube', profile.youtube,
    'x_handle', profile.x_handle,
    'is_banned', profile.is_banned,
    'reliability_score', profile.reliability_score,
    'total_matches', profile.total_matches,
    'cancellations', profile.cancellations,
    'no_shows', profile.no_shows
  ) AS profiles
FROM public.fighters fighter
JOIN public.profiles profile ON profile.id = fighter.profile_id
WHERE COALESCE(fighter.is_hidden, false) = false
  AND COALESCE(profile.is_banned, false) = false;

REVOKE ALL ON public.public_fighters FROM PUBLIC;
GRANT SELECT ON public.public_fighters TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
