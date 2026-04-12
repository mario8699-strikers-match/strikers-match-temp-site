-- =============================================
-- Event Registrations — external payment tracking
-- =============================================

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  fighter_id     uuid NOT NULL REFERENCES public.fighters(id) ON DELETE CASCADE,
  payment_status text NOT NULL DEFAULT 'pending'
                   CHECK (payment_status IN ('pending', 'submitted', 'confirmed')),
  submitted_at   timestamptz,
  confirmed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate registrations for same fighter + event
  CONSTRAINT unique_fighter_event_registration UNIQUE (fighter_id, event_id)
);

-- RLS
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Fighters can read their own registrations
CREATE POLICY "reg_select_own_fighter" ON public.event_registrations
  FOR SELECT USING (
    fighter_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
  );

-- Fighters can insert their own registration
CREATE POLICY "reg_insert_own_fighter" ON public.event_registrations
  FOR INSERT WITH CHECK (
    fighter_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
  );

-- Fighters can update their own (for submitting payment)
CREATE POLICY "reg_update_own_fighter" ON public.event_registrations
  FOR UPDATE USING (
    fighter_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid())
  );

-- Promoters can read registrations for their events
CREATE POLICY "reg_select_promoter" ON public.event_registrations
  FOR SELECT USING (
    event_id IN (SELECT id FROM public.events WHERE promoter_id = auth.uid())
  );

-- Promoters can update registrations for their events (for confirming payment)
CREATE POLICY "reg_update_promoter" ON public.event_registrations
  FOR UPDATE USING (
    event_id IN (SELECT id FROM public.events WHERE promoter_id = auth.uid())
  );

-- Admins full access
CREATE POLICY "reg_select_admin" ON public.event_registrations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "reg_update_admin" ON public.event_registrations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_reg_event_id ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_reg_fighter_id ON public.event_registrations(fighter_id);
CREATE INDEX IF NOT EXISTS idx_reg_payment_status ON public.event_registrations(payment_status);
