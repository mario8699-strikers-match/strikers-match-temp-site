BEGIN;

ALTER TABLE studio.production_sessions
  DROP CONSTRAINT IF EXISTS production_sessions_active_bout_id_fkey;

ALTER TABLE studio.production_sessions
  ADD CONSTRAINT production_sessions_active_bout_id_fkey
    FOREIGN KEY (active_bout_id) REFERENCES public.bouts(id) ON DELETE SET NULL;

COMMIT;
