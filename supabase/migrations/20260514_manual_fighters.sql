-- Manual fighters: fighters added by managers who are not registered on the platform
CREATE TABLE IF NOT EXISTS public.manual_fighters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  nickname     TEXT,
  weight_class TEXT,
  discipline   TEXT,
  record_wins  INTEGER NOT NULL DEFAULT 0,
  record_losses INTEGER NOT NULL DEFAULT 0,
  record_draws INTEGER NOT NULL DEFAULT 0,
  phone        TEXT,
  email        TEXT,
  city         TEXT,
  gym_name     TEXT,
  experience_level TEXT NOT NULL DEFAULT 'amateur' CHECK (experience_level IN ('amateur', 'pro')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.manual_fighters ENABLE ROW LEVEL SECURITY;

-- Managers can only see/manage their own manual fighters
CREATE POLICY "manual_fighters_select" ON public.manual_fighters FOR SELECT USING (
  manager_id = auth.uid()
);
CREATE POLICY "manual_fighters_insert" ON public.manual_fighters FOR INSERT WITH CHECK (
  manager_id = auth.uid()
);
CREATE POLICY "manual_fighters_update" ON public.manual_fighters FOR UPDATE USING (
  manager_id = auth.uid()
);
CREATE POLICY "manual_fighters_delete" ON public.manual_fighters FOR DELETE USING (
  manager_id = auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_manual_fighters_manager_id ON public.manual_fighters(manager_id);
