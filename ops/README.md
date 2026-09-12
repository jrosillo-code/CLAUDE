# Operaciones con IA para corredurías y asesorías

The company's app: website plus backend. The product is a chain: receive a document,
read it with provenance, validate it deterministically, flag what is missing, create the
task, draft the reply, and stop at a human approval before anything is sent or written to
the firm's management system. For brokerages there is a second chain: read an insurer's
commission settlement and reconcile it against the receipts the firm expected, producing
a euro figure and a task per unpaid line.

Everything runs keyless and without a database (demo readers, in-memory store), so the
whole flow can be exercised locally and in tests. With `ANTHROPIC_API_KEY` the readers use
Claude; with Supabase credentials the store persists.

```bash
npm install
npm run demo        # the whole chain in the terminal, keyless
npm run dev         # http://localhost:3100 (site) and /revisar (review queue)
npm test            # unit tests: validation, NIF, reconciliation, pipeline, intake
npm run test:rls    # boots a disposable PostgreSQL, applies the migration verbatim, asserts RLS
npm run typecheck
npm run fixtures    # writes the fixture PDFs to tests/fixtures/
npm run eval        # scores the reader on the fixtures; with ANTHROPIC_API_KEY it measures Claude
npm run onboard -- --name "Despacho" --kind correduria --email persona@despacho.es
```

## Using it as a firm

- Members sign in at `/login` with a magic link (Supabase Auth); `/app` lists their
  firms and `/app/{firmId}/revisar` is the reviewer's screen. Without Supabase configured
  the same screen runs at `/app/demo/revisar` with no login.
- On that screen a reviewer sees the original document next to every extracted field
  with the text it was read from, can correct a field (the correction is stored as the
  person's value, validation re-runs, closed items drop their tasks), edit the draft,
  approve or reject, and close tasks. The three metrics at the top are the ones the site
  promises: fields approved without correction, euros found in settlements, open work.
- Documents that arrive by webhook or upload are queued and drained right after the
  request completes, so processing starts within seconds without a cron. `POST
  /api/jobs/run` (from a cron, with `CRON_SECRET` or `OPS_API_KEY`) sweeps retries; the
  bundled schedule is daily, which the Vercel Hobby plan allows, and can be set to every
  minute on Pro. Transient model errors
  retry three times with backoff; anything else fails the document with the reason in
  the activity log.
- `/app/{firmId}/liquidaciones` is the settlements screen: every reconciled statement
  with tabular figures, the selected one line by line with a status pill each, and the
  claim. "Preparar reclamación" assembles a letter to the insurer from the unpaid and
  short-paid lines (no model call; every figure comes from the statement or the firm's
  receipts), stores it as a draft and puts it behind an approval. The only accent-colored
  action on the page is "Aprobar y enviar", and nothing reaches the insurer before it.
  The page also imports the expected receipts (CSV) and uploads a statement; in keyless
  mode one button loads the example statement so the flow can be tried.
- Sending happens only after approval, through SMTP (`SMTP_URL`, `MAIL_FROM`) or the
  WhatsApp Cloud API (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`). A failed send
  leaves the approval pending with the error logged; outside WhatsApp's 24-hour window the
  error says a template is needed.

## Measuring the reader

`lib/eval/` holds fixture documents with ground truth and a scorer. Every present value
must carry a quote that occurs in the document; a value whose quote is not in the document
counts as invented, and `npm run eval` exits non-zero if any are found. The bundled
fixtures mirror the demo reader's data so the harness passes trivially without a key;
replace them with anonymised documents from the pilot firm to get real numbers. The
scorer reports correct, wrong, missed and invented fields per fixture and overall.

## Design system

`DESIGN.md` is the design system in the DESIGN.md format (Google Stitch's plain-text
convention that AI agents read before generating UI): tokens in the front matter, then
colors and roles, typography, layout, components, do's and don'ts, responsive rules and
ready prompts. `app/globals.css` is the source of truth for values; DESIGN.md must match
it. `/diseno` renders the system from the real CSS so the two can be compared.
`design/references/` holds four DESIGN.md files from other products, copied from
VoltAgent's awesome-design-md collection, as inspiration only. `CLAUDE.md` tells any
coding agent to read DESIGN.md before touching UI.

Three ways to use it: prefix UI requests with "siguiendo DESIGN.md"; review a change by
checking `/diseno` and the do's and don'ts; hand DESIGN.md to a designer or a contractor
as the brief.

## Invariants the code enforces

1. **Nothing leaves the firm without a person.** Sending a message or writing to the
   management system happens only in `lib/approvals.ts`, after an `Approval` is decided.
   The pipeline ends at "awaiting approval". Tests assert the sender and adapter are
   untouched before a decision.
2. **A value without its quote is not a fact.** Every extracted field is
   `{ value, quote, page }`. `lib/validate.ts` treats a value without a quote as missing.
   The model is told to leave unknown fields null; the validator does not trust it.
3. **Every model call is budgeted and logged.** `lib/budget.ts` checks the firm's monthly
   token ceiling before each call; `lib/audit.ts` records model, prompt hash, tokens and
   estimated cost in an append-only activity log.
4. **The AI disclosure is appended by code**, not requested from the model
   (`withDisclosure` in `lib/claude.ts`). EU AI Act Article 50. Editing a draft keeps it.
5. **A correction is a person's value, never the document's.** `lib/corrections.ts`
   stores it with the quote "corregido por {user}" and records it in `corrections`.
6. **Tenancy is enforced in the database.** `supabase/migrations/0001_init.sql` puts RLS on
   every table; members read their firm, decide approvals only as themselves, and can
   append to but never change the activity log. `npm run test:rls` proves it against the
   verbatim migration.

## Layout

```
app/                    Next.js: public site (/, /corredurias, /asesorias, /precios, /seguridad, /contacto),
                        the app (/app/{firm}/revisar, /app/{firm}/liquidaciones); API routes under app/api
lib/types.ts            domain model
lib/schemas/            Zod schemas for documents and settlements (provenance-bearing fields)
lib/claude.ts           the only file that calls the model: extractor, settlement extractor, drafter
lib/validate.ts         deterministic rules per document kind; lib/nif.ts checks DNI, NIE, CIF
lib/reconcile.ts        settlement lines vs expected receipts; CSV import of receipts
lib/pipeline.ts         receive → extract → validate → tasks → draft → approvals
lib/settlements.ts      receive settlement → extract → reconcile → tasks
lib/claims.ts           claim letter assembled from the reconciliation lines, stored behind an approval
lib/leads.ts            website contact requests: validation, honeypot, storage, notification
lib/approvals.ts        the human step; the only path to send or write (effects run before the status flips)
lib/corrections.ts      a reviewer changes a field or the draft; re-validation; the accuracy signal
lib/jobs.ts             queue, claim, run with retries and backoff
lib/metrics.ts          the numbers on the review screen and the landing page
lib/auth.ts             member sessions from Supabase Auth cookies; RLS-scoped reads
lib/senders/            SMTP and WhatsApp Cloud API senders; RoutingSender in lib/sender.ts
lib/audit.ts, budget.ts activity log and monthly token ceiling
lib/store.ts            Store interface + MemoryStore; lib/supabase-store.ts for production
lib/adapters/           management-system boundary (CSV export now; ebroker, segElevia later)
lib/intake/             WhatsApp Cloud API webhook (signature, parse, media fetch) and inbound email
lib/demo.ts             keyless readers used without an API key and in tests
lib/runtime.ts          picks implementations from the environment; API auth
supabase/migrations/    schema + RLS; tests/rls/ harness and assertions
tests/                  node:test suites
```

## API

All routes except the provider webhooks accept either `Authorization: Bearer $OPS_API_KEY`
or a signed-in member's session cookie (checked against the firm). With neither Supabase
Auth nor a key configured they are open on localhost only. `firmId` defaults to the demo
firm.

| Route | What |
|---|---|
| `POST /api/intake/upload` | multipart `file`, optional `firmId`, `clientRef`; queues a job, or `process=1` runs the chain now |
| `GET /api/documents/{id}/file` | streams the original to a member of its firm |
| `POST /api/documents/{id}/correct` | `{field, value}` or `{field: "draft.body", value, draftId}` |
| `PATCH /api/tasks/{id}` | `{status: "open" \| "done"}` |
| `POST /api/jobs/run?limit=10` | drains due jobs; `CRON_SECRET` or `OPS_API_KEY` |
| `GET /api/metrics?firmId&from&to` | fields, euros, tasks, cost |
| `POST /api/documents/{id}/process` | run the chain on a received document |
| `POST /api/receipts/import` | multipart CSV (`aseguradora;poliza;recibo;tomador;prima;comision;periodo`), `insurer`, `period` |
| `POST /api/settlements/{id}/reconcile` | read a settlement document and reconcile it; JSON `{insurer?, period?}` |
| `POST /api/settlements/upload` | multipart `file`, `firmId`, `insurer?`, `period?`: receive and reconcile in one call; `example=1` in keyless mode loads the demo statement |
| `POST /api/settlements/{id}/claim` | `{to}`: assemble the claim letter for a reconciliation and put it behind an approval (id = reconciliation) |
| `POST /api/leads` | public contact form: JSON or form `name, email, message, phone?, firm?, kind?`; honeypot `website` |
| `GET /api/approvals` | pending approvals with their drafts |
| `POST /api/approvals/{id}` | `{decision: "approved" \| "rejected", note?}` |
| `GET /api/tasks`, `GET /api/activity` | open tasks; activity log and budget status |
| `GET,POST /api/intake/whatsapp` | Meta verification handshake; signed webhook |
| `POST /api/intake/email` | inbound-parse JSON with base64 attachments; `x-webhook-secret` |
| `GET /api/health` | mode: store and model |

## Verify the deployment

Open `https://<domain>/estado` (or `GET /api/selfcheck`). It checks, on the server, that
every variable is present, the database is reachable with all three migrations applied,
every table has RLS, the documents bucket is private, sign-in is configured and at least
one member exists, the Anthropic key and model are accepted, the API key is long enough,
and the cron secret is set. Secrets are never shown. From any machine,
`npm run smoke -- https://<domain>` probes health, self-check, login and the site.

## Going live

1. Create a Supabase project in an EU region, run the migrations in `supabase/migrations/` in order, and set
   the project URL (`NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` (server only).
2. Set `ANTHROPIC_API_KEY` and, optionally, `OPS_MODEL` (default `claude-opus-5`).
3. Set `OPS_API_KEY`, and the WhatsApp and email webhook secrets as needed.
4. Point the WhatsApp Cloud API webhook at `/api/intake/whatsapp?firmId=...` and the
   inbound email provider at `/api/intake/email?firmId=...`.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and the anon key (`ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for sign-in, add
   each user to `memberships`, and schedule `POST /api/jobs/run` every minute.
6. Set `SMTP_URL`/`MAIL_FROM` and the WhatsApp phone number id to send for real.

Contact details on the landing page are placeholders until the company entity exists.
