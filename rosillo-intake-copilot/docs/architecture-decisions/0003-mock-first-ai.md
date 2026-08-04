# ADR-0003: Mock-first AI provider behind a neutral adapter

**Status:** accepted

## Context

The spec (sections 11, 12, 15) requires a provider-neutral AI adapter, a deterministic mock
provider for tests, strict schema validation of every model output, and evaluation isolated from
CI-nondeterminism.

## Decision

`packages/ai` defines the `AIProvider` interface (`analyseCase`, `rankCandidates`,
`draftResponse`, `healthCheck`). Two implementations:

- **MockProvider** — fully deterministic. Classifies with keyword heuristics, extracts entities
  with rule-based extractors (dates, plates, IBANs, policy numbers), ranks only supplied
  candidates, and drafts templated Spanish responses. All unit/integration tests and the default
  evaluation run use it.
- **AnthropicProvider** — calls the Claude API with versioned prompts from the prompt registry
  and forced JSON output. Enabled only when `AI_PROVIDER=anthropic` and an API key is present
  server-side. Never used in CI.

Every provider output — mock or live — passes through the same Zod validation with one repair
retry and a safe error state on failure. The pipeline (in `packages/domain`) treats the provider
as untrusted: candidates the provider did not receive are discarded, `external_action_allowed`
is forced to `false`, and action codes outside the catalogue are rejected.

## Consequences

- Tests are deterministic; the live provider is an evaluation-time concern only.
- Prompt versions are data (registry entries), logged on every analysis run.
