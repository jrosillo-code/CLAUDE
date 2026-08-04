# Threat model — Rosillo Intake Copilot (synthetic prototype)

Scope: the M5 prototype as shipped in this repository. The system processes
**synthetic data only** and has **no external connectors** (no SMTP, no
segElevia, no insurer portals, no Gmail). The threat model still treats every
input as hostile, because the long-term purpose is to handle real customer
email.

## Assets

1. Integrity of employee decisions (nothing external may happen without one).
2. The append-only audit trail (analysis versions, decisions, events).
3. Synthetic-only guarantee (no real data may enter; nothing may leave).
4. Server-side secrets (AI provider key, auth secret).
5. Availability of the analysis pipeline for employees.

## Trust boundaries

| Boundary | Untrusted side | Trusted side | Enforcement |
| --- | --- | --- | --- |
| B1: Customer content | Email bodies, subjects, sender names, attachments (incl. future OCR text) | Pipeline, rules, UI | Content is data, never instructions: prompts state it, schemas bound it, React escapes it on render, deterministic rules override model proposals |
| B2: AI provider output | Everything a provider returns | Pipeline result | Zod validation with one repair retry then safe error; invented candidate ids discarded; out-of-catalogue actions replaced; `external_action_allowed` forced false; per-call timeout |
| B3: Browser → server | All HTTP requests, cookies, form data | Server actions, routes | HMAC-signed httpOnly session cookie; per-request role lookup; server-side RBAC on every page and action; Next.js server-action origin checking (CSRF); allowlisted filter values; rate limiting on analysis |
| B4: Application → database | Application queries | SQLite | Parameterised queries only (Drizzle); immutability triggers on analysis runs and audit events; `classification = 'SYNTHETIC'` CHECK constraint |
| B5: Server → outside world | — | — | No outbound connectors exist in the MVP. The only outbound call is the optional Anthropic API from the server; the key never reaches the browser |

## Threats and mitigations

| Threat | Mitigation | Verified by |
| --- | --- | --- |
| Prompt injection in email/attachment (B1) | Hard prompt rules; deterministic rules recompute missing-info and constrain actions; marketing-signal veto; catalogue-only actions | `tests/security/security.test.ts`, fixtures C-012/C-013/C-014/C-018, evaluation gate `prohibitedActionCompliance = 100%` |
| Stored XSS via customer content or forged AI output (B1/B2) | React auto-escaping; no `dangerouslySetInnerHTML` anywhere; drafts rendered in `<textarea>`; schema length caps | Playwright `security.spec.ts` (payloads in sender, subject, body, attachment name/content, summary, entity value, evidence quote, risk flag, draft) |
| Model hallucination presented as fact (B2) | Evidence grounding: EXPLICIT fields must cite verbatim quotes; unsupported-inference gate < 2%; INFERRED values badged amber and require confirmation; alignment UI refuses approximate highlighting | Evaluation metrics; `mockProvider` evidence tests; alignment code |
| Model recommends a prohibited action (B2) | Enumerated action catalogue per workflow; schema rejects unknown codes; pipeline fallback replaces out-of-catalogue codes; `externalActionAllowed` is a literal `false` in the schema | Pipeline tests; evaluation gate (hard fail); no-external-actions UI sweep |
| Session forgery / tampering (B3) | HMAC-SHA256 signed cookie (timing-safe compare), httpOnly, SameSite=Lax, 8h expiry; roles re-read from DB per request | Playwright `auth.spec.ts` tampered/malformed cookie tests |
| Vertical privilege escalation (B3) | `hasPermission` checks inside every server action and page; override reason only accepted from supervisors | Playwright `rbac.spec.ts` |
| Horizontal access to others' cases (B3) | `canViewCase` (operators: unassigned or own only) checked in pages and actions | Playwright `rbac.spec.ts` |
| CSRF on server actions (B3) | Next.js server actions only execute for same-origin POSTs with valid action ids (framework-level origin/host check); session cookie is SameSite=Lax | Playwright direct-invocation probe (no session → no mutation); framework guarantee documented here |
| SQL injection (B4) | All queries parameterised via Drizzle; filter values checked against enums before use | `tests/security` SQLi suite; Playwright filter probe |
| Path traversal via attachment references (B1) | Bare-filename allowlist in the fixture loader (rejects separators, `..`, encoded traversal) | `tests/security` traversal tests |
| Analysis abuse / cost amplification (B3) | Sliding-window rate limit per user on analyse + re-analyse (default 6/min, `ANALYSE_RATE_LIMIT`) | Unit tests (`hardening.test.ts`) |
| Provider outage or hang (B2) | Per-call timeout → `PROVIDER_TIMEOUT` safe state; provider construction failure records a failed run (degraded mode); `/api/ready` reports it | `hardening.test.ts`; readiness endpoint |
| Secret leakage to the browser | No `NEXT_PUBLIC_` secrets (startup validation rejects them); provider calls server-side only; bundle scan for keys/prompts/config | `tests/security` bundle scan; env validation |
| Sensitive data in logs | Structured logger redacts content keys unless `LOG_CONTENT=1`; spec forbids raw bodies in logs | Logger implementation; code review |
| Verbose errors leaking internals (B3) | Pipeline failure details truncated (≤500 chars); user-facing errors are curated Spanish messages; production error pages are generic | `tests/security`; Playwright error-page probe |
| Real data entering the prototype | `DATA_CLASSIFICATION=SYNTHETIC` startup guard; DB CHECK constraint on customers; fixtures must be marked SYNTHETIC; persistent UI banner | DB test; loader test; env validation |
| Audit tampering | SQLite triggers abort UPDATE/DELETE on audit events and UPDATE on analysis runs; no application code path exists | DB immutability tests |

## Accepted residual risks (prototype-appropriate)

- **Single-process rate limiting** — resets on restart and is per-instance. A
  shared store is needed for a multi-instance deployment.
- **Prototype authentication** — shared demo password, no MFA, no lockout
  (ADR-0004). Must be replaced by the corporate IdP before any pilot.
- **SQLite triggers protect the application layer**, not an attacker with
  filesystem access to the DB file. Host-level controls apply in deployment.
- **No antivirus/file-scanning** of attachments — the MVP only ingests
  fixture text stand-ins; a mailbox integration must add scanning (spec §13).
- **DoS beyond the analysis path** (e.g. request floods) is delegated to the
  reverse proxy in deployment (see DEPLOYMENT.md).

## Non-goals enforced by construction

There is no code path that sends email, writes to an ERP, calls an insurer
portal, executes a cancellation, or decides a claim — not merely disabled but
absent. `external_action_allowed` is the literal `false` type in the schema,
so a provider claiming otherwise fails validation into the safe error state.
