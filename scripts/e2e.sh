#!/usr/bin/env bash
# Browser suites against a production build of the keyless demo. Each suite
# is a plain node script in tests/e2e that boots its own server on a free
# port; this runs them one after another and fails if any suite fails.
#
#   npm run test:e2e            all suites
#   npm run test:e2e -- phone   just tests/e2e/phone.mjs
#   E2E_SKIP=recap npm run test:e2e   skip the slow film render
set -uo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .next/BUILD_ID ]; then
  echo "no production build — building the demo first" >&2
  NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run build >/dev/null
fi

suites=(desktop phone lists ui growth digest recap)
if [ $# -gt 0 ]; then suites=("$@"); fi
skip=",${E2E_SKIP:-},"
failed=0
for s in "${suites[@]}"; do
  case "$skip" in *",$s,"*) echo "skip $s"; continue;; esac
  echo "── $s"
  if ! timeout "${E2E_TIMEOUT:-600}" node "tests/e2e/$s.mjs" 2>/dev/null | tail -n 3; then
    failed=$((failed + 1))
  fi
done
echo
if [ "$failed" -gt 0 ]; then echo "$failed suite(s) failed"; exit 1; fi
echo "all suites passed"
