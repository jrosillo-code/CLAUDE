#!/usr/bin/env bash
# RLS test runner: boots a DISPOSABLE local PostgreSQL cluster, applies the
# harness prerequisites (tests/rls/setup.sql) plus the VERBATIM reflections
# migration (supabase/migrations/0013_reflections.sql), then runs the
# assertion suite as the non-owner `authenticated` role — the same posture
# Supabase queries run under. The cluster lives in a temp dir and is removed
# afterwards, pass or fail.
#
# What this proves: the RLS policies and cascade behavior of migration 0013,
# exactly as written. What it can't prove (documented in docs/reflections.md):
# Supabase's PostgREST/auth/realtime layers on top — verify those once against
# a real project with `supabase db push` + two signed-in browsers.

set -euo pipefail
cd "$(dirname "$0")/.."

PGVER_DIR=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
if [ -z "$PGVER_DIR" ]; then
  echo "SKIP: no local PostgreSQL found (install postgresql to run RLS tests)" >&2
  exit 0
fi
export PATH="$PGVER_DIR:$PATH"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/wp-rls.XXXXXX")
PORT=$(( 20000 + RANDOM % 20000 ))
DB=wp_rls_test

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
echo "→ applying harness prerequisites (tests/rls/setup.sql)"
run_as "$PSQL -d $DB -f tests/rls/setup.sql"
echo "→ applying VERBATIM reflections migrations (0013, then the 0015 fix)"
run_as "$PSQL -d $DB -f supabase/migrations/0013_reflections.sql"
run_as "$PSQL -d $DB -f supabase/migrations/0015_reflection_trip_ownership.sql"
echo "→ running assertions (tests/rls/assertions.sql)"
run_as "$PSQL -d $DB -f tests/rls/assertions.sql"

echo "RLS tests passed."
