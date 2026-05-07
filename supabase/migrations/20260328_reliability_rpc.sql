-- =============================================
-- Reliability scoring RPC + audit log
-- Centralised function so client code cannot tamper with deltas.
-- =============================================

-- ── Optional ledger for transparency / debugging ──
CREATE TABLE IF NOT EXISTS public.reliability_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type      text NOT NULL CHECK (event_type IN (
                    'match_accepted', 'match_completed', 'match_declined',
                    'cancel_after_accept', 'no_show'
                  )),
  delta           integer NOT NULL,
  match_id        uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reliability_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reliability_events_select_self" ON public.reliability_events
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "reliability_events_select_admin" ON public.reliability_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_reliability_events_profile
  ON public.reliability_events(profile_id, created_at DESC);

-- ── Apply a clamped reliability delta and increment counters ──
-- delta values:
--   accept: +2, complete: +5, decline: -1, cancel-after-accept: -5, no-show: -15
-- Returns the new reliability_score.
CREATE OR REPLACE FUNCTION public.apply_reliability_delta(
  p_profile_id  uuid,
  p_event_type  text,
  p_match_id    uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta             integer;
  v_inc_total         integer := 0;
  v_inc_cancellations integer := 0;
  v_inc_no_shows      integer := 0;
  v_new_score         integer;
BEGIN
  -- Resolve delta + counter increments from event type
  CASE p_event_type
    WHEN 'match_accepted'      THEN v_delta := 2;
    WHEN 'match_completed'     THEN v_delta := 5;  v_inc_total := 1;
    WHEN 'match_declined'      THEN v_delta := -1;
    WHEN 'cancel_after_accept' THEN v_delta := -5; v_inc_cancellations := 1;
    WHEN 'no_show'             THEN v_delta := -15; v_inc_no_shows := 1;
    ELSE
      RAISE EXCEPTION 'Unknown reliability event type: %', p_event_type;
  END CASE;

  -- Update profile counters + clamped score in one statement
  UPDATE public.profiles
     SET reliability_score = LEAST(100, GREATEST(0, COALESCE(reliability_score, 80) + v_delta)),
         total_matches     = COALESCE(total_matches, 0)     + v_inc_total,
         cancellations     = COALESCE(cancellations, 0)     + v_inc_cancellations,
         no_shows          = COALESCE(no_shows, 0)          + v_inc_no_shows,
         updated_at        = now()
   WHERE id = p_profile_id
   RETURNING reliability_score INTO v_new_score;

  IF v_new_score IS NULL THEN
    RAISE EXCEPTION 'Profile % not found', p_profile_id;
  END IF;

  -- Audit log
  INSERT INTO public.reliability_events (profile_id, event_type, delta, match_id)
  VALUES (p_profile_id, p_event_type, v_delta, p_match_id);

  RETURN v_new_score;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_reliability_delta(uuid, text, uuid) TO authenticated;
