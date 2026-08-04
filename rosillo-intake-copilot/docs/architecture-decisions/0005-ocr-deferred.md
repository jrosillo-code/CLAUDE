# ADR-0005: OCR deferred behind an extraction seam

**Status:** accepted

## Context

Spec FR-003 makes scanned-document OCR optional and disabled by default. The
M5 work order confirms: do not implement full OCR unless it can be added
without weakening security or test coverage. A real OCR engine would add a
heavy native/external dependency, a new data-exfiltration surface (attachment
bytes leaving the host), and nondeterministic text extraction inside suites
that are deliberately deterministic.

## Decision

Ship the integration seam, not the engine. `packages/ai/src/extraction/`
defines `AttachmentExtractor` with a fixed contract, plus two adapters:
`PassthroughExtractor` (deterministic text already extracted — the current
path) and `MockOcrAdapter` (canned results for evaluating the seam and the
fail-safe path in tests).

Contract every future OCR provider must meet:

- **Confidence threshold**: results below `MIN_OCR_CONFIDENCE` (0.8) MUST
  return `status: 'REJECTED'` with empty text — the attachment is treated as
  unreadable and the missing-info rules ask the customer for a legible copy.
  The system never acts on low-confidence OCR.
- **Provenance**: every result carries the engine identity/version, stored
  with the analysis run like prompt versions, keeping runs reproducible and
  auditable.
- **Untrusted output**: OCR text crosses the same trust boundary (B1) as email
  bodies — never instructions, always schema-bounded, always subject to the
  deterministic rules.
- **No unapproved egress**: adapters MUST NOT send attachment bytes to any
  external service without an explicit deployment-level approval (synthetic
  rule today; a DPIA-backed decision for any real pilot).

## Consequences

- Evaluating a vendor later means writing one adapter and running the existing
  extraction tests plus the evaluation suite — no pipeline changes.
- Image attachments contribute no text today (honest `NO_TEXT`), which the
  missing-info rules already handle (e.g. photos count by filename, not content).
