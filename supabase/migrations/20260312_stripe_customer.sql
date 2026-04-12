-- =============================================
-- Stripe Customer/Subscription ID columns
-- =============================================
-- These columns link Supabase users to Stripe customers
-- for subscription management and renewal tracking.

ALTER TABLE public.promoter_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Index for webhook lookups by stripe_subscription_id
CREATE INDEX IF NOT EXISTS idx_sub_stripe_subscription
  ON public.promoter_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
