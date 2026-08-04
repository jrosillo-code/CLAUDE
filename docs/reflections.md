# Reflections (post-trip debriefs): architecture

The 60-second debrief turns a finished trip into structured, attributed,
privacy-scoped evidence. This document is the reference for its lifecycle,
privacy model, and how its data flows into the rest of the product.

## Lifecycle

```
trip.completedOn set ("Mark trip completed")
        │
        ▼
draft ──── answer/skip/edit questions ────► complete ──► (reopen ⇢ draft)
  │        (saved verbatim, per answer)        │
  │                                            ├─ visibility: private|friends|public
  └─ resumable any time; owner-only always     ├─ quoted in Ask / Don't-miss /
                                               │  trip cards / place cards
        delete ◄───────────────────────────────┘  (evidence disappears with it)
```

- **One debrief per (trip, user)** — `unique (trip_id, user_id)` in SQL,
  get-or-create in `startReflection`.
- **Adaptive questions** (`questionsForTrip`, max 5): a question is dropped
  when the graph already answers it — a route pin in the owner's Top 5 skips
  *favorite* and *return*; a 9+/10 route pin skips *favorite*. Skipped
  questions are simply absent everywhere downstream; they are never shown as
  "missing data".
- **Answers are verbatim**: each stores the question id, the prompt *as it
  was asked*, the user's exact text, an optional pin anchor (null = whole
  trip), an optional `yes|maybe|no` scale, and `source: "text" | "voice"`
  (voice is a future input path; the flow doesn't change).

## Visibility and RLS model

Client helpers (`visibleReflections`, `quotesFor`) and Postgres RLS
(migration `0013_reflections.sql`) implement the same rules; **RLS is the
authoritative boundary** — the client checks are UX, not security.

| State | Owner | Accepted friend | Stranger |
|---|---|---|---|
| draft (any visibility) | ✓ | ✗ | ✗ |
| complete + private | ✓ | ✗ | ✗ |
| complete + friends | ✓ | ✓ | ✗ |
| complete + public | ✓ | ✓ | ✓ (read only) |

Writes are owner-only in every state (`for all using/with check
user_id = auth.uid()`), including the answers table, which is gated through
its parent reflection. Unfriending revokes friends-level access immediately
(`are_friends` is evaluated per query).

**Verified automatically** by `npm run test:rls`: the script boots a
disposable local PostgreSQL cluster, installs only the real dependencies of
the migration (the `visibility` enum, minimal `users`/`friendships`/`pins`/
`trips`, the verbatim `are_friends`, and Supabase's GUC-based `auth.uid()`
shim), applies **the exact migration file**, and runs 24 assertions as a
non-owner `authenticated` role: the owner lifecycle, the visibility matrix,
draft privacy, impersonated inserts, answer-planting, cross-user
update/delete attempts, unfriending revocation, and cascade behavior.

## Evidence provenance

Debrief answers reach four surfaces, always quoted and attributed, never
paraphrased into fact:

1. **Ask your friends** (`askFriends`): quotes match by the question's
   tokens against the answer text, the anchored pin's place/country, or the
   trip's title/stops (stops borrow country words from pins at the same
   place, so a whole-trip answer inherits destination context). Quote cards
   show the author, the trip, the originating question, and the exact words.
   The optional AI narrative (`/api/ask-friends`) receives quotes with an
   explicit *quote-verbatim-never-reword* instruction — the model adds
   voice, not knowledge.
2. **Don't leave without** (`dontMissPicks`): a pin-anchored *don't miss* /
   *favorite* endorses its place even below the 8/10 rating bar, with the
   quote as the visible reason; a pin-anchored *skip* removes places whose
   only endorsement was a rating. Explicit beats implicit; explicit-vs-
   explicit keeps the positive, so contested places stay visible. Quote↔pin
   binding requires matching name **and** ≤25 km proximity — duplicate place
   names across the world can't cross-contaminate.
3. **Friend trip cards** (`DebriefQuotes`): up to two quotes collapsed
   (priority: don't-miss, skip, surprise, favorite, return), expandable to
   all; pin-anchored quotes fly the map to the pin.
4. **Place cards** (`SearchPlaceCard` → "What friends said"): quotes near
   the place (geography-matched, never name-matched), classified as
   endorsement / warning / neutral and shown **side by side — disagreement
   is displayed, never averaged into a consensus**.

Trust-surface rule: all four surfaces draw only from accepted friends and
followed creators. A stranger's `public` debrief is world-*readable* (RLS
allows it) but is deliberately excluded from trust-based answers — the
product's promise is "people you know", and mixing in strangers would
silently convert a trust surface into a review site.

## Edits, deletions, and downstream effects

- **Edit**: answers replace by question id; retrieval reads live state, so
  no stale quotes survive an edit (tested in `store-lifecycle.test.ts`).
- **Visibility change**: takes effect on the next retrieval call — i.e.
  immediately (tested).
- **Delete answer / debrief**: evidence disappears from Ask, Don't-miss and
  both card surfaces at once (tested).
- **Delete pin**: the answer survives, its anchor nulls (SQL
  `on delete set null`) — it degrades to a whole-trip answer.
- **Delete trip**: the debrief and its answers cascade away.

## The author's reward

Saving a debrief shows `rewardLines`: statements generated **only from what
was actually saved** and what retrieval actually does with it (a pin-anchored
tip promises Don't-miss + Ask exposure; a trip-level answer promises Ask via
the trip's stops; a private debrief promises privacy and nothing else).
A "helped N×" chip on the owner's trip card counts evidence events where
someone else consumed their words.

## Analytics without surveillance

`lib/analytics.ts` keeps a capped, local-only event log. The meta type has
**no free-text field** — reflection text cannot enter the log by
construction. Events: `debrief_started/resumed/completed`,
`reflection_expanded`, `reflection_ask_evidence`,
`reflection_dontmiss_evidence`, `reflection_place_evidence`,
`reflection_pin_nav`, `trip_cloned_with_debrief`.

## Remaining limitations / manual verification

- **The RLS harness proves the SQL policies, not the full Supabase stack.**
  PostgREST query shapes, Supabase Auth JWTs, storage, and realtime need one
  manual pass against a real project: `supabase db push` (0001→0013), two
  accounts in separate browsers, then walk the lifecycle and the visibility
  matrix. The client code paths involved (`loadWorld`, `syncSaveReflection`,
  `syncDeleteReflection`, `syncCompleteTrip`) follow the same patterns as
  the already-wired pins/trips syncs.
- **Realtime**: reflections are not yet in the `supabase_realtime`
  publication; a friend's new debrief appears on the next world reload, not
  live. Add the tables to migration 0012's publication when live updates
  matter.
- **Contribution counts are per-device**: the "helped N×" chip reads this
  browser's event log. Real cross-device counts need a server-side
  aggregate under the same no-text rule.
- **`trip_reflections.updated_at`** is written by the client on sync; a
  `before update` trigger would make it server-authoritative.
- **Question adaptivity is owner-graph-based** — it can't yet use the
  interview answers themselves (e.g. skip *return* when a previous debrief
  of the same destination answered it).
