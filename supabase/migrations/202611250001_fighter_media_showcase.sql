-- Public recent-fight and highlight links for both account-owned and roster fighters.

CREATE TABLE IF NOT EXISTS public.fighter_media_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_id uuid REFERENCES public.fighters(id) ON DELETE CASCADE,
  manual_fighter_id uuid REFERENCES public.manual_fighters(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('recent_fight', 'highlight')),
  title text CHECK (char_length(title) <= 120),
  url text NOT NULL CHECK (
    char_length(url) <= 1000
    AND url ~* '^https?://[^[:space:]]+$'
  ),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fighter_media_links_one_owner CHECK (
    num_nonnulls(fighter_id, manual_fighter_id) = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_fighter_media_links_fighter
  ON public.fighter_media_links(fighter_id, category, sort_order);
CREATE INDEX IF NOT EXISTS idx_fighter_media_links_manual
  ON public.fighter_media_links(manual_fighter_id, category, sort_order);

DROP TRIGGER IF EXISTS trg_fighter_media_links_updated_at ON public.fighter_media_links;
CREATE TRIGGER trg_fighter_media_links_updated_at
BEFORE UPDATE ON public.fighter_media_links
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_fighter_media_link(
  target_fighter_id uuid,
  target_manual_fighter_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.profiles profile
      WHERE profile.id = auth.uid() AND profile.role = 'admin'
    )
    OR (
      target_fighter_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.fighters fighter
        WHERE fighter.id = target_fighter_id
          AND fighter.profile_id = auth.uid()
      )
    )
    OR (
      target_manual_fighter_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.manual_fighters fighter
        WHERE fighter.id = target_manual_fighter_id
          AND fighter.manager_id = auth.uid()
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_fighter_media_link(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_fighter_media_link(uuid, uuid)
  TO authenticated;

ALTER TABLE public.fighter_media_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fighter_media_links_select ON public.fighter_media_links;
CREATE POLICY fighter_media_links_select
ON public.fighter_media_links
FOR SELECT
USING (
  public.can_manage_fighter_media_link(fighter_id, manual_fighter_id)
  OR (
    fighter_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.public_fighters fighter
      WHERE fighter.id = fighter_media_links.fighter_id
    )
  )
  OR (
    manual_fighter_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.public_manual_fighters fighter
      WHERE fighter.id = fighter_media_links.manual_fighter_id
    )
  )
);

DROP POLICY IF EXISTS fighter_media_links_insert ON public.fighter_media_links;
CREATE POLICY fighter_media_links_insert
ON public.fighter_media_links
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_fighter_media_link(fighter_id, manual_fighter_id));

DROP POLICY IF EXISTS fighter_media_links_update ON public.fighter_media_links;
CREATE POLICY fighter_media_links_update
ON public.fighter_media_links
FOR UPDATE TO authenticated
USING (public.can_manage_fighter_media_link(fighter_id, manual_fighter_id))
WITH CHECK (public.can_manage_fighter_media_link(fighter_id, manual_fighter_id));

DROP POLICY IF EXISTS fighter_media_links_delete ON public.fighter_media_links;
CREATE POLICY fighter_media_links_delete
ON public.fighter_media_links
FOR DELETE TO authenticated
USING (public.can_manage_fighter_media_link(fighter_id, manual_fighter_id));

GRANT SELECT ON public.fighter_media_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fighter_media_links TO authenticated;

NOTIFY pgrst, 'reload schema';
