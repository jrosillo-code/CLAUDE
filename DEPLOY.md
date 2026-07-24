# Waypoint — beta launch guide

Twenty minutes, two free accounts, zero code changes. At the end you have a
public website AND the installable phone app (they're the same deploy — the
site is a PWA; phones install it from the browser).

---

## 1 · Supabase — the backend (~10 min)

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Run the migrations, either way:
   - **CLI**: `supabase link --project-ref <your-ref> && supabase db push`
   - **Dashboard**: SQL Editor → paste each file in `supabase/migrations/`
     **in order, 0001 through 0011** → Run.
   This creates the schema, PostGIS, row-level security (privacy is enforced
   server-side), the auto-profile-on-signup trigger, and the `avatars` /
   `pin-media` storage buckets.
3. **Authentication → Providers**: Email (magic link) is on by default and is
   all a beta needs. Apple/Google buttons light up only if you add those
   providers' developer credentials — skip for now; the login screen falls
   back to email with a friendly notice.
4. Copy from **Settings → API**: the project URL and the `anon` key.

## 2 · Vercel — the hosting (~5 min)

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the
   GitHub repo `jrosillo-code/CLAUDE`. Next.js is auto-detected; default
   build settings are correct, and `main` (the default production branch)
   carries the app.
2. **Settings → Environment Variables** — add these, then (re)deploy:

   | Variable | Value | Required? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | yes — else the site runs the seeded demo |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` key | yes — same |
   | `NEXT_PUBLIC_GEOAPIFY_KEY` | free key from geoapify.com | no — better search + route-guide lookups |
   | `ANTHROPIC_API_KEY` | console.anthropic.com | no — real AI route guides instead of the demo brief |
   | `NEXT_PUBLIC_MAP_STYLE` | any MapLibre style URL | no — default is keyless OpenFreeMap |
   | `NEXT_PUBLIC_OAUTH_PROVIDERS` | e.g. `google,apple` | no — shows those login buttons once you add the providers' credentials in Supabase; unset = email-only |

3. Note your deploy URL (e.g. `waypoint-beta.vercel.app`). A custom domain is
   Settings → Domains, later, optional.

## 3 · Point Supabase back at the site (2 min — magic links break without it)

Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: your Vercel URL, e.g. `https://waypoint-beta.vercel.app`
- **Redirect URLs**: add the same URL (and `http://localhost:3000` to keep
  local dev sign-in working).

Without this, sign-in emails link back to localhost.

## 4 · The "app" on phones (1 min per phone)

The deployed site over HTTPS *is* the app — it ships a PWA manifest, icons,
and standalone display, so it installs with its own icon and no browser chrome:

- **iPhone**: open the URL in Safari → Share → **Add to Home Screen**.
- **Android**: open in Chrome → ⋮ → **Install app** (or the install banner).

## 5 · First beta session

1. Open the site, sign in with your real email (tap the magic link on the
   same device).
2. Profile → **Import travels** to arrive with a full map, or drop your first
   pins by hand.
3. Send friends the URL + the install step above; add them via
   Travelers → **Add friends**.
4. Sanity pass with two accounts: friend request + accept, a friends-only pin
   visible to the friend but not to a third account, a photo upload, a shared
   trip, the 2026 recap film saving to the camera roll.

## Costs & limits

Everything above runs on free tiers: Supabase (500 MB DB + 1 GB storage),
Vercel (hobby), OpenFreeMap tiles (keyless), Geoapify (3k req/day). Fine for
tens of beta users; nothing to cancel later.

## Troubleshooting

- **Deploy shows the demo data** → the two `NEXT_PUBLIC_SUPABASE_*` vars are
  missing or were added after the build: redeploy.
- **Magic-link email lands on localhost** → step 3.
- **Sign-up succeeds but no profile** → migrations ran out of order; re-run
  `0008` (the signup trigger).
- **Uploads fail** → storage buckets missing; re-run `0004`.
