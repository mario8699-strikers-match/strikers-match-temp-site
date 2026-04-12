-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can view events (public read)
CREATE POLICY "events_select_all"
  ON public.events
  FOR SELECT
  USING (true);

-- Only authenticated promoters can create events
CREATE POLICY "events_insert_promoter_only"
  ON public.events
  FOR INSERT
  WITH CHECK (auth.uid() = promoter_id);

-- Only the promoter who owns the event can update it
CREATE POLICY "events_update_owner_only"
  ON public.events
  FOR UPDATE
  USING (auth.uid() = promoter_id)
  WITH CHECK (auth.uid() = promoter_id);

-- Only the promoter who owns the event can delete it
CREATE POLICY "events_delete_owner_only"
  ON public.events
  FOR DELETE
  USING (auth.uid() = promoter_id);
