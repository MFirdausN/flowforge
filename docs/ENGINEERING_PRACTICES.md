# Engineering Practices

## Documentation Discipline

Whenever product behavior changes, update these together:

- `README.md` for setup, routes, and environment variables
- `docs/ARCHITECTURE.md` for system shape and module responsibilities
- `docs/QUERY_OPTIMIZATION.md` when core read patterns or indexes change
- `.env.example` when new environment variables are introduced

For this repository, documentation should stay aligned with the editorial/blog platform rather than the older workflow-orchestration description.

## Secret Handling

Rules for environment files:

- commit `.env.example`
- do not commit `.env`
- never place real API keys, JWT secrets, or database passwords in tracked Markdown examples
- if a secret is accidentally committed, rotate it immediately and remove it from history if needed

Recommended pattern:

```text
.env.example   tracked, placeholder values only
.env           local only, real secrets
```

## Docker-First Local Workflow

The repository is optimized for Docker-based local startup:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Use local non-Docker `npm run dev` only when you specifically need faster iteration or direct framework debugging.

## Change Checklist

When changing product behavior, verify:

- routes still build in Next.js
- backend compiles after Prisma or DTO changes
- Docker images still build
- public pages work for guests
- dashboard flows still work for authenticated users
- AI review gracefully degrades when `OPENAI_API_KEY` is missing

## Pull Request Guidance

Strong PRs in this repo should call out:

- user-facing changes
- API contract changes
- new environment variables
- migration files and deploy impact
- Docker changes
- verification commands actually run

Good examples:

- `feat: add public landing page and post detail routes`
- `feat: persist ai content review on posts`
- `fix: correct backend docker runtime entrypoint`
- `docs: sync readme and architecture with editorial platform`

Avoid vague commit messages like `fix stuff` or `update docs`.
