# Instructions for coding agents working in `ops/`

This is the company's app: website plus backend for AI document operations in Spanish
insurance brokerages and accounting firms. Read `README.md` for the architecture and
`DESIGN.md` before creating or changing anything a person sees.

## Before touching UI

1. Read `DESIGN.md`. Use its tokens and components; `app/globals.css` is the source of
   truth for values and DESIGN.md must match it. If you add a token, add it to both.
2. `design/references/` holds four DESIGN.md files from other products for inspiration
   only. Never copy their palettes, type or copy patterns into this product.
3. Check `/diseno` after a UI change: it renders the system from the real CSS.
4. Spanish copy in tú, professional vocabulary, headings as statements with a period.

## Invariants that must survive every change

- Nothing is sent or written to a management system except through `decide()` in
  `lib/approvals.ts` after a person approves. Effects run before the status flips; a
  failed effect keeps the approval pending.
- An extracted value without its quote is not a fact (`present()` in `lib/validate.ts`).
  A correction is stored as the person's value, never as the document's.
- The AI disclosure is appended by code (`withDisclosure`), never requested from the model.
- Every model call is budgeted (`lib/budget.ts`) and logged with usage (`lib/audit.ts`).
- Row-level security on every table; `npm run test:rls` must pass after any migration.

## Before committing

```bash
npm run typecheck && npm test && npm run test:rls && npx next build
```

Run `npm run eval` too when `lib/claude.ts`, the schemas or the demo reader change.
Commit messages say what changed and why, in plain language. No model identifiers in
commits or code comments.
