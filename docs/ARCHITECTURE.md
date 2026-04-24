# Architecture

## Overview

FlowForge now operates as a multi-tenant blog and editorial platform. It combines a public marketing and reading surface with an authenticated dashboard for authoring, moderation, publishing, and AI-assisted post review.

```text
Guest / Authenticated Reader
  |
  | HTTP
  v
Next.js Frontend
  |-- Public landing page
  |-- Public post detail
  |-- Auth flows
  |-- Editorial dashboard
  |
  | REST + JWT
  v
NestJS API
  |-- Auth / RBAC
  |-- Posts
  |-- Users
  |-- Tenants
  |-- AI review
  |-- API docs
  |-- Health
  |
  v
PostgreSQL

Redis is provisioned for future queueing, cache, and async worker expansion.
```

## Frontend Shape

Key user-facing routes:

- `/` public landing page with hero, intro, blog feed, contact section, and footer
- `/posts/[slug]` public published post detail
- `/dashboard` authenticated editorial workspace

The landing page remains visible even after login. Logged-in users can move between public reading and the dashboard instead of being forced directly into the admin workspace.

## Backend Modules

- `AuthModule`: registration, login, JWT issuance, tenant-aware payloads, and role enforcement
- `PostsModule`: create, edit, submit, publish, list, and read published content
- `UsersModule`: role assignment and tenant user management
- `TenantsModule`: tenant context and tenant-scoped ownership
- `AiModule`: run analysis plus post content review for SEO, plagiarism risk, and sensitive content
- `ApiDocsModule`: protected OpenAPI-style local documentation for admin users
- `HealthModule`: liveness and readiness style health endpoint

Legacy modules for workflows, runs, and execution still exist in the codebase, but the current active product experience is the editorial/blog platform.

## Role Model

| Capability | User | Editor | Admin |
| --- | --- | --- | --- |
| Register and login | Yes | Yes | Yes |
| Read published posts | Yes | Yes | Yes |
| Create draft | Yes | Yes | Yes |
| Submit for review | Yes | Yes | Yes |
| Publish directly | No | Yes | Yes |
| Review moderation queue | No | Yes | Yes |
| Manage users and roles | No | No | Yes |
| View protected API docs | No | No | Yes |

## Editorial Data Flow

1. A user opens the dashboard and creates or edits a post.
2. The frontend can call `POST /ai/posts/content-review` before save or update.
3. The backend evaluates the draft with OpenAI if configured.
4. If AI is unavailable, the backend falls back to local heuristics.
5. The returned review includes SEO, plagiarism risk, sensitive content risk, summary, and recommendation.
6. When the post is created or updated, the latest review result is stored in the post record.
7. Published posts appear in the public landing feed and on `/posts/[slug]`.

## Data Model

Important entities:

- `tenants`: tenant boundary
- `users`: tenant users with roles
- `posts`: editorial content with author, status, slug, and publication fields
- `post.contentReview`: JSON review payload containing AI or heuristic analysis
- `post.reviewCheckedAt`: last review timestamp

This lets the dashboard show persisted content quality metadata without rerunning checks on every read.

## Docker Runtime Layout

The repository uses Docker Compose for a reproducible local environment:

- `frontend` on host port `13000`
- `backend` on host port `13001`
- `postgres` on host port `15432`
- `redis` on host port `16379`

All ports are bound to `127.0.0.1` by default to reduce accidental LAN exposure during development.

## Security Notes

- JWT secures dashboard and management endpoints
- public blog endpoints expose published content only
- `.env` must remain local and should never be committed
- `.env.example` exists only for non-secret placeholders
- OpenAI keys are read from environment variables and should be rotated if ever exposed

## Operational Notes

- The current AI plagiarism review is heuristic and does not compare against the public web
- Redis is not yet heavily used by the editorial flow, but it is ready for queue-backed review or publishing jobs later
- The public blog feed currently reads all published posts rather than routing by public tenant slug
- Protected docs remain admin-only because they expose internal and management routes
