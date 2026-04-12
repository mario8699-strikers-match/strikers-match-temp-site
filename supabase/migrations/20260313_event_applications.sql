-- Add disciplines_needed array to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS disciplines_needed TEXT[] DEFAULT '{}';

-- New event_applications table
CREATE TABLE IF NOT EXISTS public.event_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  fighter_id UUID NOT NULL REFERENCES public.fighters(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, fighter_id)
);

ALTER TABLE public.event_applications ENABLE ROW LEVEL SECURITY;

-- Fighters can view their own applications
CREATE POLICY "fighter_view_own" ON public.event_applications
  FOR SELECT USING (fighter_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid()));

-- Promoters can view applications for their events
CREATE POLICY "promoter_view_event" ON public.event_applications
  FOR SELECT USING (event_id IN (SELECT id FROM public.events WHERE promoter_id = auth.uid()));

-- Fighters can apply to events
CREATE POLICY "fighter_insert" ON public.event_applications
  FOR INSERT WITH CHECK (fighter_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid()));

-- Fighters can withdraw (update status) their own applications
CREATE POLICY "fighter_update" ON public.event_applications
  FOR UPDATE USING (fighter_id IN (SELECT id FROM public.fighters WHERE profile_id = auth.uid()));

-- Promoters can accept/decline applications for their events
CREATE POLICY "promoter_update" ON public.event_applications
  FOR UPDATE USING (event_id IN (SELECT id FROM public.events WHERE promoter_id = auth.uid()));
