# Waypoint

A social app where a **world map is the interface**. Friends appear as photo-pins on the
places they've been; your profile is anchored by a rated **Top 5 destinations** list.

Original build plan: [PLAN.md.pdf](https://github.com/user-attachments/files/30248134/PLAN.md.pdf)

> Core hook (v1): friends' maps & pins. This build implements that loop end-to-end on a
> seeded in-memory data layer, with the real Postgres/PostGIS schema + RLS committed so the
> live Supabase backend is a drop-in swap.

<br>

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

No keys required — the demo ships with seeded travelers, pins, and Top 5 lists, and uses
free OpenFreeMap tiles. Open the app and you're on a globe that zooms to fit your pins.

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

## What's in this build

Mapped to the plan's build phases (§7):

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Full-screen MapLibre **globe**, smooth globe→street zoom, editorial UI | ✅ |
| 2 | Pins as circular **photo markers**, `supercluster` clustering, pin-detail sheet, add-pin flow (map tap + place search), visibility field | ✅ (photo upload mocked) |
| 3 | Per-friend colors, **Everyone** overlay, layer rail (Me / friends / Everyone), visibility rules | ✅ (rules in `lib/data.ts`, mirrored by RLS) |
| 4 | Profile with drag-to-rank **Top 5 destinations**, countries/pins stats | ✅ |
| 5 | PWA manifest, empty-state escape hatches, seed/demo data | ✅ (public share-link SSR: designed, see below) |
| 0 | Supabase auth + Postgres/PostGIS + Storage | ⏳ schema & RLS written; wiring needs a Supabase project |

**Try:** drop a pin with the **+** button (map tap → reverse-geocoded → form); toggle
friends on the left rail; open a pin to see "who's also been here"; open a profile and drag
the Top 5 to re-rank.

## The trust-graph layer (new)

Three features that compound the one dataset generic AI planners don't have — what the
people you actually know thought (see `docs/idea-research-2026-08.md` for the market
research behind them):

- **Ask your friends** — type a question into the search bar ("Who's been to Japan?",
  "Where do my friends surf?") and pick *Ask your friends*. Answers are built **only**
  from your circle's pins, ratings, Top 5s and trips — every claim is a tappable card that
  jumps to the friend's actual pin. Deterministic retrieval works keyless
  (`lib/askFriends.ts`); with `ANTHROPIC_API_KEY` set, `/api/ask-friends` has Claude
  rewrite the same evidence in a warmer voice (facts never come from the model).
- **Don't leave without…** — search a place and the trust card now ends with up to
  **three** friend-endorsed spots in day-trip range you haven't been to (Top-5 entries or
  8+/10 ratings only), each with the friend's own words as the reason (`lib/regret.ts`).
  Honest by design: no fake urgency, and when you've already covered the area it says so.
- **Clone trip** — any friend's trip in the Trips panel has a *Clone trip* button: their
  stops become your editable draft ("Leo's Coast chase"), ready to tweak and save. The
  honest version of "turn a Reel into an itinerary" — your source is someone you trust.
- **The 60-second debrief** — mark a trip completed (Trips panel) and a short post-trip
  interview opens: at most five questions, one per screen, resumable, done in under a
  minute. Questions are **adaptive** (`lib/interview.ts`): anything the graph already
  knows is never asked — a Top-5 pin on the route skips "what was your favorite?" and
  "would you return?". Each answer can anchor to a specific pin or the whole trip, is
  stored **verbatim** with the question as asked, and carries its own visibility
  (private / friends / public — drafts are always owner-only, enforced by RLS in
  `supabase/migrations/0013_reflections.sql`). Answers then feed the rest of the layer as
  quoted, attributed evidence: Ask-your-friends surfaces them as quote cards ("Frida,
  after 'Silver Coast run': …"), and Don't-miss treats a pin-anchored *don't miss* as an
  endorsement (even below the rating bar) and a pin-anchored *skip* as a demotion — an
  explicit skip beats an implicit rating, but never silently hides an explicitly
  endorsed place. Nothing is ever paraphrased into fact: the words shown are the words
  saved. Text input today; every answer records `source: "text" | "voice"` and capture
  goes through one input component, so voice transcription drops in without changing the
  flow. Run the tests with `npm test`.

  Debriefs are also **visible where decisions happen**: a completed friend trip card shows
  up to two collapsed quotes (don't-miss and skip first, expandable, pin-anchored quotes fly
  the map), and searching a place shows **What friends said** — verbatim quotes split into
  endorsements / warnings / observations, disagreement displayed side by side, never
  averaged into a consensus. Saving a debrief shows the author exactly where those answers
  can now surface (derived from the real anchors — a private debrief promises privacy, not
  reach), and a "helped N×" chip counts when their words did work for a friend. Product
  events are local-only and carry ids, never reflection text (`lib/analytics.ts`).

  The privacy model is enforced twice: client helpers for UX, **Postgres RLS as the
  authority**. `npm run test:rls` boots a disposable local PostgreSQL cluster, applies the
  *verbatim* reflections migration, and runs 24 assertions as a non-owner role (drafts
  owner-only, the private/friends/public matrix, impersonation and answer-planting
  rejected, unfriending revocation, cascades). Architecture, provenance rules and the
  remaining manual-verification list live in [`docs/reflections.md`](docs/reflections.md).

## Architecture

```
app/
  page.tsx              the map — the home screen
  u/[handle]/           profile + Top 5
  api/pins/route.ts     GET /api/pins?bbox&zoom&viewer — the plan's core query, server-side
components/             MapCanvas (MapLibre + supercluster), sheets, rails, Top 5
lib/
  types.ts              domain model (mirrors the SQL schema)
  seed.ts               demo travelers, pins, friendships, Top 5
  data.ts               visibility rules + queries (the same logic RLS enforces)
  store.ts              Zustand — single source of truth (swap seed → Supabase here)
  geocode.ts            Nominatim behind a swappable interface
  mapStyle.ts           tile style via NEXT_PUBLIC_MAP_STYLE, with offline fallback
supabase/migrations/
  0001_init.sql         Postgres + PostGIS schema (v1 tables + v2 hooks)
  0002_rls.sql          row-level security — visibility enforced in SQL, never client-side
```

Design intent: **the photos are the product, chrome stays minimal** — a muted basemap,
warm paper UI, one travel-ink accent, serif display type.

## Going live with Supabase (fully wired — just add keys)

The integration is already written: `lib/supabase.ts` (client), `lib/backend.ts` (data
layer), and write-through hooks in `lib/store.ts`. Without env keys the app runs the
seeded in-memory demo; with them, auth + data + storage are live. To turn it on:

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is fine).
2. **Run the migrations** `supabase/migrations/0001…0011` in order:
   ```bash
   supabase link --project-ref <your-ref> && supabase db push
   ```
   or paste each file into the dashboard's SQL editor. This creates the schema,
   PostGIS + RLS, the auto-profile-on-signup trigger, and the `avatars` /
   `pin-media` storage buckets.
3. **Set env** in `.env` (and in Vercel for deploys):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
4. **Auth providers**: email magic-link works out of the box. For the Apple/Google
   buttons, enable those providers in Dashboard → Authentication → Providers (each
   needs its own developer credentials); until then the login screen falls back to
   email with a friendly notice.
5. Restart `npm run dev`, sign in with a real email, and you have a live account:
   pins/trips/likes/friends persist, avatars and pin media upload to Storage, and a
   second account in another browser sees exactly what RLS allows it to see.

Because visibility lives in RLS, no client change can leak a private pin — the API returns
only rows the viewer is allowed to see. Client mutations are optimistic; failures log to
the console and the next full load reconciles.

## Not in v1 (by design)

Real-time / live location, passive GPS, DMs, native apps. See the plan for the v2 roadmap
(trips & journals, daily summaries, creator accounts, activity verticals).
