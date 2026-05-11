-- Allow every admin to view and manage applications for events that were
-- created by an admin (i.e. house events run by the platform team).
-- Regular promoter events remain private to the promoter who created them.

-- Drop first so the migration is re-runnable.
DROP POLICY IF EXISTS "admin_view_admin_events" ON public.event_applications;
DROP POLICY IF EXISTS "admin_update_admin_events" ON public.event_applications;

-- SELECT: any admin can read applications for events whose promoter is an admin.
CREATE POLICY "admin_view_admin_events" ON public.event_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    AND event_id IN (
      SELECT e.id
      FROM public.events e
      JOIN public.profiles p ON p.id = e.promoter_id
      WHERE p.role = 'admin'
    )
  );

-- UPDATE: any admin can accept/decline applications for admin-created events.
CREATE POLICY "admin_update_admin_events" ON public.event_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    AND event_id IN (
      SELECT e.id
      FROM public.events e
      JOIN public.profiles p ON p.id = e.promoter_id
      WHERE p.role = 'admin'
    )
  );
