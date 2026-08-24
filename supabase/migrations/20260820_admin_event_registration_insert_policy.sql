-- Event Engine follow-up — allow admins to create event registrations.
-- Existing policies already allow admin SELECT and UPDATE on event_registrations.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_registrations'
      AND policyname = 'reg_insert_admin'
  ) THEN
    CREATE POLICY "reg_insert_admin" ON public.event_registrations
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
      );
  END IF;
END;
$$;
