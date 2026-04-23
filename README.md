# FlowForge

FlowForge is a real-time oriented, multi-tenant workflow orchestration MVP built for the Sevima Software Engineer technical test. It lets tenants define workflow DAGs, version definitions, trigger executions, monitor run history, and inspect step-level logs.

## Stack

- Backend: NestJS, Prisma, PostgreSQL, JWT auth, role-based access control
- Frontend: Next.js, React, Tailwind CSS, SVG DAG visualization
- Infrastructure: Docker Compose, Postgres, Redis, GitHub Actions CI
- Tests: Jest unit tests, API e2e tests with Supertest

## Features

- JWT login with tenant-aware payloads
- Roles: `ADMIN`, `EDITOR`, `VIEWER`
- Workflow CRUD with version history and rollback
- DAG validation, cycle detection, and topological sorting
- Execution engine with dependency-aware parallel layers
- Retry with exponential backoff and global workflow timeout
- Step types: `http`, `delay`, `condition`, `script`
- Manual trigger, webhook trigger, and cron-based scheduled trigger
- Optional webhook HMAC validation with `WEBHOOK_SECRET`
- Run tracking, step tracking, and execution logs
- Server-Sent Events stream for realtime run and step status updates
- In-memory rate limiting for high-read dashboard endpoints
- Runs API with pagination and filtering
- Health overview for active runs, success/failure rates, and average duration
- AI failure analysis with heuristic fallback and optional LLM provider
- Admin-only local API documentation at `/docs`
- Frontend login, dashboard, workflow list, run history, run detail, and DAG visual

## Quick Start With Docker

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

The backend container runs `prisma migrate deploy` before starting the API. To seed demo users after containers are up:

```bash
docker compose exec backend npx prisma db seed
```

Demo accounts:

- `admin@tenant1.local / password123`
- `editor@tenant1.local / password123`
- `viewer@tenant1.local / password123`

## Local Development

Start infrastructure:

```bash
docker compose up postgres redis
```

Backend:

```bash
cd backend
npm install
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/flowforge"
$env:JWT_SECRET="flowforge-local-secret"
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
$env:NEXT_PUBLIC_API_URL="http://localhost:3001"
npm run dev
```

## API Docs

Login as admin and send the JWT as a Bearer token:

```bash
POST /auth/login
GET /docs
GET /docs/openapi.json
GET /ai/runs/:runId/failure-analysis
GET /execution/runs/:runId/events
```

The docs endpoint is intentionally protected with `ADMIN` role access because it exposes operational API information.

## Example Workflow Definition

```json
{
  "name": "Webhook sync",
  "timeout_ms": 30000,
  "schedule": {
    "cron": "*/5 * * * *"
  },
  "nodes": [
    {
      "id": "fetch",
      "name": "Fetch payload",
      "type": "http",
      "config": {
        "method": "GET",
        "url": "https://jsonplaceholder.typicode.com/users"
      },
      "retry": {
        "max_attempts": 3,
        "backoff_ms": 1000
      }
    },
    {
      "id": "wait",
      "name": "Wait",
      "type": "delay",
      "config": {
        "ms": 500
      }
    },
    {
      "id": "check",
      "name": "Check branch",
      "type": "condition",
      "config": {
        "value": true
      }
    },
    {
      "id": "calculate",
      "name": "Sandboxed script",
      "type": "script",
      "config": {
        "code": "result = input.count * 2;",
        "input": {
          "count": 21
        },
        "timeout_ms": 1000
      }
    }
  ],
  "edges": [
    { "from": "fetch", "to": "wait" },
    { "from": "wait", "to": "check" },
    { "from": "check", "to": "calculate", "condition": true }
  ]
}
```

## Test And Build

Backend:

```bash
cd backend
npm run lint
npx tsc --noEmit
npx jest --runInBand
npm run test:e2e
npm run build
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

CI runs the same checks and Docker image builds in `.github/workflows/ci.yml`.

## Project Documents

- Architecture: `docs/ARCHITECTURE.md`
- Query optimization and EXPLAIN plan: `docs/QUERY_OPTIMIZATION.md`
- Engineering practices and PR guidance: `docs/ENGINEERING_PRACTICES.md`
- Code review exercise: `REVIEW.md`

## Trade-Offs

- The scheduler is in-memory and checks active workflows every minute. Production should move this to a queue worker with distributed locking.
- Execution logs currently live in PostgreSQL for query simplicity. At larger scale, logs should be partitioned or moved to an append-only log store.
- The backend exposes SSE for run events and the frontend consumes it from run detail. The MVP event bus is still in-memory, so production should move it to Redis Pub/Sub or a queue-backed event transport.
- The OpenAPI-like docs are hand-authored to avoid adding Swagger dependencies late in the MVP.
- AI failure analysis works without an API key using deterministic heuristics. If `OPENAI_API_KEY` is present, it sends a bounded run context to an LLM and falls back to heuristics when output is malformed or the provider is unavailable.
- Lint keeps unsafe `any` rules as warnings because JWT payloads and Prisma-heavy tests still need stronger typing.

## What I Would Improve With More Time

- Add distributed SSE/WebSocket fan-out for multi-instance deployments
- Add visual workflow builder and create/edit workflow UI
- Add Redis-backed queues for execution workers
- Add richer branch expressions beyond boolean condition edges
- Add partitioning or archival policy for high-volume logs
