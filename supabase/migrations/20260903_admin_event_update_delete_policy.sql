-- Allow admins to update and delete events from the admin portal.
-- The UI already exposes edit/delete for admins; these policies make RLS match that behavior.

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_update_owner_only" ON public.events;
CREATE POLICY "events_update_owner_or_admin"
  ON public.events
  FOR UPDATE
  USING (
    auth.uid() = promoter_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = promoter_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "events_delete_owner_only" ON public.events;
CREATE POLICY "events_delete_owner_or_admin"
  ON public.events
  FOR DELETE
  USING (
    auth.uid() = promoter_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
