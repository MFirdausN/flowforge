# FlowForge Backend

NestJS API for the FlowForge workflow orchestration MVP.

## Commands

```bash
npm install
npm run lint
npx tsc --noEmit
npx jest --runInBand
npm run test:e2e
npm run build
npm run start:dev
```

## Environment

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flowforge
JWT_SECRET=flowforge-local-secret
PORT=3001
```

## Seed Users

```bash
npx prisma migrate deploy
npx prisma db seed
```

Demo credentials:

- `admin@tenant1.local / password123`
- `editor@tenant1.local / password123`
- `viewer@tenant1.local / password123`

## Important Endpoints

- `POST /auth/login`
- `GET /workflows`
- `POST /workflows`
- `POST /workflows/:id/rollback/:versionNo`
- `POST /execution/trigger/:workflowId`
- `POST /execution/webhook/:tenantSlug/:workflowId`
- `GET /execution/runs/:runId/events`
- `GET /runs`
- `GET /runs/:id`
- `GET /health/overview`
- `GET /ai/runs/:runId/failure-analysis`
- `GET /docs`

See the root `README.md` and `docs/` directory for the full submission documentation.
