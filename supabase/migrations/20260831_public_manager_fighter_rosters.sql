-- Representative profiles need to display the visible fighters connected to one
-- selected representative after a user clicks "Ver peleadores".
-- Do not broaden table-level RLS. Expose a targeted read function instead.

CREATE OR REPLACE FUNCTION public.get_public_manager_fighter_ids(target_manager_id uuid)
RETURNS TABLE(fighter_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mf.fighter_id
  FROM public.manager_fighters mf
  JOIN public.profiles manager_profile
    ON manager_profile.id = mf.manager_id
  JOIN public.fighters fighter
    ON fighter.id = mf.fighter_id
  JOIN public.profiles fighter_profile
    ON fighter_profile.id = fighter.profile_id
  WHERE mf.manager_id = target_manager_id
    AND manager_profile.role = 'manager'
    AND COALESCE(manager_profile.is_banned, false) = false
    AND COALESCE(fighter.is_hidden, false) = false
    AND COALESCE(fighter_profile.is_banned, false) = false;
$$;

REVOKE ALL ON FUNCTION public.get_public_manager_fighter_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_manager_fighter_ids(uuid) TO authenticated;
