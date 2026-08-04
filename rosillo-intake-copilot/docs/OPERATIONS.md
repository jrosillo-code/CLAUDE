# Operations guide (prototype)

## One-command setup

```bash
./scripts/setup.sh        # install → migrate → seed → typecheck → unit/security tests → build → e2e → evaluation
```

Each step fails fast with the failing command echoed. Individual steps:

| Command | Purpose |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run db:migrate` | Create/upgrade the SQLite schema |
| `npm run db:seed` | Wipe and reload the synthetic dataset (idempotent) |
| `npm run typecheck` | TypeScript across all four workspaces |
| `npm test` | Unit + integration + security suites (Vitest) |
| `npm run build` | Production build of the web app |
| `npm run test:e2e` | Playwright suite (needs the build; uses its own `data/e2e.db`) |
| `npm run evaluate` | Labelled synthetic evaluation with hard quality gates |
| `npm run audit` | `npm audit --omit=dev` dependency/vulnerability scan |

## Environment variables

Validated at startup (`apps/web/instrumentation.ts` → `lib/env.ts`); the app
refuses to boot with an actionable message when invalid.

| Variable | Default | Notes |
| --- | --- | --- |
| `DATA_CLASSIFICATION` | `SYNTHETIC` | Anything else aborts startup — this prototype never touches real data |
| `DATABASE_PATH` | `./data/rosillo.db` | Relative paths resolve against the monorepo root |
| `AUTH_SECRET` | dev fallback | Must be ≥16 random chars in production (enforced) |
| `AI_PROVIDER` | `mock` | `mock` or `anthropic` |
| `ANTHROPIC_API_KEY` | — | Required only when `AI_PROVIDER=anthropic`; server-side only |
| `ANTHROPIC_MODEL` | `claude-opus-5` | Model for the live provider |
| `ANALYSE_RATE_LIMIT` | `6` | Analyses per user per minute |
| `LOG_CONTENT` | unset | `1` logs message content (development debugging only) |

Any `NEXT_PUBLIC_*` variable whose name looks like a secret aborts startup.

## Logging

Structured JSON lines on stdout: `analysis.completed`, `analysis.rate_limited`,
`analysis.provider_unavailable`, `decision.recorded`, `decision.blocked`.
Fields carry identifiers, durations, and outcome codes — never message bodies,
drafts, or quotes unless `LOG_CONTENT=1`.

## Health and degraded mode

- `GET /api/health` → `200 {status:"ok"}` — liveness only.
- `GET /api/ready` → `200` when the DB is migrated and seeded; `503` with a
  per-check breakdown otherwise. Anthropic-without-key reports **degraded**:
  the case workspace still works, and analysis requests record a safe failed
  run (`PROVIDER_ERROR`) shown in the UI instead of crashing.
- Provider hangs end after the per-call timeout in the safe `PROVIDER_TIMEOUT`
  state; the case shows the failure and offers re-analysis.

## Database backup and reset

The whole state is one SQLite file (plus WAL side files):

```bash
# Backup (server stopped, or after a checkpoint)
sqlite3 data/rosillo.db "PRAGMA wal_checkpoint(TRUNCATE);"
cp data/rosillo.db backups/rosillo-$(date +%F).db

# Restore
cp backups/rosillo-2026-08-04.db data/rosillo.db && rm -f data/rosillo.db-wal data/rosillo.db-shm

# Full reset to the pristine synthetic dataset
rm -f data/rosillo.db data/rosillo.db-*
npm run db:migrate && npm run db:seed
```

`npm run db:seed` alone also resets all operational data (cases, runs,
decisions) — audit rows from previous sessions are removed with it because
the whole database is synthetic and disposable. The Playwright suite uses a
separate `data/e2e.db` and never touches the dev database.

## Dependency and vulnerability scanning

`npm run audit` runs `npm audit --omit=dev` (production dependency tree).
Record the output in the release notes; do not ship with unreviewed
high/critical findings. Full-tree scan: `npm audit`.
