-- This project uses server-side Prisma and the tracker uses pg.
-- Neither application uses Supabase anon/authenticated roles for data access.
-- Keep postgres/service-role access; deny direct client access to business data.
-- Re-runnable, atomic, and contains no changes to stored business records.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $migration$
DECLARE relation record;
BEGIN
  FOR relation IN
    SELECT n.nspname, c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', relation.nspname, relation.relname);
  END LOOP;
END
$migration$;

-- Existing policies only authorize postgres. Table owners also bypass RLS.
-- Do not add permissive client policies or FORCE ROW LEVEL SECURITY.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
COMMIT;
