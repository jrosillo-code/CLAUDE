#!/usr/bin/env bash
# Boots a disposable local PostgreSQL, applies the harness shim, then the
# VERBATIM migration, then the assertion suite as the `authenticated` role.
set -euo pipefail
cd "$(dirname "$0")/.."

PGVER_DIR=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
if [ -z "$PGVER_DIR" ]; then echo "SKIP: no local PostgreSQL found" >&2; exit 0; fi
export PATH="$PGVER_DIR:$PATH"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/ops-rls.XXXXXX")
PORT=$(( 20000 + RANDOM % 20000 ))
DB=ops_rls_test
cleanup() { pg_ctl -D "$WORK/data" stop -m immediate -s >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

run_as() {
  if [ "$(id -u)" = "0" ]; then
    chown -R postgres:postgres "$WORK" 2>/dev/null || true
    su postgres -s /bin/bash -c "PATH=\"$PGVER_DIR:\$PATH\" $1"
  else
    bash -c "$1"
  fi
}

echo "→ initdb"
run_as "initdb -D '$WORK/data' --auth=trust --no-sync -U postgres" >/dev/null
echo "→ starting postgres on port $PORT"
run_as "pg_ctl -D '$WORK/data' -o \"-p $PORT -k '$WORK' -c listen_addresses=''\" -w start -s -l '$WORK/pg.log'"
PSQL="psql -h $WORK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
run_as "$PSQL -d postgres -c 'create database $DB'"
echo "→ harness shim"
run_as "$PSQL -d $DB -f tests/rls/setup.sql"
echo "→ verbatim migrations"
for f in supabase/migrations/*.sql; do run_as "$PSQL -d $DB -f $f"; done
echo "→ assertions"
if ! OUT=$(run_as "$PSQL -d $DB -f tests/rls/assertions.sql" 2>&1); then
  echo "$OUT" | grep -E "ok:|FAILED|ERROR" || echo "$OUT" | tail -20
  echo "RLS assertions FAILED"
  exit 1
fi
echo "$OUT" | grep -E "ok:" | sed 's/^.*NOTICE:  //'
echo "RLS assertions passed ($(echo "$OUT" | grep -c 'ok:') checks)"
