-- Run this against the local Postgres database after seeding data.
-- It demonstrates the tenant-first run history optimization used by GET /runs.

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM workflow_runs
WHERE "tenantId" = (
  SELECT id
  FROM tenants
  WHERE slug = 'tenant-one'
)
ORDER BY "createdAt" DESC
LIMIT 20;
