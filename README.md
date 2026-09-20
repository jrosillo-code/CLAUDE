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
| 0 | Supabase auth + Postgres/PostGIS + Storage | ✅ live when `NEXT_PUBLIC_SUPABASE_*` is set; the seeded demo otherwise |
| — | **Field brief** (`/fly`, `/fly/{cc}`, the brief panel): rules per country with source and date, light, weather, wind, nearest airfields, scout notes, field reports | ✅ 102 countries in three review tiers |
| — | **World lists** (`/world`, `/world/{list}`, the Top spots browser, map layers): ten curated lists of ~200 places | ✅ fetched on demand, public pages indexable |
| — | **Dispatches**: "I'm here now" pins as stories under the Me button, beacons at every zoom, a player that rolls from one traveler to the next | ✅ 72-hour TTL |
| — | **Recap & share cards**: boarding pass, Constellation video, flight film | ✅ |
| — | **Import**: photos (EXIF), typed places, Google Takeout | ✅ on device |
| — | **Trust**: private media behind signed URLs, block, report, delete account, export | ✅ migrations 0022–0023 |
| — | **Growth**: public profile preview, `/join/{handle}` invite links, share-card wordmark, sitemap | ✅ |
| v2 | Creator accounts (the panel ships; approval is manual, no email) | ⏳ |

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
  *verbatim* reflections migrations, and runs 30 assertions as a non-owner role (drafts
  owner-only, the private/friends/public matrix, impersonation and answer-planting
  rejected, citation counts visible to the author but never the citers, unfriending
  revocation, cascades). `npm run test:migrations` covers the layer beneath that: it applies
  **every** migration to an empty database in order, applies them all a second time to prove
  the chain is re-runnable (DEPLOY.md has you paste files by hand — losing track is the
  normal failure), then asserts over the catalog that every table the app queries exists and
  that **every** table in `public` has RLS enabled. That last check is deliberately not a
  hand-kept list: on Supabase the public schema is granted to `anon` by default, so a table
  that merely forgets to enable RLS is world-writable, and the omission is invisible in a
  diff. It found four such tables (`follows`, `posts`, `activities`, `pin_activities`),
  closed in `0017_close_rls_gaps.sql`. One level up, `npm run test:live` applies
  the **entire migration chain from an empty database** and drives the app's real
  `lib/backend.ts` through a **real PostgREST** with per-user JWTs — the same API server
  hosted Supabase runs — covering the full REST privacy matrix, unauthorized-write
  rejection, cascade behavior, and evidence freshness after reload. Architecture,
  provenance rules and the remaining manual-verification list live in
  [`docs/reflections.md`](docs/reflections.md) and
  [`docs/live-supabase-validation.md`](docs/live-supabase-validation.md).

  For user testing: a dismissible **Getting-started checklist** completes itself from real
  actions (view a debrief → ask → clone → debrief → reward), local no-text product events
  feed a facilitator funnel at `/funnel`, preview deployments show a persistent
  synthetic-data banner and are noindexed (`NEXT_PUBLIC_PREVIEW=1`), and startup env
  validation refuses to run with a service-role key in the public env. The five-person
  test plan is [`docs/reflections-user-test.md`](docs/reflections-user-test.md).

## The field brief (new)

For any place on the map and any date, one screen answers the traveling photographer's
four questions: **can I legally fly a drone and film here, when is the light good, what
will the wind do, and where have I or my friends shot before.** Three increments, each
usable on its own, all working keyless like the rest of Waypoint:

- **Country rules and public pages** — `lib/fieldbrief/rules/{cc}.json`, one curated file
  per country, bundled offline like the landmarks. A rule without a source and a date is
  not a rule: every file carries `sourceUrls[]`, `lastVerifiedOn` and `verifiedBy`, the UI
  never says "legal" — it says *as of {date}, per {source}* — anything older than 180 days
  renders with a stale warning, and `tests/fieldbrief-rules.test.ts` refuses files older
  than a year, unsourced, misnamed or unregistered. Waypoint never claims airspace
  authority (no LAANC, UTM or geofence checks); every page links to the national tool.
  `/fly` lists covered countries and `/fly/{cc}` is a server-rendered, **indexable** page
  per country — the market test for the feature. A country with no file says *not yet
  covered* and never fills the gap with model output. The rules folder carries 102
  countries in three review tiers — verified by a pilot, desk-reviewed from official
  sources, or an unverified summary — and every page says which (see
  `lib/fieldbrief/rules/README.md`).
- **The brief panel** — a *Field brief* button on the search card and on every pin opens
  `components/FieldBriefPanel.tsx` with a date picker: Rules (with source and date), Light
  (sunrise, sunset, golden and blue hours and the evening sun's bearing, computed offline in
  `lib/fieldbrief/light.ts`), Wind (Open-Meteo's keyless hourly forecast, cached an hour,
  four-second timeout, gust sparkline with calm windows under 30 km/h), and Nearby (scout
  pins and field reports from your circle). `POST /api/field-brief` assembles the evidence
  in code. With `ANTHROPIC_API_KEY` set, a short summary appears — but the model never
  writes displayed text: code composes every candidate sentence from the evidence and the
  model only chooses which ones to show, by index (`lib/fieldbrief/narrative.ts`). A
  prompt plus a banned-word filter cannot guarantee that generated prose is grounded; a
  selection over code-composed sentences can. Anything but a valid index array drops the
  summary and the cards stand. `tests/fieldbrief-brief.test.ts` and
  `tests/fieldbrief-api.test.ts` prove the path is skipped without a key, that prose from
  the model is never displayed, and that malformed picks are rejected. The 36 country
  summaries from the September 2026 desk review live in `lib/fieldbrief/rules/drafts/` as
  unloaded research drafts until a person promotes each one (that folder's README).
- **Scout pins and field reports** — an optional *Scout details* section on a pin
  (bearing, focal length, camera, drone, time of day, note) with its own marker glyph and
  a *Scout pins* toggle in the Layers card; visibility is the pin's, enforced by RLS in
  `0018_scout_notes.sql`. *Field reports* (`0019_field_reports.sql`) are first-hand
  accounts — flew / refused / fined / didn't try — stored **verbatim**, attributed, shown
  in the brief's Nearby card and on `/fly/{cc}` split into "flew" and "problems",
  disagreement side by side, never averaged. Reports are **private and draft by
  default** (`0020_field_reports_status.sql`): a draft is owner-only whatever its
  visibility, and only a published report reaches friends or the public. `npm run
  test:rls` applies all three migrations verbatim and runs 26 more assertions (the
  private/friends/public matrix, owner-only drafts, defaults, no impersonation, no
  anchoring to a stranger's pin, unfriending revokes, cascade on pin delete, anonymous
  readers see only published public reports). Local events `fly_page_view`,
  `brief_open` and `scout_pin_create` carry ids only.

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
2. **Run the migrations** `supabase/migrations/0001…0017` in order:
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
