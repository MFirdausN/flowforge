# Engineering Practices

## Branch And Pull Request Evidence

The technical test asks for meaningful Git history and at least one self-authored pull request. The repository includes `.github/pull_request_template.md` so the submitted PR can clearly describe scope, validation, trade-offs, and review context.

Recommended final submission flow:

```bash
git checkout -b feat/flowforge-mvp-hardening
git add .
git commit -m "feat: harden flowforge mvp requirements"
git push origin feat/flowforge-mvp-hardening
```

Then open a pull request into `main` using the template. In the PR description, include:

- The core features implemented: DAG engine, auth/RBAC, multi-tenancy, workflow versioning, execution tracking, realtime SSE, docs, AI failure analysis.
- Validation commands and results.
- Known trade-offs: in-memory scheduler, in-memory SSE event bus, in-memory rate limiter, PostgreSQL logs for MVP.
- What would be improved next: distributed queues, Redis-backed rate limits/events, webhook signatures, sandboxed script execution.

## Commit Quality

Prefer small commits grouped by concern:

- `feat: add workflow dag validation and execution engine`
- `feat: add tenant-scoped workflow api and versioning`
- `feat: add run tracking and realtime sse events`
- `test: cover dag executor and api workflow run`
- `docs: add architecture and operational tradeoffs`

Avoid vague commit messages such as `update` for the final submitted history if there is time to clean it on a feature branch.
