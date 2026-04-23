# Architecture

## Overview

FlowForge is split into a NestJS API, PostgreSQL data layer, Redis-ready infrastructure, and a Next.js dashboard. The core backend treats every workflow definition as a directed acyclic graph and persists immutable versions before execution.

```text
Browser
  |
  | JWT + REST
  v
Next.js Dashboard
  |
  | REST API
  v
NestJS API
  |-- Auth/RBAC
  |-- Workflow CRUD + Versioning
  |-- DAG Validation
  |-- Execution Engine
  |-- Scheduler
  |-- Runs/Logs/Health APIs
  |
  v
PostgreSQL

Redis is included for future queue/worker scaling.
```

## Backend Modules

- `AuthModule`: login, bcrypt password validation, JWT creation, Passport JWT strategy.
- `WorkflowsModule`: tenant-scoped CRUD, version history, rollback, definition validation.
- `ExecutionModule`: manual/webhook execution, DAG utilities, step implementations, scheduled trigger service.
- `ExecutionModule`: also exposes an in-memory SSE event stream for run and step status updates.
- `RunsModule`: run history, run detail, step logs, pagination and filtering.
- `HealthModule`: liveness and tenant execution metrics for the last 24 hours.
- `ApiDocsModule`: admin-only local API documentation.
- `AiModule`: failure analysis for failed runs, using heuristic fallback and optional LLM integration.
- `RateLimitGuard`: in-memory per-user/per-route request limiting for frequently polled dashboard endpoints.

## Execution Flow

1. User or external webhook triggers a workflow.
2. API resolves workflow by `workflowId` and `tenantId` or webhook `tenantSlug`.
3. Latest workflow version is loaded.
4. Definition is validated as a DAG.
5. Engine computes dependency layers using in-degree tracking.
6. Steps in the same ready layer execute in parallel.
7. Condition nodes may route through boolean `condition` edges and mark non-matching downstream paths as `SKIPPED`.
8. Each step creates a `workflow_run_steps` record.
9. Retry/backoff is applied per node.
10. Logs are written to `execution_logs`.
11. Run finishes as `SUCCEEDED`, `FAILED`, or `TIMEOUT`.

## Multi-Tenant Isolation

Tenant isolation is enforced in application queries by always scoping workflow, run, step, and log reads/writes with `tenantId`. The JWT payload contains `tenantId`, `tenantSlug`, `sub`, `email`, and `role`.

Webhook execution uses `tenantSlug` plus `workflowId`, then executes with the resolved tenant id. A workflow id from another tenant will not be found because the executor uses both identifiers.

## RBAC Matrix

| Capability | Admin | Editor | Viewer |
| --- | --- | --- | --- |
| Login | Yes | Yes | Yes |
| List workflows | Yes | Yes | Yes |
| Create/update workflow | Yes | Yes | No |
| Rollback workflow | Yes | Yes | No |
| Delete workflow | Yes | No | No |
| Trigger workflow manually | Yes | Yes | No |
| View runs/logs/health | Yes | Yes | Yes |
| View API docs | Yes | No | No |

## Data Model

Key tables:

- `tenants`: tenant boundary.
- `users`: users belong to tenants and have a role.
- `workflows`: mutable workflow metadata and current version pointer.
- `workflow_versions`: immutable JSON DAG versions.
- `workflow_runs`: execution attempts tied to workflow and version.
- `workflow_run_steps`: per-step execution status and payloads.
- `execution_logs`: append-style step/run logs.

## Deployment Design

For production on AWS:

```text
Route 53
  |
CloudFront + ACM
  |
Application Load Balancer
  |
ECS Fargate Services
  |-- frontend service
  |-- api service
  |-- worker/scheduler service
  |
RDS PostgreSQL
ElastiCache Redis
CloudWatch Logs
Secrets Manager
```

Choices:

- ECS Fargate keeps ops lightweight while supporting independent API/frontend/worker scaling.
- RDS PostgreSQL provides backups, PITR, monitoring, and managed upgrades.
- ElastiCache Redis supports BullMQ queues and distributed scheduler locks.
- Secrets Manager stores `DATABASE_URL`, `JWT_SECRET`, webhook secrets, and LLM keys.
- CloudWatch centralizes application and execution logs.

## Operational Concerns

- API containers should be stateless.
- Scheduler should run as a single worker or use distributed locks.
- SSE uses an in-memory event bus in the MVP; production should back it with Redis Pub/Sub or another distributed event transport.
- Long-running executions should move to queue workers.
- Logs need retention and archival policy.
- All list endpoints should keep tenant-first indexes.
- Rate limiting is local to one API process in the MVP. Production should use Redis-backed counters so limits remain consistent across scaled API tasks.
- Webhooks should use HMAC signatures before production exposure.
- The MVP supports optional webhook HMAC validation through `WEBHOOK_SECRET` and `x-flowforge-signature`.
- AI analysis should avoid sending secrets or full payloads to external providers; current implementation truncates logs and falls back if provider output is malformed.
