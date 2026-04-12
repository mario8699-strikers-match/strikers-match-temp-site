-- =============================================
-- Minor Consent System
-- =============================================

-- Add date_of_birth to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

-- Update the auto-create profile trigger to include date_of_birth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, city, phone, date_of_birth)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'promoter'),
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone',
    CASE
      WHEN new.raw_user_meta_data->>'date_of_birth' IS NOT NULL
      THEN (new.raw_user_meta_data->>'date_of_birth')::date
      ELSE NULL
    END
  );
  RETURN new;
END;
$$;

-- Parental consent records
CREATE TABLE IF NOT EXISTS public.parental_consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_full_name    text NOT NULL,
  parent_email        text NOT NULL,
  parent_phone        text NOT NULL,
  relationship        text NOT NULL CHECK (relationship IN ('Padre', 'Madre', 'Tutor Legal')),
  signature_data      text NOT NULL,
  waiver_text_hash    text NOT NULL,
  consented_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_fighter_consent UNIQUE (fighter_profile_id)
);

-- RLS
ALTER TABLE public.parental_consents ENABLE ROW LEVEL SECURITY;

-- Owner can read their own consent
CREATE POLICY "consent_select_own" ON public.parental_consents
  FOR SELECT USING (fighter_profile_id = auth.uid());

-- Owner can insert their own consent
CREATE POLICY "consent_insert_own" ON public.parental_consents
  FOR INSERT WITH CHECK (fighter_profile_id = auth.uid());

-- Admin full read
CREATE POLICY "consent_select_admin" ON public.parental_consents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Promoter can read consent for fighters in their events
CREATE POLICY "consent_select_promoter" ON public.parental_consents
  FOR SELECT USING (
    fighter_profile_id IN (
      SELECT f.profile_id FROM public.fighters f
      JOIN public.event_applications ea ON ea.fighter_id = f.id
      JOIN public.events e ON e.id = ea.event_id
      WHERE e.promoter_id = auth.uid()
    )
  );

-- Index
CREATE INDEX IF NOT EXISTS idx_consent_fighter ON public.parental_consents(fighter_profile_id);
