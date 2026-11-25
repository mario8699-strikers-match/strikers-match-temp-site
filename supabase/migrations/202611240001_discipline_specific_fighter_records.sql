-- Store one public W-L-D record per combat discipline without removing the
-- legacy aggregate columns used by existing matchmaking and event snapshots.

CREATE TABLE IF NOT EXISTS public.fighter_discipline_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_id uuid REFERENCES public.fighters(id) ON DELETE CASCADE,
  manual_fighter_id uuid REFERENCES public.manual_fighters(id) ON DELETE CASCADE,
  discipline text NOT NULL,
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws integer NOT NULL DEFAULT 0 CHECK (draws >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fighter_discipline_records_one_owner CHECK (
    num_nonnulls(fighter_id, manual_fighter_id) = 1
  ),
  CONSTRAINT fighter_discipline_records_discipline_present CHECK (
    NULLIF(btrim(discipline), '') IS NOT NULL
  ),
  CONSTRAINT fighter_discipline_records_fighter_unique UNIQUE (fighter_id, discipline),
  CONSTRAINT fighter_discipline_records_manual_unique UNIQUE (manual_fighter_id, discipline)
);

COMMENT ON TABLE public.fighter_discipline_records IS
  'Public win-loss-draw records separated by each discipline practiced by a platform or roster fighter.';

CREATE INDEX IF NOT EXISTS idx_fighter_discipline_records_fighter
  ON public.fighter_discipline_records(fighter_id);
CREATE INDEX IF NOT EXISTS idx_fighter_discipline_records_manual
  ON public.fighter_discipline_records(manual_fighter_id);

DROP TRIGGER IF EXISTS trg_fighter_discipline_records_updated_at
  ON public.fighter_discipline_records;
CREATE TRIGGER trg_fighter_discipline_records_updated_at
BEFORE UPDATE ON public.fighter_discipline_records
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Existing aggregate records become the primary discipline record. No legacy
-- result is discarded, and secondary disciplines begin at 0-0-0.
INSERT INTO public.fighter_discipline_records (
  fighter_id, discipline, wins, losses, draws
)
SELECT
  fighter.id,
  COALESCE(NULLIF(btrim(fighter.disciplines[1]), ''), 'General'),
  COALESCE(fighter.record_wins, 0),
  COALESCE(fighter.record_losses, 0),
  COALESCE(fighter.record_draws, 0)
FROM public.fighters fighter
ON CONFLICT (fighter_id, discipline) DO NOTHING;

INSERT INTO public.fighter_discipline_records (
  manual_fighter_id, discipline, wins, losses, draws
)
SELECT
  fighter.id,
  COALESCE(
    NULLIF(btrim(fighter.disciplines[1]), ''),
    NULLIF(btrim(fighter.discipline), ''),
    'General'
  ),
  COALESCE(fighter.record_wins, 0),
  COALESCE(fighter.record_losses, 0),
  COALESCE(fighter.record_draws, 0)
FROM public.manual_fighters fighter
ON CONFLICT (manual_fighter_id, discipline) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_manage_fighter_discipline_record(
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

REVOKE ALL ON FUNCTION public.can_manage_fighter_discipline_record(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_fighter_discipline_record(uuid, uuid) TO authenticated;

ALTER TABLE public.fighter_discipline_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fighter_discipline_records_select ON public.fighter_discipline_records;
CREATE POLICY fighter_discipline_records_select
ON public.fighter_discipline_records
FOR SELECT
USING (
  public.can_manage_fighter_discipline_record(fighter_id, manual_fighter_id)
  OR (
    fighter_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.public_fighters fighter
      WHERE fighter.id = fighter_discipline_records.fighter_id
    )
  )
  OR (
    manual_fighter_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.public_manual_fighters fighter
      WHERE fighter.id = fighter_discipline_records.manual_fighter_id
    )
  )
);

DROP POLICY IF EXISTS fighter_discipline_records_insert ON public.fighter_discipline_records;
CREATE POLICY fighter_discipline_records_insert
ON public.fighter_discipline_records
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_fighter_discipline_record(fighter_id, manual_fighter_id));

DROP POLICY IF EXISTS fighter_discipline_records_update ON public.fighter_discipline_records;
CREATE POLICY fighter_discipline_records_update
ON public.fighter_discipline_records
FOR UPDATE TO authenticated
USING (public.can_manage_fighter_discipline_record(fighter_id, manual_fighter_id))
WITH CHECK (public.can_manage_fighter_discipline_record(fighter_id, manual_fighter_id));

DROP POLICY IF EXISTS fighter_discipline_records_delete ON public.fighter_discipline_records;
CREATE POLICY fighter_discipline_records_delete
ON public.fighter_discipline_records
FOR DELETE TO authenticated
USING (public.can_manage_fighter_discipline_record(fighter_id, manual_fighter_id));

GRANT SELECT ON public.fighter_discipline_records TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fighter_discipline_records TO authenticated;

-- Preserve current consumers: the primary discipline's record continues to
-- mirror into record_wins / record_losses / record_draws.
CREATE OR REPLACE FUNCTION public.sync_primary_discipline_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_fighter uuid := COALESCE(NEW.fighter_id, OLD.fighter_id);
  target_manual uuid := COALESCE(NEW.manual_fighter_id, OLD.manual_fighter_id);
  primary_discipline text;
  selected_record record;
BEGIN
  IF target_fighter IS NOT NULL THEN
    SELECT NULLIF(btrim(fighter.disciplines[1]), '')
      INTO primary_discipline
    FROM public.fighters fighter
    WHERE fighter.id = target_fighter;

    SELECT record.wins, record.losses, record.draws
      INTO selected_record
    FROM public.fighter_discipline_records record
    WHERE record.fighter_id = target_fighter
    ORDER BY CASE
      WHEN lower(btrim(record.discipline)) = lower(COALESCE(primary_discipline, '')) THEN 0
      ELSE 1
    END, record.created_at
    LIMIT 1;

    UPDATE public.fighters
    SET record_wins = COALESCE(selected_record.wins, 0),
        record_losses = COALESCE(selected_record.losses, 0),
        record_draws = COALESCE(selected_record.draws, 0)
    WHERE id = target_fighter;
  ELSIF target_manual IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(btrim(fighter.disciplines[1]), ''),
      NULLIF(btrim(fighter.discipline), '')
    ) INTO primary_discipline
    FROM public.manual_fighters fighter
    WHERE fighter.id = target_manual;

    SELECT record.wins, record.losses, record.draws
      INTO selected_record
    FROM public.fighter_discipline_records record
    WHERE record.manual_fighter_id = target_manual
    ORDER BY CASE
      WHEN lower(btrim(record.discipline)) = lower(COALESCE(primary_discipline, '')) THEN 0
      ELSE 1
    END, record.created_at
    LIMIT 1;

    UPDATE public.manual_fighters
    SET record_wins = COALESCE(selected_record.wins, 0),
        record_losses = COALESCE(selected_record.losses, 0),
        record_draws = COALESCE(selected_record.draws, 0)
    WHERE id = target_manual;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_primary_discipline_record
  ON public.fighter_discipline_records;
CREATE TRIGGER trg_sync_primary_discipline_record
AFTER INSERT OR UPDATE OR DELETE ON public.fighter_discipline_records
FOR EACH ROW EXECUTE FUNCTION public.sync_primary_discipline_record();

REVOKE ALL ON FUNCTION public.sync_primary_discipline_record() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
