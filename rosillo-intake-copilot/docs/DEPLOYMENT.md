# Deployment guide — private demonstration environment

Target: a single private host (VM or container) reachable only by the demo
audience (VPN or IP allowlist). This prototype must never be exposed publicly
and must never receive real customer data.

## Checklist

1. **Host**: Node.js 22+, 1 vCPU / 1 GB RAM is plenty. No inbound access from
   the internet; TLS terminated by a reverse proxy (Caddy/nginx) with basic
   flood protection.
2. **Code**: clone the repo, `cd rosillo-intake-copilot`.
3. **Environment** (e.g. systemd unit or `.env` next to the process manager):
   ```bash
   NODE_ENV=production
   DATA_CLASSIFICATION=SYNTHETIC
   AUTH_SECRET=<random 32+ chars>          # openssl rand -hex 32
   DATABASE_PATH=/var/lib/rosillo/rosillo.db
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

Multi-instance scaling (in-memory rate limiter and SQLite are single-node),
real identity provider integration, production data handling, and every
integration stage listed in spec §18 — all require the formal approvals
described in the spec before any work starts.
