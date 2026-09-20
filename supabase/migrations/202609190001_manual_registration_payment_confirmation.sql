-- Event operators may record an offline/manual registration payment.
-- Stripe registrations remain webhook-only and cannot be manually confirmed.

CREATE OR REPLACE FUNCTION public.confirm_manual_event_registration_payment(registration_uuid uuid)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registration_row public.event_registrations%ROWTYPE;
  settings_row public.event_payment_settings%ROWTYPE;
  has_settings boolean := false;
BEGIN
  SELECT * INTO registration_row
  FROM public.event_registrations
  WHERE id = registration_uuid
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found.'; END IF;

  PERFORM public.assert_event_operator(registration_row.event_id);

  SELECT * INTO settings_row
  FROM public.event_payment_settings
  WHERE event_id = registration_row.event_id;
  has_settings := FOUND;

  IF has_settings AND settings_row.registration_type = 'paid'
    AND settings_row.payment_method = 'stripe' THEN
    RAISE EXCEPTION 'Stripe payments can only be confirmed by a verified webhook.';
  END IF;

  UPDATE public.event_registrations
  SET payment_status = CASE
        WHEN has_settings AND settings_row.registration_type = 'free' THEN 'waived'
        ELSE 'confirmed'
      END,
      registration_status = 'confirmed',
      confirmed_at = CASE
        WHEN has_settings AND settings_row.registration_type = 'free' THEN confirmed_at
        ELSE COALESCE(confirmed_at, now())
      END,
      updated_at = now()
  WHERE id = registration_uuid
  RETURNING * INTO registration_row;

  RETURN registration_row;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_manual_event_registration_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_manual_event_registration_payment(uuid) TO authenticated;

-- Event operators can confirm every accepted, still-unpaid registration in one
-- action. This is intentionally restricted to manual/offline payment events.
CREATE OR REPLACE FUNCTION public.confirm_accepted_manual_event_registration_payments(event_uuid uuid)
RETURNS SETOF public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.event_payment_settings%ROWTYPE;
  has_settings boolean := false;
BEGIN
  PERFORM public.assert_event_operator(event_uuid);

  SELECT * INTO settings_row
  FROM public.event_payment_settings
  WHERE event_id = event_uuid;
  has_settings := FOUND;

  IF has_settings AND settings_row.registration_type = 'paid'
    AND settings_row.payment_method = 'stripe' THEN
    RAISE EXCEPTION 'Stripe payments can only be confirmed by a verified webhook.';
  END IF;

  RETURN QUERY
  UPDATE public.event_registrations
  SET payment_status = CASE
        WHEN has_settings AND settings_row.registration_type = 'free' THEN 'waived'
        ELSE 'confirmed'
      END,
      registration_status = 'confirmed',
      confirmed_at = CASE
        WHEN has_settings AND settings_row.registration_type = 'free' THEN confirmed_at
        ELSE COALESCE(confirmed_at, now())
      END,
      updated_at = now()
  WHERE event_id = event_uuid
    AND approval_status = 'accepted'
    AND payment_status NOT IN ('confirmed', 'waived')
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_accepted_manual_event_registration_payments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_accepted_manual_event_registration_payments(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
