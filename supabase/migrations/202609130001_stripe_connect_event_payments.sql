-- Stripe Connect direct charges for event registration payments.
--
-- The organizer is the seller of record and receives each direct charge in
-- their connected Stripe account. Strikers Match receives an application fee.
-- Existing manual-payment events remain manual and continue to use the legacy
-- event_registrations.payment_status field for backwards compatibility.

-- ---------------------------------------------------------------------------
-- Connected organizer accounts and per-event payment configuration.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizer_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe' CHECK (provider = 'stripe'),
  stripe_account_id text NOT NULL UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  onboarding_complete boolean NOT NULL DEFAULT false,
  account_display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  registration_type text NOT NULL DEFAULT 'free'
    CHECK (registration_type IN ('free', 'paid')),
  payment_method text NOT NULL DEFAULT 'manual'
    CHECK (payment_method IN ('stripe', 'manual')),
  registration_fee_cents integer NOT NULL DEFAULT 0
    CHECK (registration_fee_cents >= 0),
  currency text NOT NULL DEFAULT 'mxn' CHECK (currency = 'mxn'),
  platform_fee_type text NOT NULL DEFAULT 'none'
    CHECK (platform_fee_type IN ('fixed', 'percentage', 'none')),
  platform_fee_amount integer NOT NULL DEFAULT 0
    CHECK (platform_fee_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_payment_settings_valid_configuration CHECK (
    (registration_type = 'free' AND registration_fee_cents = 0 AND platform_fee_amount = 0)
    OR
    (registration_type = 'paid' AND registration_fee_cents > 0)
  ),
  CONSTRAINT event_payment_settings_stripe_fee_check CHECK (
    payment_method <> 'stripe'
    OR registration_type <> 'paid'
    OR (platform_fee_type = 'none' AND platform_fee_amount = 0)
    OR (platform_fee_type = 'fixed' AND platform_fee_amount > 0 AND registration_fee_cents > platform_fee_amount)
  )
);

CREATE INDEX IF NOT EXISTS idx_event_payment_settings_event
  ON public.event_payment_settings(event_id);

-- Existing paid events were collected manually. This backfill deliberately
-- does not opt any organizer into Stripe or change any existing event state.
INSERT INTO public.event_payment_settings (
  event_id,
  registration_type,
  payment_method,
  registration_fee_cents,
  currency,
  platform_fee_type,
  platform_fee_amount
)
SELECT
  event.id,
  CASE WHEN COALESCE(event.signup_fee, 0) > 0 THEN 'paid' ELSE 'free' END,
  'manual',
  CASE WHEN COALESCE(event.signup_fee, 0) > 0
    THEN ROUND(event.signup_fee * 100)::integer ELSE 0 END,
  'mxn',
  'none',
  0
FROM public.events event
ON CONFLICT (event_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_default_event_payment_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.event_payment_settings (
    event_id, registration_type, payment_method, registration_fee_cents,
    currency, platform_fee_type, platform_fee_amount
  ) VALUES (
    NEW.id,
    CASE WHEN COALESCE(NEW.signup_fee, 0) > 0 THEN 'paid' ELSE 'free' END,
    'manual',
    CASE WHEN COALESCE(NEW.signup_fee, 0) > 0 THEN ROUND(NEW.signup_fee * 100)::integer ELSE 0 END,
    'mxn',
    'none',
    0
  )
  ON CONFLICT (event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_event_payment_settings ON public.events;
CREATE TRIGGER trg_create_default_event_payment_settings
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.create_default_event_payment_settings();

DROP TRIGGER IF EXISTS trg_organizer_payment_accounts_updated_at ON public.organizer_payment_accounts;
CREATE TRIGGER trg_organizer_payment_accounts_updated_at
  BEFORE UPDATE ON public.organizer_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_event_payment_settings_updated_at ON public.event_payment_settings;
CREATE TRIGGER trg_event_payment_settings_updated_at
  BEFORE UPDATE ON public.event_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Only event owners/admins configure payment settings. The RPC synchronizes
-- the legacy events.signup_fee field used throughout the current interface.
CREATE OR REPLACE FUNCTION public.configure_event_payment_settings(
  target_event_id uuid,
  next_registration_type text,
  next_payment_method text,
  next_fee_cents integer
)
RETURNS public.event_payment_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_row public.events%ROWTYPE;
  account_row public.organizer_payment_accounts%ROWTYPE;
  settings_row public.event_payment_settings%ROWTYPE;
  normalized_fee integer;
  application_fee integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  SELECT * INTO event_row FROM public.events WHERE id = target_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found.'; END IF;
  IF NOT public.is_event_owner_or_admin(target_event_id) THEN RAISE EXCEPTION 'Not authorized.'; END IF;

  IF next_registration_type NOT IN ('free', 'paid') THEN
    RAISE EXCEPTION 'Invalid registration type.';
  END IF;
  IF next_payment_method NOT IN ('stripe', 'manual') THEN
    RAISE EXCEPTION 'Invalid payment method.';
  END IF;

  normalized_fee := CASE WHEN next_registration_type = 'paid' THEN COALESCE(next_fee_cents, 0) ELSE 0 END;
  -- Platform-fee plumbing is intentionally retained, but no Strikers Match
  -- fee is enabled until the business amount is explicitly approved.
  application_fee := 0;

  IF next_registration_type = 'paid' AND normalized_fee <= 0 THEN
    RAISE EXCEPTION 'A paid registration requires a positive fee.';
  END IF;
  IF event_row.status = 'published'
    AND next_registration_type = 'paid'
    AND next_payment_method = 'stripe' THEN
    SELECT * INTO account_row
    FROM public.organizer_payment_accounts
    WHERE user_id = event_row.promoter_id;
    IF NOT FOUND OR NOT account_row.charges_enabled OR NOT account_row.payouts_enabled
      OR NOT account_row.details_submitted OR NOT account_row.onboarding_complete THEN
      RAISE EXCEPTION 'Complete Stripe onboarding before publishing a paid event.';
    END IF;
  END IF;

  INSERT INTO public.event_payment_settings (
    event_id, registration_type, payment_method, registration_fee_cents,
    currency, platform_fee_type, platform_fee_amount
  ) VALUES (
    target_event_id,
    next_registration_type,
    CASE WHEN next_registration_type = 'free' THEN 'manual' ELSE next_payment_method END,
    normalized_fee,
    'mxn',
    'none',
    application_fee
  )
  ON CONFLICT (event_id) DO UPDATE SET
    registration_type = EXCLUDED.registration_type,
    payment_method = EXCLUDED.payment_method,
    registration_fee_cents = EXCLUDED.registration_fee_cents,
    currency = EXCLUDED.currency,
    platform_fee_type = EXCLUDED.platform_fee_type,
    platform_fee_amount = EXCLUDED.platform_fee_amount,
    updated_at = now()
  RETURNING * INTO settings_row;

  UPDATE public.events
  SET signup_fee = CASE WHEN normalized_fee > 0 THEN normalized_fee::numeric / 100 ELSE NULL END
  WHERE id = target_event_id;

  RETURN settings_row;
END;
$$;

REVOKE ALL ON FUNCTION public.configure_event_payment_settings(uuid,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configure_event_payment_settings(uuid,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_paid_event_publish_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.event_payment_settings%ROWTYPE;
  account_row public.organizer_payment_accounts%ROWTYPE;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;

  SELECT * INTO settings_row
  FROM public.event_payment_settings
  WHERE event_id = NEW.id;

  -- Direct/legacy inserts have no settings until the AFTER INSERT trigger. They
  -- remain manual for compatibility and are not silently opted into Stripe.
  IF NOT FOUND OR settings_row.registration_type <> 'paid'
    OR settings_row.payment_method <> 'stripe' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO account_row
  FROM public.organizer_payment_accounts
  WHERE user_id = NEW.promoter_id;

  IF NOT FOUND OR NOT account_row.charges_enabled OR NOT account_row.payouts_enabled
    OR NOT account_row.details_submitted OR NOT account_row.onboarding_complete THEN
    RAISE EXCEPTION 'Complete Stripe onboarding before publishing a paid event.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_paid_event_publish_ready ON public.events;
CREATE TRIGGER trg_assert_paid_event_publish_ready
  BEFORE UPDATE OF status, promoter_id ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.assert_paid_event_publish_ready();

-- ---------------------------------------------------------------------------
-- Canonical payment records and webhook idempotency.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.registration_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL UNIQUE REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  fighter_id uuid REFERENCES public.fighters(id) ON DELETE SET NULL,
  organizer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  payer_display_name text,
  stripe_account_id text NOT NULL,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  platform_fee_cents integer NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  currency text NOT NULL DEFAULT 'mxn' CHECK (currency = 'mxn'),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN (
      'unpaid', 'pending', 'processing', 'paid', 'failed',
      'refunded', 'partially_refunded', 'disputed'
    )),
  amount_refunded_cents integer NOT NULL DEFAULT 0 CHECK (amount_refunded_cents >= 0),
  failure_message text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registration_payments_fee_check CHECK (platform_fee_cents < amount_cents),
  CONSTRAINT registration_payments_refund_check CHECK (amount_refunded_cents <= amount_cents)
);

CREATE INDEX IF NOT EXISTS idx_registration_payments_organizer_created
  ON public.registration_payments(organizer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registration_payments_event
  ON public.registration_payments(event_id);
CREATE INDEX IF NOT EXISTS idx_registration_payments_status
  ON public.registration_payments(payment_status);

CREATE TABLE IF NOT EXISTS public.stripe_connect_webhook_events (
  stripe_event_id text PRIMARY KEY,
  stripe_account_id text,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_registration_payments_updated_at ON public.registration_payments;
CREATE TRIGGER trg_registration_payments_updated_at
  BEFORE UPDATE ON public.registration_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Registration review status is independent from payment status.
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'submitted';

ALTER TABLE public.event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_registration_status_check;
ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_registration_status_check
  CHECK (registration_status IN ('draft','submitted','confirmed','rejected','withdrawn','cancelled'));

UPDATE public.event_registrations
SET registration_status = CASE
  WHEN approval_status = 'accepted' THEN 'confirmed'
  WHEN approval_status = 'declined' THEN 'rejected'
  WHEN approval_status = 'withdrawn' THEN 'withdrawn'
  ELSE 'submitted'
END;

CREATE OR REPLACE FUNCTION public.sync_registration_review_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.registration_status := CASE
    WHEN NEW.approval_status = 'accepted' THEN 'confirmed'
    WHEN NEW.approval_status = 'declined' THEN 'rejected'
    WHEN NEW.approval_status = 'withdrawn' THEN 'withdrawn'
    ELSE COALESCE(NEW.registration_status, 'submitted')
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_registration_review_status ON public.event_registrations;
CREATE TRIGGER trg_sync_registration_review_status
  BEFORE INSERT OR UPDATE OF approval_status ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_registration_review_status();

CREATE OR REPLACE FUNCTION public.apply_registration_payment_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.event_payment_settings%ROWTYPE;
BEGIN
  SELECT * INTO settings_row
  FROM public.event_payment_settings
  WHERE event_id = NEW.event_id;

  IF FOUND AND settings_row.registration_type = 'free' THEN
    UPDATE public.event_registrations
    SET payment_status = 'waived', registration_status = 'confirmed', updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_registration_payment_defaults ON public.event_registrations;
CREATE TRIGGER trg_apply_registration_payment_defaults
  AFTER INSERT ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.apply_registration_payment_defaults();

-- Manual confirmation cannot be used to bypass a Stripe Checkout payment.
CREATE OR REPLACE FUNCTION public.submit_event_registration_payment(registration_uuid uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_row public.event_registrations%ROWTYPE;
  settings_row public.event_payment_settings%ROWTYPE;
BEGIN
  SELECT registration.* INTO registration_row
  FROM public.event_registrations registration
  JOIN public.fighters fighter ON fighter.id = registration.fighter_id
  WHERE registration.id = registration_uuid
    AND fighter.profile_id = auth.uid()
  FOR UPDATE OF registration;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found or not authorized.'; END IF;

  SELECT * INTO settings_row FROM public.event_payment_settings WHERE event_id = registration_row.event_id;
  IF FOUND AND settings_row.registration_type = 'paid' AND settings_row.payment_method = 'stripe' THEN
    RAISE EXCEPTION 'Complete payment through Stripe Checkout.';
  END IF;
  IF registration_row.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'Payment was already submitted or confirmed.';
  END IF;

  UPDATE public.event_registrations
  SET payment_status = 'submitted', submitted_at = now(), updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_event_registration_payment(registration_uuid uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_row public.event_registrations%ROWTYPE;
  settings_row public.event_payment_settings%ROWTYPE;
BEGIN
  SELECT * INTO registration_row
  FROM public.event_registrations
  WHERE id = registration_uuid
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  PERFORM public.assert_event_operator(registration_row.event_id);

  SELECT * INTO settings_row FROM public.event_payment_settings WHERE event_id = registration_row.event_id;
  IF FOUND AND settings_row.registration_type = 'paid' AND settings_row.payment_method = 'stripe' THEN
    RAISE EXCEPTION 'Stripe payments can only be confirmed by a verified webhook.';
  END IF;
  IF registration_row.payment_status <> 'submitted' THEN
    RAISE EXCEPTION 'Only a submitted payment can be confirmed.';
  END IF;

  UPDATE public.event_registrations
  SET payment_status = 'confirmed', registration_status = 'confirmed', confirmed_at = now(), updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;
  RETURN registration_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_event_registration_payment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_event_registration_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_event_registration_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_event_registration_payment(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security. Payment mutations are server/webhook-only.
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizer_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizer_payment_accounts_select_owner_admin"
  ON public.organizer_payment_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "event_payment_settings_select"
  ON public.event_payment_settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "registration_payments_select_participant_organizer_admin"
  ON public.registration_payments FOR SELECT TO authenticated
  USING (
    organizer_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.fighters fighter
      WHERE fighter.id = registration_payments.fighter_id
        AND fighter.profile_id = auth.uid()
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.organizer_payment_accounts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_payment_settings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.registration_payments FROM anon, authenticated;
REVOKE ALL ON public.stripe_connect_webhook_events FROM anon, authenticated;

GRANT SELECT ON public.organizer_payment_accounts TO authenticated;
GRANT SELECT ON public.event_payment_settings TO anon, authenticated;
GRANT SELECT ON public.registration_payments TO authenticated;

NOTIFY pgrst, 'reload schema';
