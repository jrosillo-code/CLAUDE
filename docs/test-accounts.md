# Synthetic test accounts (preview environment only)

> Deliberately kept out of the README. This file describes the DISPOSABLE
> preview project's synthetic accounts. None of these are real people; none
> of this applies to any production environment.

## Accounts

Create these three accounts in the preview Supabase project (Auth → Add
user, or sign up through the app). The `@synthetic.test` domain matters:
`scripts/reset-synthetic.sql` refuses to run if any auth account has a
different domain, which is the guard that keeps the reset script pointed at
the right project.

| Persona | Email | Role in tests |
|---|---|---|
| Alice | `alice@synthetic.test` | Reflection owner — owns the completed trip and the debrief |
| Bob | `bob@synthetic.test` | Accepted friend of Alice |
| Carol | `carol@synthetic.test` | Stranger — no friendship with anyone |

Passwords: choose per-project throwaways; store them in the team password
manager under the preview project's entry, never in the repo.

## Fixture data

After creating the accounts, connect Alice→Bob as accepted friends (send +
accept a request in-app, or insert the `friendships` row), then either:

- walk the app as Alice: drop two pins (e.g. Sintra rated 7, Ericeira
  rated 9), plan a two-stop trip, mark it completed, run the debrief; or
- adapt `tests/live/synthetic-seed.sql` with the real auth UUIDs and run it
  in the SQL editor.

## Reset procedure

```
psql "$SUPABASE_DB_URL" -f scripts/reset-synthetic.sql
```

(or paste the file into the project's SQL editor). The script wipes user
data, keeps schema/policies/buckets, refuses to run against anything that
doesn't look synthetic, and leaves the reference `activities` table alone.
Re-create the three accounts afterwards.

## What the two-browser test uses these for

The privacy-matrix walkthrough in `docs/live-supabase-validation.md` (and
the automated version in `tests/e2e/privacy-matrix.md`) runs Alice and Bob
in separate browser profiles and Carol in a third/incognito profile.
