#!/usr/bin/env bash
# One-command clean setup: install → migrate → seed → typecheck → tests →
# build → e2e → evaluation. Run from the rosillo-intake-copilot directory.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

step "Install dependencies"
npm install --no-audit --no-fund

step "Environment"
[ -f .env ] || cp .env.example .env

step "Database: migrate + synthetic seed"
npm run db:migrate
npm run db:seed

step "Typecheck (all workspaces)"
npm run typecheck

step "Unit, integration and security tests"
npm test

step "Production build"
npm run build

step "End-to-end tests (Playwright, fresh e2e database)"
npm run test:e2e

step "Labelled synthetic evaluation (quality gates)"
npm run evaluate

step "Dependency audit (production tree)"
npm run audit || echo "Review the npm audit findings above."

printf '\n\033[1mSetup complete.\033[0m Start the app with: npm run dev\n'
