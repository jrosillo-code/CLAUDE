# ADR-0001: TypeScript monorepo with npm workspaces

**Status:** accepted

## Context

The spec (sections 12, 20) requires a TypeScript monorepo separating UI, domain services, AI
adapters, and database code so business rules and providers stay modular and replaceable.

## Decision

npm workspaces (no extra tooling) with four workspaces: `packages/domain`, `packages/ai`,
`packages/database`, `apps/web`. Packages export TypeScript source directly (`main: src/index.ts`);
Next.js consumes them via `transpilePackages`, Vitest via workspace symlinks. This keeps builds
simple for a prototype while preserving hard package boundaries (domain has no dependency on the
web framework or the database; ai depends only on domain).

## Consequences

- No compile/publish step per package; refactors stay cheap.
- Package boundaries enforce the spec's "keep AI prompts, schemas, provider adapters,
  deterministic rules, and UI separate" rule.
