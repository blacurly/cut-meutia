BEGIN;

-- Keep API users read-only on public tables until a feature has an explicit,
-- reviewed write path such as a narrowly scoped RPC.
REVOKE INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

-- Do not automatically grant write privileges on future postgres-owned tables.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES
  FROM anon, authenticated;

COMMIT;
