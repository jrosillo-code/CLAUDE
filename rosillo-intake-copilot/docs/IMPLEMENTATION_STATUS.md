# Implementation status

Milestones per spec §16. Governing document:
`docs/Rosillo_Intake_Copilot_Claude_Code_Spec.pdf`.

| Milestone | Status | Evidence |
| --- | --- | --- |
| M0 Foundation | ✅ complete | Monorepo, ADR-0001..0004, lint/type/test tooling, seed command, README, synthetic banner |
| M1 Case workspace | ✅ complete | Inbox, case detail, synthetic customers/policies, attachments, status/assignment, append-only audit |
| M2 Deterministic analysis | ✅ complete | rules-v1 engine, candidate search, mock provider, Zod contracts, evidence model; fixture tests deterministic |
| M3 Live AI analysis | ✅ complete (harness); live run pending key | Anthropic provider + prompt registry + validation/repair + analysis versions + drafts; see "Live evaluation" below |
| M4 Human review | ✅ complete | Edit/approve/reject/escalate/re-analyse, feedback codes, override reasons, export preview, supervisor queue; every decision references its immutable run |
| M5 Evaluation & hardening | ✅ complete | 31 Playwright tests, 71 Vitest tests (incl. 13 security), metrics dashboard, threat model, ops/deployment docs, accessibility basics, no external-action capability |

## Verification snapshot (2026-08-04)

- `npm test` — 71/71 passing (unit, database, integration, security).
- `npm run test:e2e` — 31/31 passing against a fresh production build and a
  fresh seeded database.
- `npm run typecheck` — clean across all four workspaces.
- `npm run build` — clean production build.
- `npm run evaluate` (mock provider, 19 labelled cases incl. 7 adversarial):
  workflow accuracy 100%, schema validity 100%, missing-info recall 100%,
  top-1 customer/policy 100%, evidence grounding 100%, unsupported inference
  0%, prohibited-action compliance 100% — all gates met.

## Live Anthropic evaluation

The harness fully supports `AI_PROVIDER=anthropic` and reports, per run:
workflow accuracy, schema validity, missing-info recall, candidate top-1,
evidence grounding, unsupported inference rate, prohibited-action compliance,
repair-retry rate, fail-safe rate, latency per case, and token usage with an
estimated cost. **The live run has not been executed** because this
development environment has no `ANTHROPIC_API_KEY` (verified: the API rejects
unauthenticated calls). To run it, with synthetic data only:

```bash
AI_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... npm run evaluate
```

The deterministic gates are identical for both providers and are never
relaxed; a live run that violates any gate fails the command.

## Deployment

The database layer runs on the Postgres dialect (ADR-0006): Supabase Postgres
in production (Vercel), PGlite locally and in tests — same SQL, same triggers,
same constraints. Vercel + Supabase click-path: `docs/DEPLOYMENT.md`.

## Known limitations

- Prototype auth (ADR-0004); per-instance rate limiter on serverless.
- OCR deferred behind the extraction seam (ADR-0005).
- Accessibility: keyboard navigation, focus states, and semantic tables/forms
  are implemented; a full screen-reader audit is future work.
- Localization: Spanish-first UI; English architecture-ready but not built.
