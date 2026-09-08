\set ON_ERROR_STOP on

-- Syntax/schema smoke test for the production hardening migrations. All DDL is
-- rolled back, so this is safe to run against the linked project before apply.
BEGIN;
\ir ../migrations/202609070007_production_security_hardening.sql
\ir ../migrations/202609070008_workflow_state_guards.sql
\ir ../migrations/202609070009_least_privilege_grants.sql

DO $$
BEGIN
  IF to_regclass('public.public_profiles') IS NULL
    OR to_regclass('public.public_fighters') IS NULL
    OR to_regclass('public.public_manual_fighters') IS NULL THEN
    RAISE EXCEPTION 'Public projections were not created.';
  END IF;
  IF to_regprocedure('public.register_self_for_event(uuid,uuid)') IS NULL
    OR to_regprocedure('public.submit_event_registration_payment(uuid)') IS NULL
    OR to_regprocedure('public.confirm_event_registration_payment(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Registration RPCs were not created.';
  END IF;
END;
$$;

ROLLBACK;
