#!/usr/bin/env bash
# Migration-chain test: applies EVERY file in supabase/migrations, in order,
# VERBATIM, to an empty PostgreSQL — the same thing `supabase db push` does to
# a fresh project. Then applies the whole chain a SECOND time to prove it is
# idempotent, which is what actually happens when someone re-pastes a file into
# the dashboard SQL editor or re-runs a push after a partial failure.
#
# What this catches that scripts/test-rls.sh cannot: a migration that only
# works because an earlier hand-run statement happened to exist, an ordering
# mistake between files, and a `create policy` / `create table` that explodes
# on re-run instead of no-op'ing.
#
# Supabase's own objects (auth.users, auth.uid(), storage.*, the anon /
# authenticated / service_role roles, the realtime publication) come from
# tests/live/supabase-stubs.sql. Nothing else is provided — a migration that
# depends on something undeclared fails here, on purpose.
#
# Requires postgresql + postgis locally. Skips cleanly when either is absent.

set -euo pipefail
cd "$(dirname "$0")/.."

PGVER_DIR=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
if [ -z "$PGVER_DIR" ]; then
  echo "SKIP: no local PostgreSQL found (install postgresql to run migration tests)" >&2
  exit 0
fi
export PATH="$PGVER_DIR:$PATH"

if ! ls /usr/share/postgresql/*/extension/postgis.control >/dev/null 2>&1; then
  echo "SKIP: postgis not installed (apt-get install postgresql-NN-postgis-3)" >&2
  exit 0
fi

WORK=$(mktemp -d "${TMPDIR:-/tmp}/wp-mig.XXXXXX")
PORT=$(( 20000 + RANDOM % 20000 ))
DB=wp_mig_test

cleanup() {
  pg_ctl -D "$WORK/data" stop -m immediate -s >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run_as() {
  # initdb/postgres refuse to run as root; drop to a throwaway identity then.
  if [ "$(id -u)" = "0" ]; then
    chown -R postgres:postgres "$WORK" 2>/dev/null || true
    su postgres -s /bin/bash -c "PATH=\"$PGVER_DIR:\$PATH\" $1"
  else
    bash -c "$1"
  fi
}

echo "→ initdb (disposable cluster in $WORK)"
run_as "initdb -D '$WORK/data' --auth=trust --no-sync -U postgres" >/dev/null

echo "→ starting postgres on port $PORT (unix socket only)"
run_as "pg_ctl -D '$WORK/data' -o \"-p $PORT -k '$WORK' -c listen_addresses=''\" -w start -s -l '$WORK/pg.log'"

PSQL="psql -h $WORK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"

run_as "$PSQL -d postgres -c 'create database $DB'"
echo "→ stubbing hosted-Supabase objects (tests/live/supabase-stubs.sql)"
run_as "$PSQL -d $DB -f tests/live/supabase-stubs.sql"

apply_chain() {
  for f in supabase/migrations/*.sql; do
    printf '   %s %s\n' "$1" "$(basename "$f")"
    run_as "$PSQL -d $DB -f '$f'"
  done
}

echo "→ applying the full chain to an empty database"
apply_chain "·"

echo "→ re-applying the full chain (idempotency)"
apply_chain "↻"

echo "→ checking the objects the app actually queries exist"
run_as "$PSQL -d $DB -f tests/migrations/expected-objects.sql"

echo "Migration chain passed (fresh apply + re-apply)."
