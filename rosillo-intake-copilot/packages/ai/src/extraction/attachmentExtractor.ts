import type { AttachmentInput } from '@rosillo/domain';

/**
 * OCR / attachment-extraction seam (spec FR-003 — OCR optional, disabled by
 * default). Full OCR is deliberately NOT implemented in the MVP (see
 * ADR-0005); this interface fixes the contract any future provider must meet
 * so it can be evaluated without touching the pipeline.
 *
 * Contract requirements for real adapters:
 * - `confidence` below `MIN_OCR_CONFIDENCE` MUST produce `status: 'REJECTED'`
 *   (fail safe: the attachment is treated as having no extractable text, and
 *   the missing-info rules will ask the customer for a readable copy — the
 *   system must never act on low-confidence OCR).
 * - `provenance` MUST identify the engine and version so analysis runs remain
 *   reproducible and auditable (it is stored with the run, like prompt versions).
 * - Extracted text is UNTRUSTED DATA, exactly like email bodies: it is never
 *   interpreted as instructions and always passes through the same schema
 *   validation and deterministic rules.
 * - Adapters MUST NOT send attachment bytes to any external service unless the
 *   deployment has explicitly approved that provider (synthetic-data rule).
 */

export const MIN_OCR_CONFIDENCE = 0.8;

export interface ExtractionResult {
  status: 'EXTRACTED' | 'NO_TEXT' | 'REJECTED';
  text: string;
  /** 0..1 — engine-reported confidence. Deterministic extractors report 1. */
  confidence: number;
  /** Engine identity + version, stored with the analysis run for auditability. */
  provenance: string;
  /** Human-readable reason when status is REJECTED. */
  reason?: string;
}

export interface AttachmentExtractor {
  readonly name: string;
  /** MIME types this extractor can handle. */
  supports(mimeType: string): boolean;
  extract(attachment: AttachmentInput): Promise<ExtractionResult>;
}

/** Passthrough for attachments whose text was already extracted deterministically (text PDFs, TXT). */
export class PassthroughExtractor implements AttachmentExtractor {
  readonly name = 'passthrough-v1';
  supports(mimeType: string): boolean {
    return mimeType === 'application/pdf' || mimeType === 'text/plain';
  }
  async extract(attachment: AttachmentInput): Promise<ExtractionResult> {
    return attachment.text
      ? { status: 'EXTRACTED', text: attachment.text, confidence: 1, provenance: this.name }
      : { status: 'NO_TEXT', text: '', confidence: 1, provenance: this.name };
  }
}

/**
 * Deterministic mock OCR adapter for evaluating the integration seam. Returns
 * canned text for known synthetic images and demonstrates the fail-safe path
 * for low-confidence results. Never used outside tests/evaluation.
 */
export class MockOcrAdapter implements AttachmentExtractor {
  readonly name = 'mock-ocr-v1';

  constructor(
    private canned: Record<string, { text: string; confidence: number }> = {},
  ) {}

  supports(mimeType: string): boolean {
    return mimeType === 'image/jpeg' || mimeType === 'image/png';
  }

  async extract(attachment: AttachmentInput): Promise<ExtractionResult> {
    const entry = this.canned[attachment.filename];
    if (!entry) return { status: 'NO_TEXT', text: '', confidence: 1, provenance: this.name };
    if (entry.confidence < MIN_OCR_CONFIDENCE) {
      return {
        status: 'REJECTED',
        text: '',
        confidence: entry.confidence,
        provenance: this.name,
        reason: `OCR confidence ${entry.confidence} below the ${MIN_OCR_CONFIDENCE} threshold — attachment treated as unreadable (fail safe).`,
      };
    }
    return { status: 'EXTRACTED', text: entry.text, confidence: entry.confidence, provenance: this.name };
  }
}
