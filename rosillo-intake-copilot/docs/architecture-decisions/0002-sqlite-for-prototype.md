# ADR-0002: SQLite (Drizzle) for the prototype; PostgreSQL as the deployment target

**Status:** accepted (documented deviation from spec section 12)

## Context

The spec recommends PostgreSQL with Prisma or Drizzle. This prototype runs in disposable
development environments where a Postgres server is not reliably available, and the dataset is
small and fully synthetic.

## Decision

Use Drizzle ORM over `better-sqlite3` with hand-written SQL migrations. The schema uses only
portable SQL (text/integer/real columns, foreign keys, unique constraints), and all data access
goes through repository functions in `packages/database`, so swapping the Drizzle driver to
`drizzle-orm/node-postgres` is a contained change.

## Consequences

- Zero-dependency local development; `npm run db:migrate && npm run db:seed` is all it takes.
- Migrations are plain SQL files applied in order and recorded in a `_migrations` table.
- Postgres-specific features (row-level security, JSONB indexing) are deferred to a future
  integration phase, which the spec places after the synthetic prototype anyway.
