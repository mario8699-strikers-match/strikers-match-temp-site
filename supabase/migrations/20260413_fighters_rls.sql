-- =============================================
-- Allow admin users to update fighters table
-- =============================================

-- Ensure RLS is enabled
ALTER TABLE public.fighters ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "fighters_select_all" ON public.fighters;
DROP POLICY IF EXISTS "fighters_update_own" ON public.fighters;
DROP POLICY IF EXISTS "fighters_update_admin" ON public.fighters;
DROP POLICY IF EXISTS "fighters_insert_own" ON public.fighters;

-- Admin can read all fighters
CREATE POLICY "fighters_select_all" ON public.fighters
  FOR SELECT USING (true);

-- Fighter can update own record
CREATE POLICY "fighters_update_own" ON public.fighters
  FOR UPDATE USING (
    profile_id = auth.uid()
  );

-- Admin can update any fighter (for verification)
CREATE POLICY "fighters_update_admin" ON public.fighters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Fighter can insert own record
CREATE POLICY "fighters_insert_own" ON public.fighters
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
  );
