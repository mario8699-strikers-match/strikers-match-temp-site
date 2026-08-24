-- Public aggregate follower counts for registered fighter cards.
-- This does not expose spectator identities or individual follow rows.

CREATE OR REPLACE FUNCTION public.get_fighter_follower_counts(target_fighter_ids uuid[])
RETURNS TABLE(fighter_id uuid, followers_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fighter.id AS fighter_id,
    COUNT(follow.id)::bigint AS followers_count
  FROM public.fighters fighter
  LEFT JOIN public.fighter_follows follow
    ON follow.fighter_id = fighter.id
  JOIN public.profiles fighter_profile
    ON fighter_profile.id = fighter.profile_id
  WHERE fighter.id = ANY(target_fighter_ids)
    AND COALESCE(fighter.is_hidden, false) = false
    AND COALESCE(fighter_profile.is_banned, false) = false
  GROUP BY fighter.id;
$$;

REVOKE ALL ON FUNCTION public.get_fighter_follower_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fighter_follower_counts(uuid[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
