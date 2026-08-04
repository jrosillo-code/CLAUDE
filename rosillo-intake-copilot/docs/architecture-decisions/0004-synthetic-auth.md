# ADR-0004: Signed-cookie synthetic authentication

**Status:** accepted (prototype-only)

## Context

The spec allows "Auth.js or equivalent local development authentication" with synthetic users and
server-side role claims. The prototype has exactly five seeded synthetic users and no external
identity provider.

## Decision

A minimal server-side session: login selects a seeded synthetic user (shared prototype password),
and an HMAC-signed, httpOnly cookie carries the user id. Roles are read from the database on
every request; all permission checks (RBAC per spec section 06) happen server-side in
`packages/database` repository functions and in route handlers/server actions. No model keys or
role claims ever reach the browser.

## Consequences

- Any production pilot must replace this with the company identity provider — the auth module is
  isolated in `apps/web/lib/auth.ts` for that reason.
- The RBAC permission map itself lives in `packages/domain` and is independent of the auth
  mechanism.
