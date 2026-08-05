# Live Supabase validation — status and runbook

Two layers of validation exist for the reflections backend:

1. **Machine-verified here, on every run of `npm run test:live`** — a real
   PostgreSQL + a real PostgREST (the API server hosted Supabase runs),
   full migration chain from empty, JWT-authenticated requests driving the
   app's actual `lib/backend.ts`.
2. **Hosted-project verification** — the parts only a real Supabase project
   provides (GoTrue login, Realtime delivery, Storage, Kong gateway).
   ⚠️ **Status: PENDING — requires a Supabase account/access token, which
   this development environment does not have.** The runbook below makes it
   a ~30-minute task. Update this file with results + screenshots when run.

---

## 1. What is already machine-verified (no hosted project needed)

`npm run test:live` (scripts/test-live-stack.sh + tests/live/) performs, on
a disposable cluster, with a real `postgrest` binary:

- **All migrations 0001→0014 apply cleanly, in order, from an empty
  database** — against stubs that mirror only what Supabase itself ships
  (auth/storage schemas, roles, `supabase_realtime` publication). Existing
  Waypoint migrations proved compatible (the chain includes them all).
- **Catalog assertions**: reflection tables, `visibility` enum usage,
  unique/check/FK constraints (`on delete set null` for pins, cascade from
  trips), both indexes, RLS enabled + all four policies, the signup and
  geog triggers, and publication membership for
  `trip_reflections` / `reflection_answers` / `trips`.
- **13 PostgREST tests** through real HTTP with per-user JWTs, driving
  `lib/backend.ts` itself (via a header-injecting proxy so the app's
  singleton acts as alice/bob/carol/anonymous):
  1. `loadWorld` reads the world incl. nested embeds (`trip_stops(*)`,
     `reflection_answers(*)`, `pin_likes(count)`) and the signup-trigger
     profiles.
  2. `syncSaveReflection` creates a draft + answers (write-through).
  3. Drafts invisible to friend, stranger, and anonymous callers.
  4. Partial progress + resume via a fresh `loadWorld`.
  5. Completing at friends visibility → friend sees it (via `loadWorld`),
     stranger doesn't.
  6. Private hides from everyone but the owner; public is world-readable
     and write-protected.
  7. Unauthorized writes rejected: anonymous insert 401/403, impersonated
     insert 403, answer-planting 403, cross-user PATCH/DELETE match 0 rows.
  8. Edits replace downstream evidence after reload — the friend's
     `loadWorld` → `askFriends` pipeline carries the new quote and not the
     old one.
  9. Unfriending immediately revokes access.
  10. `syncCompleteTrip` writes `completed_on`.
  11. Pin deletion detaches the answer (kept, anchor nulled).
  12. Trip deletion cascades the debrief + answers.
  13. `syncDeleteReflection` removes through the app's write path.

Plus `npm run test:rls` (24 SQL-level assertions) and 43 unit tests.

### Differences found: local harness vs hosted Supabase

Discovered while building the live harness — worth knowing before the
hosted pass:

- **PostgREST aggregates**: `loadWorld` embeds `pin_likes(count)`, which
  requires PostgREST's `db-aggregates-enabled = true`. The harness enables
  it explicitly; hosted Supabase has aggregates enabled on current
  platform versions. If a hosted project ever runs with them disabled,
  `loadWorld`'s pins query fails — check this first if pins don't load.
- **Write-through visibility lag**: `syncSaveReflection` upserts the
  reflection row, then replaces its answers. A reader can observe the
  moment between the two (reflection present, answers not yet). Harmless
  for the UI (next reload reconciles) but real — surfaced as a test flake
  until the poll accounted for it.
- **Realtime DELETE events**: Supabase does not RLS-filter `DELETE`
  payloads (they carry only the primary key). Our client never renders
  payloads — every event just triggers an RLS-scoped world reload — so the
  worst-case exposure is that *some row id was deleted*, no content. This
  is a Supabase platform property, documented, not fixable client-side.
- **auth.uid() shim**: the harness reads both `request.jwt.claim.sub` and
  `request.jwt.claims` GUC forms; hosted Supabase's own `auth.uid()` is
  authoritative there. No app code depends on the difference.

## 2. Hosted-project runbook (PENDING)

Prereqs: Supabase account, `supabase` CLI, the three synthetic accounts
from `docs/test-accounts.md`. Synthetic data only — never real users.

1. `supabase init` (if needed) → `supabase link --project-ref <ref>` →
   **`supabase db push`** — the normal workflow; all 14 migrations must
   apply cleanly from the empty project. Record the output here.
2. Set `.env`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (the app refuses a service-role key at startup — verify you see that
   refusal if you try it, then use the anon key), `NEXT_PUBLIC_PREVIEW=1`.
3. `npm run dev` (or the preview deployment). Sign up the three accounts.
   Auth flow through real GoTrue is itself under test here.
4. As Alice: two pins (Sintra 7/10, Ericeira 9/10), a two-stop trip, mark
   completed, run the debrief.
5. Walk the **two-browser privacy matrix** below with Alice and Bob in
   separate browser profiles and Carol in a third. Screenshot each ✔/✘
   cell into `docs/screenshots/privacy-matrix/` and fill the Result column.

| # | Step (actor) | Expected | Result |
|---|---|---|---|
| 1 | A creates a draft | Draft visible to A with resume state | ☐ |
| 2 | B and C reload | Neither sees any debrief content | ☐ |
| 3 | A completes as **private** | A sees it marked saved | ☐ |
| 4 | B and C reload | Still nothing | ☐ |
| 5 | A switches to **friends** | — | ☐ |
| 6 | B reloads | Sees quotes on A's trip card / place card / Ask — and no draft-only state | ☐ |
| 7 | C reloads | Nothing | ☐ |
| 8 | A switches to **public** | — | ☐ |
| 9 | C reloads | Reads it where public content is surfaced; **not** in C's trust surfaces (Ask/Don't-miss stay friend-only) | ☐ |
| 10 | A edits text + moves the anchor | — | ☐ |
| 11 | B reloads / receives realtime | New quote only; old wording gone everywhere | ☐ |
| 12 | A unfriends B | — | ☐ |
| 13 | B (realtime or reload) | All of A's friends-level evidence disappears | ☐ |
| 14 | A deletes the reflection | — | ☐ |
| 15 | B and C | No stale evidence in Ask, Don't-miss, trip cards, place cards | ☐ |

6. **Realtime checks** (needs the hosted Realtime service): with B's
   session open while A completes/edits/deletes — B's world updates within
   ~1–2 s (700 ms debounce + fetch) without manual reload; no duplicate
   cards appear (the reload replaces state wholesale); analytics events
   don't duplicate (session-deduped by `trackOnce`). The full refresh
   remains the authority; realtime is only the trigger (see
   `docs/reflections.md`).
7. Run `scripts/reset-synthetic.sql` against the project and confirm the
   guard + wipe behave.

## 3. Preview deployment (PENDING — needs a hosting account)

Target: Vercel (repo already carries `DEPLOY.md` basics). Requirements
implemented in-code and verified locally:

- Synthetic-data banner: shows whenever `NEXT_PUBLIC_PREVIEW=1` (and in
  keyless demo mode); collapsible per-session, never permanently.
- `NEXT_PUBLIC_PREVIEW=1` also sets `robots: noindex, nofollow, nocache`.
- Startup env validation (`lib/env.ts`): malformed URL or a service-role
  key in the public env **disables the backend** with a console
  explanation instead of shipping god-mode credentials.
- Debug logging (realtime breadcrumbs) is off in production builds unless
  `NEXT_PUBLIC_DEBUG=1`.
- UI error states are generic ("Couldn't write the guide", silent
  reconciliation) — database errors go to the console only.
- Test accounts documented outside the README (`docs/test-accounts.md`);
  reset procedure in `scripts/reset-synthetic.sql`.

Deploy steps: import repo in Vercel → set the three env vars above → set
deployment protection (password or team-only) → verify the banner, the
noindex header (`curl -sI <url> | grep -i x-robots`), signup, and one full
debrief round-trip. Record the URL and results here.
