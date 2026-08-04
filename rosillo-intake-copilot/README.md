# Rosillo Intake Copilot

> **SYNTHETIC DATA ONLY.** This is an internal decision-support prototype. It contains no real
> customer data and must never receive any. It cannot send email, modify policies, submit
> insurer forms, or take any external action — by design, `external_action_allowed` is always
> `false`.

An internal web application that understands incoming (synthetic) customer communications and
attachments, classifies them into one of six insurance workflows, extracts structured data with
field-level evidence, matches customers and policies, identifies missing information with
versioned deterministic rules, recommends a constrained next action, drafts a Spanish response,
and records an auditable employee decision.

Governing specification: [`docs/Rosillo_Intake_Copilot_Claude_Code_Spec.pdf`](docs/Rosillo_Intake_Copilot_Claude_Code_Spec.pdf)
(source of truth — where code and spec differ, the safer interpretation wins).

## Quick start

```bash
npm install
cp .env.example .env
npm run db:migrate     # create the SQLite schema
npm run db:seed        # load synthetic customers, policies, and the 12 starter cases
npm run dev            # http://localhost:3000 — log in as any synthetic user
```

```bash
npm test               # unit + integration tests (deterministic, mock AI provider)
npm run typecheck
npm run evaluate       # run the labelled synthetic evaluation suite, writes a report
```

Default synthetic users (password `demo` for all — prototype-only auth, see ADR-0004):

| Email                 | Role       |
| --------------------- | ---------- |
| `ana@rosillo.test`    | operator   |
| `carlos@rosillo.test` | supervisor |
| `admin@rosillo.test`  | admin      |
| `eva@rosillo.test`    | evaluator  |

## Repository layout

```
rosillo-intake-copilot/
  apps/web/            Next.js application (inbox, case detail, evaluation, admin)
  packages/domain/     Types, Zod schemas, action catalogue, versioned missing-info rules,
                       deterministic candidate matching, the analysis pipeline
  packages/ai/         AIProvider interface, deterministic mock provider, Anthropic provider,
                       prompt registry, output validation/repair, evaluation harness
  packages/database/   SQLite (Drizzle) schema, migrations, repositories, seed scripts
  fixtures/            Synthetic emails, attachments, and expected labels (12 starter cases)
  docs/                Spec PDF and architecture decision records
  tests/integration/   Cross-package pipeline tests
```

## Safety boundaries (non-negotiable)

- Synthetic data only. Every fixture is marked `SYNTHETIC`; the app refuses records marked otherwise.
- No SMTP, no ERP writes, no insurer portal actions, no policy transactions, no claim decisions,
  no pricing/underwriting. There is no Send button anywhere.
- Email and attachment content is untrusted data: instructions inside documents are never followed.
- Every AI output is validated against a strict Zod schema; failures retry with repair
  instructions and then fall back to a safe error state.
- Every extracted fact is `EXPLICIT`, `INFERRED`, or `UNKNOWN` and links to evidence.
- Analysis runs are immutable; re-analysis creates a new version. Audit events are append-only.
- Model API keys live server-side only.

## Milestones

Built milestone-by-milestone per the spec (section 16): M0 foundation → M1 case workspace →
M2 deterministic analysis → M3 live AI analysis → M4 human review → M5 evaluation & hardening.
See `docs/architecture-decisions/` for the key choices and deviations.
