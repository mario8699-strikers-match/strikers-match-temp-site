-- Allow gym-owner profiles to create and manage their own manual fighter roster.
-- Existing ownership policies already restrict updates and deletes to manager_id = auth.uid().

DROP POLICY IF EXISTS "manual_fighters_insert_creator" ON public.manual_fighters;

CREATE POLICY "manual_fighters_insert_creator" ON public.manual_fighters
  FOR INSERT
  WITH CHECK (
    manager_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles profile
      WHERE profile.id = auth.uid()
        AND profile.role IN ('manager', 'promoter', 'gyms_academies', 'admin')
    )
  );

COMMENT ON POLICY "manual_fighters_insert_creator" ON public.manual_fighters IS
  'Managers, promoters, gym owners, and admins may create manual fighters owned by their own account.';

NOTIFY pgrst, 'reload schema';
