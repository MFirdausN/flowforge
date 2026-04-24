# Query Optimization

## Current High-Read Query

The most important public read path is the landing page feed of published posts:

```sql
SELECT *
FROM posts
WHERE status = 'PUBLISHED'
ORDER BY publishedAt DESC
LIMIT 12;
```

This powers:

- `GET /posts/published`
- the landing page blog section
- logged-in users reading the same public feed

## Why This Query Matters

It is the first content query hit by:

- guests opening the landing page
- authenticated users returning to the public home
- search-engine and share-preview traffic hitting published content

Because it is public and repeated often, it should stay predictable and cheap.

## Recommended Index Shape

For the current product, the most useful index is:

```sql
CREATE INDEX CONCURRENTLY posts_status_publishedAt_idx
ON posts ("status", "publishedAt" DESC);
```

If the public blog later becomes tenant-scoped by URL, prefer:

```sql
CREATE INDEX CONCURRENTLY posts_tenant_status_publishedAt_idx
ON posts ("tenantId", "status", "publishedAt" DESC);
```

## Expected Plan

With a matching index, PostgreSQL should be able to avoid a full sort and scan the newest published rows directly:

```text
Limit
  -> Index Scan using posts_status_publishedAt_idx on posts
       Index Cond: (status = 'PUBLISHED')
```

This keeps the landing page fast even as draft and review-stage content grows.

## Slug Lookup Query

Public post detail uses a slug lookup:

```sql
SELECT *
FROM posts
WHERE slug = $1
  AND status = 'PUBLISHED'
LIMIT 1;
```

Recommended index:

```sql
CREATE UNIQUE INDEX CONCURRENTLY posts_slug_key
ON posts ("slug");
```

If slug uniqueness ever becomes tenant-local instead of global, switch to:

```sql
CREATE UNIQUE INDEX CONCURRENTLY posts_tenant_slug_key
ON posts ("tenantId", "slug");
```

## JSON Review Payload Trade-Off

`contentReview` is stored as JSON on the post record. That is useful because:

- the dashboard can render the last review quickly
- the app avoids rerunning AI checks for every page load
- schema evolution is easier while the review payload is still changing

Trade-off:

- JSON is great for readback, but weaker for analytics
- if you later need reporting such as average SEO score or high-risk moderation queues, consider extracting summary columns or a separate `post_reviews` table

## Migration Guidance

Current Prisma migrations should stay safe and additive:

- add nullable columns first
- backfill separately if needed
- add indexes in focused migrations
- prefer forward fixes over destructive rollback

Recent example in this repo:

- `contentReview JSONB`
- `reviewCheckedAt TIMESTAMP`

Those were added safely without breaking existing posts.
