-- PostgreSQL privileges that bypass or administer table structure are never
-- required by browser clients. RLS does not protect TRUNCATE, so remove it
-- explicitly from Supabase API roles for all current and future public tables.

REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
