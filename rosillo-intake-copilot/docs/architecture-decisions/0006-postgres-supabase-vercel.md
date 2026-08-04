# ADR-0006: Postgres dialect — Supabase in production, PGlite for dev/tests

**Status:** accepted (supersedes ADR-0002)

## Context

The prototype moves to a hosted demonstration on Vercel. Vercel's serverless
filesystem is ephemeral, so the embedded SQLite file from ADR-0002 cannot hold
state there. ADR-0002 explicitly reserved this exit: portable SQL and all data
access behind the repository layer.

## Decision

Move the whole database layer to the **Postgres dialect** with two
interchangeable drivers behind one async repository API:

- **Production (Vercel): Supabase Postgres** via `node-postgres`, selected when
  `DATABASE_URL` is set. Serverless-friendly: the transaction-pooler connection
  string, a small pool, no prepared statements. Migrations are applied
  explicitly (`npm run db:migrate` with `DATABASE_URL` set) — never from a
  serverless cold start.
- **Local development and tests: PGlite** (in-process Postgres/WASM), persisted
  under `data/pgdata` or in-memory for tests. Real Postgres semantics — the
  plpgsql immutability triggers and CHECK constraints run identically — with
  zero setup and full offline support. Auto-migrates on open.

The immutability guarantees (analysis runs, append-only audit) are plpgsql
triggers in the migration, enforced by both drivers. The synthetic-only CHECK
constraint carries over unchanged. Authentication remains the prototype's
signed-cookie synthetic auth (ADR-0004) — Supabase is used as a Postgres host,
not as an identity provider, which keeps the auth surface unchanged until a
real IdP decision is made.

## Consequences

- One dialect everywhere: tests exercise the same SQL semantics as production.
- Repositories became async; better-sqlite3 was removed (also removing the
  native-module build headache on Vercel).
- PGlite is single-process: stop the dev server before `npm run db:seed`.
- The in-memory rate limiter remains per-instance on Vercel (documented in the
  threat model); a shared store is future work if the demo ever needs more
  than one region/instance.
