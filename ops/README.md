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
```

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
   (`withDisclosure` in `lib/claude.ts`). EU AI Act Article 50.
5. **Tenancy is enforced in the database.** `supabase/migrations/0001_init.sql` puts RLS on
   every table; members read their firm, decide approvals only as themselves, and can
   append to but never change the activity log. `npm run test:rls` proves it against the
   verbatim migration.

## Layout

```
app/                    Next.js: landing page (/) and review queue (/revisar); API routes under app/api
lib/types.ts            domain model
lib/schemas/            Zod schemas for documents and settlements (provenance-bearing fields)
lib/claude.ts           the only file that calls the model: extractor, settlement extractor, drafter
lib/validate.ts         deterministic rules per document kind; lib/nif.ts checks DNI, NIE, CIF
lib/reconcile.ts        settlement lines vs expected receipts; CSV import of receipts
lib/pipeline.ts         receive → extract → validate → tasks → draft → approvals
lib/settlements.ts      receive settlement → extract → reconcile → tasks
lib/approvals.ts        the human step; the only path to send or write
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

All routes except the provider webhooks require `Authorization: Bearer $OPS_API_KEY`
(open on localhost when the key is unset). `firmId` defaults to the demo firm.

| Route | What |
|---|---|
| `POST /api/intake/upload` | multipart `file`, optional `firmId`, `clientRef`, `process=1` to run the chain now |
| `POST /api/documents/{id}/process` | run the chain on a received document |
| `POST /api/receipts/import` | multipart CSV (`aseguradora;poliza;recibo;tomador;prima;comision;periodo`), `insurer`, `period` |
| `POST /api/settlements/{id}/reconcile` | read a settlement document and reconcile it; JSON `{insurer?, period?}` |
| `GET /api/approvals` | pending approvals with their drafts |
| `POST /api/approvals/{id}` | `{decision: "approved" \| "rejected", note?}` |
| `GET /api/tasks`, `GET /api/activity` | open tasks; activity log and budget status |
| `GET,POST /api/intake/whatsapp` | Meta verification handshake; signed webhook |
| `POST /api/intake/email` | inbound-parse JSON with base64 attachments; `x-webhook-secret` |
| `GET /api/health` | mode: store and model |

## Going live

1. Create a Supabase project, run `supabase/migrations/0001_init.sql`, and set
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server only).
2. Set `ANTHROPIC_API_KEY` and, optionally, `OPS_MODEL` (default `claude-opus-5`).
3. Set `OPS_API_KEY`, and the WhatsApp and email webhook secrets as needed.
4. Point the WhatsApp Cloud API webhook at `/api/intake/whatsapp?firmId=...` and the
   inbound email provider at `/api/intake/email?firmId=...`.
5. The review queue at `/revisar` reads the demo firm today; put it behind the firm's
   Supabase login and member session before exposing it.

Contact details on the landing page are placeholders until the company entity exists.
