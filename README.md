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

## Wiring the live Supabase backend

The app is written so the backend is a swap at one seam — `lib/store.ts`.

1. Create a Supabase project. Run the migrations:
   ```bash
   supabase db push          # or paste supabase/migrations/*.sql into the SQL editor
   ```
   This creates the schema, PostGIS indexes, and RLS policies.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).
3. Replace the seeded arrays in `lib/store.ts` with data fetched from Supabase, and back
   `addPin` / `reorderTop` with `insert`/`update` calls. The query helpers in `lib/data.ts`
   already encode the exact visibility logic that `0002_rls.sql` enforces on the server, so
   the client can trust the rows Postgres returns.
4. Point photo uploads at Supabase Storage (currently mocked with seeded imagery) and
   generate marker thumbnails on upload.

Because visibility lives in RLS, no client change can leak a private pin — the API returns
only rows the viewer is allowed to see.

## Not in v1 (by design)

Real-time / live location, passive GPS, DMs, native apps. See the plan for the v2 roadmap
(trips & journals, daily summaries, creator accounts, activity verticals).
