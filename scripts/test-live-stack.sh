#!/usr/bin/env bash
# Live-stack validation: the closest this repo can get to a hosted Supabase
# project without one. Boots a disposable PostgreSQL cluster, installs ONLY
# the stubs a Supabase project ships with (auth/storage schemas, roles,
# realtime publication — tests/live/supabase-stubs.sql), then applies EVERY
# migration in supabase/migrations/ in order, from empty, exactly as
# `supabase db push` would. Asserts the resulting catalog, seeds synthetic
# accounts, starts a REAL PostgREST (the API server hosted Supabase runs)
# with JWT auth, and drives lib/backend.ts plus the full REST privacy matrix
# against it via tests/live/postgrest.test.ts.
#
# Still requiring a hosted project: GoTrue login UX, Realtime event delivery,
# Storage uploads. See docs/live-supabase-validation.md.
#
# Requires: postgresql server locally; a postgrest binary (POSTGREST_BIN, or
# `postgrest` on PATH). Skips politely when either is missing.

set -euo pipefail
cd "$(dirname "$0")/.."

PGVER_DIR=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
if [ -z "$PGVER_DIR" ]; then
  echo "SKIP: no local PostgreSQL found" >&2
  exit 0
fi
export PATH="$PGVER_DIR:$PATH"

POSTGREST_BIN="${POSTGREST_BIN:-$(command -v postgrest || true)}"
if [ -z "$POSTGREST_BIN" ]; then
  echo "SKIP: no postgrest binary (set POSTGREST_BIN or install postgrest)" >&2
  exit 0
fi

WORK=$(mktemp -d "${TMPDIR:-/tmp}/wp-live.XXXXXX")
PGPORT=$(( 20000 + RANDOM % 10000 ))
RESTPORT=$(( 30000 + RANDOM % 10000 ))
DB=wp_live_test
JWT_SECRET="waypoint-test-secret-at-least-32-chars-long"

cleanup() {
  [ -n "${REST_PID:-}" ] && kill "$REST_PID" 2>/dev/null || true
  pg_ctl -D "$WORK/data" stop -m immediate -s >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run_as() {
  if [ "$(id -u)" = "0" ]; then
    chown -R postgres:postgres "$WORK" 2>/dev/null || true
    su postgres -s /bin/bash -c "PATH=\"$PGVER_DIR:\$PATH\" $1"
  else
    bash -c "$1"
  fi
}

echo "→ initdb (disposable cluster)"
run_as "initdb -D '$WORK/data' --auth=trust --no-sync -U postgres" >/dev/null
echo "→ starting postgres on 127.0.0.1:$PGPORT"
run_as "pg_ctl -D '$WORK/data' -o \"-p $PGPORT -k '$WORK' -c listen_addresses=127.0.0.1 -c wal_level=logical\" -w start -s -l '$WORK/pg.log'"

PSQL="psql -h 127.0.0.1 -p $PGPORT -U postgres -v ON_ERROR_STOP=1 -q"
run_as "$PSQL -d postgres -c 'create database $DB'"

echo "→ installing Supabase-managed stubs"
run_as "$PSQL -d $DB -f tests/live/supabase-stubs.sql"

echo "→ applying ALL migrations in order, from empty:"
for f in supabase/migrations/*.sql; do
  echo "   · $f"
  run_as "$PSQL -d $DB -f '$f'"
done

echo "→ catalog assertions"
run_as "$PSQL -d $DB -f tests/live/catalog-assertions.sql"

echo "→ seeding synthetic accounts (alice/bob/carol)"
run_as "$PSQL -d $DB -f tests/live/synthetic-seed.sql"

echo "→ preparing PostgREST authenticator role"
run_as "$PSQL -d $DB -c \"
  do \\\$\\\$ begin create role authenticator login noinherit; exception when duplicate_object then null; end \\\$\\\$;
  grant anon, authenticated, service_role to authenticator;\""

echo "→ starting PostgREST on 127.0.0.1:$RESTPORT"
cat > "$WORK/postgrest.conf" <<CONF
db-uri = "postgres://authenticator@127.0.0.1:$PGPORT/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = $RESTPORT
CONF
"$POSTGREST_BIN" "$WORK/postgrest.conf" > "$WORK/postgrest.log" 2>&1 &
REST_PID=$!
for i in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$RESTPORT/" >/dev/null 2>&1 && break
  sleep 0.25
done

echo "→ driving lib/backend.ts + REST privacy matrix through PostgREST"
POSTGREST_URL="http://127.0.0.1:$RESTPORT" \
POSTGREST_JWT_SECRET="$JWT_SECRET" \
PG_ADMIN="psql -h 127.0.0.1 -p $PGPORT -U postgres -d $DB -v ON_ERROR_STOP=1 -q -t -A" \
  npx tsx --test tests/live/postgrest.test.ts

echo "Live-stack tests passed."
