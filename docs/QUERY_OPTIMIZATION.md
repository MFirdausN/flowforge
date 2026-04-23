# Query Optimization

## Target Query

The run history endpoint powers the dashboard and is expected to be used frequently:

```sql
SELECT *
FROM workflow_runs
WHERE tenantId = $1
ORDER BY createdAt DESC
LIMIT 20 OFFSET 0;
```

This maps to `GET /runs?page=1&limit=20` and is tenant-scoped.

## Existing Index

The initial Prisma migration creates:

```sql
CREATE INDEX "workflow_runs_tenantId_createdAt_idx"
ON "workflow_runs"("tenantId", "createdAt");
```

This supports tenant filtering and chronological ordering. PostgreSQL can scan the index backward for `ORDER BY createdAt DESC`.

## Expected EXPLAIN Plan

Representative plan for a tenant with many runs:

```text
Limit  (cost=0.42..12.80 rows=20 width=...)
  ->  Index Scan Backward using workflow_runs_tenantId_createdAt_idx on workflow_runs
        (cost=0.42..18492.31 rows=29875 width=...)
        Index Cond: ("tenantId" = 'tenant-1'::text)
```

Why this is good:

- The database avoids scanning runs from other tenants.
- The database avoids an explicit sort because the index is ordered by `tenantId, createdAt`.
- The query can stop after the first page because of `LIMIT 20`.

## Additional Filter Optimization

The API also supports `status` and `workflowId` filtering. For high traffic, these indexes would be useful:

```sql
CREATE INDEX CONCURRENTLY workflow_runs_tenant_status_created_idx
ON workflow_runs ("tenantId", "status", "createdAt" DESC);

CREATE INDEX CONCURRENTLY workflow_runs_tenant_workflow_created_idx
ON workflow_runs ("tenantId", "workflowId", "createdAt" DESC);
```

These are not mandatory for the MVP, but they become valuable when tenants have many runs and dashboard filters are heavily used.

## Logs Strategy

Execution logs are currently stored in PostgreSQL:

```sql
CREATE INDEX "execution_logs_workflowRunId_createdAt_idx"
ON "execution_logs"("workflowRunId", "createdAt");
```

This is acceptable for MVP because:

- Logs are displayed per run or per step.
- Relational joins keep run detail implementation simple.
- Transactions keep run/step/log state consistent.

For high-volume production:

- Partition `execution_logs` by month or tenant.
- Add retention policies for old INFO logs.
- Stream logs to an append-only store such as Kafka, S3, ClickHouse, or OpenSearch.
- Keep PostgreSQL as the source of truth for run/step status, not raw high-volume logs.

## Migration Strategy

Current migrations are managed by Prisma and applied with:

```bash
npx prisma migrate deploy
```

Safe migration rules:

- Add nullable columns first, backfill separately, then make required later.
- Create large indexes with `CONCURRENTLY` in hand-written SQL migrations.
- Avoid destructive column drops in the same deploy that removes application usage.
- Keep rollback strategy as forward fixes, not manual database rewinds.

Example safe migration for a future webhook secret:

```sql
ALTER TABLE workflows ADD COLUMN "webhookSecretHash" TEXT;
```

Then deploy application code that writes the new column, backfill existing workflows, and only then enforce stricter validation.
