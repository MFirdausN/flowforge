# FlowForge

FlowForge is a multi-tenant editorial platform with a public-facing blog, role-based dashboard, and AI-assisted post review. The current app supports guest reading, authenticated editorial workflows, Docker-first local setup, and content checks for SEO, plagiarism risk, and sensitive content before publishing.

## Stack

- Backend: NestJS, Prisma, PostgreSQL, JWT auth, role-based access control
- Frontend: Next.js 16, React, Tailwind CSS
- Infrastructure: Docker Compose, PostgreSQL, Redis
- AI: OpenAI-backed review with local heuristic fallback

## Current Product Scope

- Public landing page with header, hero, intro, blog feed, contact section, and footer
- Public post detail page at `/posts/[slug]`
- Guest and logged-in users can both read published posts from the landing page
- Role-based dashboard for `USER`, `EDITOR`, and `ADMIN`
- Editorial post workflow with draft, review, and publish states
- Admin-managed user and role controls
- Protected API docs at `/docs` for admins
- AI content review for SEO quality, plagiarism risk, and sensitive content risk
- AI review data saved on posts and shown inside the dashboard post editor/detail area

## Main Routes

Frontend:

- `/` public landing page
- `/posts/[slug]` public post detail
- `/dashboard` authenticated editorial workspace

Key backend endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /posts/published`
- `GET /posts/published/:slug`
- `POST /posts`
- `PATCH /posts/:id`
- `POST /ai/posts/content-review`
- `GET /docs`
- `GET /docs/openapi.json`

## Quick Start With Docker

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Services:

- Frontend: `http://127.0.0.1:13000`
- Backend API: `http://127.0.0.1:13001`
- Postgres: `127.0.0.1:15432`
- Redis: `127.0.0.1:16379`

All exposed ports are bound to `127.0.0.1` by default so they stay local to your machine.

To seed demo data after the stack is up:

```powershell
docker compose exec backend npx prisma db seed
```

## Environment Variables

Use `.env.example` as the template and keep your real secrets in `.env`.

Important values:

```env
JWT_SECRET=change-this-local-secret
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_API_URL=http://localhost:13001
FLOWFORGE_FRONTEND_PORT=13000
FLOWFORGE_BACKEND_PORT=13001
FLOWFORGE_POSTGRES_PORT=15432
FLOWFORGE_REDIS_PORT=16379
```

Secret handling:

- `.env` should stay local and must not be committed
- `.env.example` is safe to commit because it contains placeholders only
- if a secret was ever committed before, it should be rotated immediately even if the file is later ignored

## Local Development

For local development without Dockerized app containers, keep Postgres and Redis in Docker:

```powershell
docker compose up -d postgres redis
```

Backend:

```powershell
cd backend
npm install
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:15432/flowforge"
$env:JWT_SECRET="flowforge-local-secret"
$env:OPENAI_API_KEY=""
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Frontend:

```powershell
cd frontend
npm install
$env:NEXT_PUBLIC_API_URL="http://localhost:13001"
npm run dev
```

## AI Content Review

Before or during post creation/editing, the app can run AI review checks through:

```text
POST /ai/posts/content-review
```

The review currently returns:

- SEO score and notes
- plagiarism risk score and notes
- sensitive content risk score and notes
- summary and recommendation

If `OPENAI_API_KEY` is missing or the AI response fails validation, the backend falls back to deterministic local heuristics so the feature still works.

Important limitation:

- the plagiarism signal is a local similarity and repetition risk check, not a full internet-wide plagiarism scan

## Demo Accounts

- `admin@tenant1.local / password123`
- `editor@tenant1.local / password123`
- `user@tenant1.local / password123`

## Build And Verification

Backend:

```powershell
cd backend
npx prisma generate
npm run build
```

Frontend:

```powershell
cd frontend
npm run build
```

Docker:

```powershell
docker compose up --build -d backend frontend
docker compose ps
```

## Project Documents

- Architecture: `docs/ARCHITECTURE.md`
- Query optimization notes: `docs/QUERY_OPTIMIZATION.md`
- Engineering practices: `docs/ENGINEERING_PRACTICES.md`
- Review notes: `REVIEW.md`

## Current Trade-Offs

- Public feed currently reads all `PUBLISHED` posts rather than tenant-scoped public blogs
- AI plagiarism review is heuristic, not provider-backed web matching
- Redis is available in infrastructure, but the current content workflow is still mostly request/response driven
- API docs remain admin-protected because they expose operational and management endpoints

## Next Good Improvements

- add true multi-tenant public blog routing
- add richer media support for posts and landing page content
- add threshold enforcement before submit or publish when AI risk is high
- add healthchecks for every app service in Docker Compose
