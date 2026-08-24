-- Business listings / ads-ready directory.
-- Public product name: Directorio.
-- Internal model remains generic so featured ads and paid placement can be added later.

CREATE TABLE IF NOT EXISTS public.business_listings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text NOT NULL,
  description text,
  city text,
  state text,
  phone text,
  email text,
  website_url text,
  instagram text,
  image_url text,
  image_storage_path text,
  status text NOT NULL DEFAULT 'pending_review',
  is_featured boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_listings_category_check CHECK (
    category IN (
      'gyms_academies',
      'recovery_wellness',
      'event_services',
      'gear_apparel',
      'nutrition_supplements',
      'local_business',
      'other'
    )
  ),
  CONSTRAINT business_listings_status_check CHECK (
    status IN ('draft', 'pending_review', 'published', 'rejected', 'expired')
  )
);

DROP TRIGGER IF EXISTS set_business_listings_updated_at ON public.business_listings;
CREATE TRIGGER set_business_listings_updated_at
  BEFORE UPDATE ON public.business_listings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_business_listings_public
  ON public.business_listings(status, is_featured, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_listings_owner
  ON public.business_listings(owner_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_listings_category
  ON public.business_listings(category, status);

ALTER TABLE public.business_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_listings_select_public_owner_admin" ON public.business_listings;
CREATE POLICY "business_listings_select_public_owner_admin"
  ON public.business_listings
  FOR SELECT
  USING (
    status = 'published'
    OR owner_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "business_listings_insert_owner" ON public.business_listings;
CREATE POLICY "business_listings_insert_owner"
  ON public.business_listings
  FOR INSERT
  WITH CHECK (
    owner_profile_id = auth.uid()
    AND status IN ('draft', 'pending_review')
  );

DROP POLICY IF EXISTS "business_listings_update_owner_or_admin" ON public.business_listings;
CREATE POLICY "business_listings_update_owner_or_admin"
  ON public.business_listings
  FOR UPDATE
  USING (
    owner_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    (
      owner_profile_id = auth.uid()
      AND status IN ('draft', 'pending_review')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "business_listings_delete_owner_or_admin" ON public.business_listings;
CREATE POLICY "business_listings_delete_owner_or_admin"
  ON public.business_listings
  FOR DELETE
  USING (
    owner_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
