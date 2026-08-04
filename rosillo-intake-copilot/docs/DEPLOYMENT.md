# Deployment guide

## Option A (recommended): Vercel + Supabase

Hosted demonstration with a persistent Postgres database. The prototype still
handles synthetic data only — the hard rules at the bottom of this page apply.

### 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
   Choose a strong database password and an EU region.
2. In the dashboard: **Connect → Connection string → Transaction pooler** and
   copy the URI (port `6543`, host `*.pooler.supabase.com`). Replace
   `[YOUR-PASSWORD]` with the database password.
3. From your laptop, apply the schema and the synthetic seed against Supabase:

   ```bash
   cd rosillo-intake-copilot
   DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres' npm run db:migrate
   DATABASE_URL='postgresql://...same...' npm run db:seed
   # expected: Synthetic seed complete (driver: postgres): { users: 5, ... cases: 19 }
   ```

Supabase is used **only as a Postgres host**. The prototype keeps its own
synthetic authentication (ADR-0004); do not enable Supabase Auth, Storage, or
Row Level Security for this demo — the app connects as the database owner
through the pooler.

### 2. Vercel (application)

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the
   GitHub repository (`jrosillo-code/CLAUDE`).
2. In the import screen:
   - **Root Directory**: `rosillo-intake-copilot/apps/web` (enable
     "Include source files outside of the Root Directory" if prompted —
     the app imports the workspace packages and fixtures).
   - **Framework**: Next.js (auto-detected).
3. **Environment Variables** (all environments):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the Supabase transaction-pooler URI from step 1 |
   | `AUTH_SECRET` | output of `openssl rand -hex 32` |
   | `DATA_CLASSIFICATION` | `SYNTHETIC` |
   | `AI_PROVIDER` | `mock` (or `anthropic` + `ANTHROPIC_API_KEY`) |

4. **Deploy**. Startup validation fails the boot loudly if anything above is
   missing or malformed, so a misconfigured deploy is obvious, not subtle.
5. Verify: `https://<your-app>.vercel.app/api/ready` → `{"status":"ready"}`,
   then log in as `ana@rosillo.test` / `demo` and confirm the red synthetic
   banner.

Deploying the PR branch: Vercel builds every branch automatically — the
preview URL for `claude/pdf-build-setup-kngtln` works before merging. After
merging PR #1, `main` becomes the production deployment.

### Access control

The demo password model (ADR-0004) is not a security boundary. Restrict who
can open the URL: Vercel **Deployment Protection** (Vercel Authentication on
previews, or Password Protection on paid plans), or share the preview URL
privately. The data is synthetic by construction, but the demo should still
not be world-browsable.

### Serverless notes

- Migrations never run from the serverless app — apply them from a laptop or
  CI (`DATABASE_URL=... npm run db:migrate`).
- The analysis rate limit is per serverless instance (documented residual risk
  in THREAT_MODEL.md) — acceptable for a demo audience.
- Resetting the hosted demo: `DATABASE_URL=... npm run db:seed` from anywhere.

## Option B: single private host (no external services)

Target: a single private host (VM or container) reachable only by the demo
audience (VPN or IP allowlist).

1. **Host**: Node.js 22+, 1 vCPU / 1 GB RAM is plenty. No inbound access from
   the internet; TLS terminated by a reverse proxy (Caddy/nginx) with basic
   flood protection.
2. **Code**: clone the repo, `cd rosillo-intake-copilot`.
3. **Environment** (e.g. systemd unit or `.env` next to the process manager):
   ```bash
   NODE_ENV=production
   DATA_CLASSIFICATION=SYNTHETIC
   AUTH_SECRET=<random 32+ chars>          # openssl rand -hex 32
   DATABASE_PATH=/var/lib/rosillo/pgdata   # embedded Postgres (PGlite); or set DATABASE_URL to a Postgres server
   AI_PROVIDER=mock                        # or anthropic + ANTHROPIC_API_KEY
   ```
4. **Build and seed**:
   ```bash
   npm ci
   npm run db:migrate && npm run db:seed
   npm run build
   ```
5. **Run**: `npx next start apps/web -p 3000` behind the proxy. Wire the proxy
   health check to `/api/ready`.
6. **Verify**: `curl localhost:3000/api/ready` → `status: "ready"`; log in as
   a synthetic user; confirm the red synthetic banner is visible.
7. **Backups**: nightly copy of the SQLite file (see OPERATIONS.md). Losing it
   only loses synthetic demo state.

## Hard rules for any deployment of this prototype

- `DATA_CLASSIFICATION` stays `SYNTHETIC` — the app refuses anything else.
- No mailbox, ERP, or insurer-portal credentials on the host. The only
  permitted outbound call is the optional Anthropic API.
- The demo password model (ADR-0004) means the URL must be network-restricted;
  do not rely on the login form as a security boundary.
- Keep `LOG_CONTENT` unset.

## Explicitly out of scope

Multi-instance scaling (the in-memory rate limiter is per-instance),
real identity provider integration, production data handling, and every
integration stage listed in spec §18 — all require the formal approvals
described in the spec before any work starts.
