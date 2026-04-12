-- =============================================
-- Promoter Subscriptions / Monetization
-- =============================================

CREATE TABLE IF NOT EXISTS public.promoter_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_type    text NOT NULL DEFAULT 'free'
                 CHECK (plan_type IN ('free', 'basic', 'pro', 'per_request')),
  requests_used integer NOT NULL DEFAULT 0,
  max_requests  integer NOT NULL DEFAULT 1,   -- free = 1 request (one-time)
  is_active    boolean NOT NULL DEFAULT true,
  trial_used   boolean NOT NULL DEFAULT false,
  free_request_used boolean NOT NULL DEFAULT false,  -- ONE TIME ONLY, never resets
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_profile_subscription UNIQUE (profile_id)
);

-- RLS
ALTER TABLE public.promoter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner can read their own subscription
CREATE POLICY "sub_select_own" ON public.promoter_subscriptions
  FOR SELECT USING (profile_id = auth.uid());

-- Owner can update their own (for incrementing requests_used)
CREATE POLICY "sub_update_own" ON public.promoter_subscriptions
  FOR UPDATE USING (profile_id = auth.uid());

-- Allow insert for authenticated users (auto-create on first check)
CREATE POLICY "sub_insert_own" ON public.promoter_subscriptions
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Admins can read all (for admin panel)
CREATE POLICY "sub_select_admin" ON public.promoter_subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update all (for manual plan changes)
CREATE POLICY "sub_update_admin" ON public.promoter_subscriptions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
