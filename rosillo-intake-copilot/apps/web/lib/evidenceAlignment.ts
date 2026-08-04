import type { CaseAnalysis, Evidence } from '@rosillo/domain';
import type { TextMark } from '@/components/HighlightableText';

/**
 * Server-side alignment of evidence quotes against their cited sources.
 * A quote is "aligned" only when it matches the source text exactly —
 * either at its recorded offsets or at a unique verbatim occurrence. When it
 * doesn't, the UI states that honestly (no approximate highlighting).
 */

export interface EvidenceAlignment {
  evidenceId: string;
  quote: string;
  sourceLabel: string;
  aligned: boolean;
  /** True for RULE / POLICY_RECORD evidence — deterministic, not textual. */
  deterministic?: boolean;
  targetId?: string;
  /** DOM id of the <details> element to open before scrolling (attachments). */
  containerId?: string;
}

export interface AlignmentResult {
  bodyMarks: TextMark[];
  subjectMarks: TextMark[];
  attachmentMarks: Record<string, TextMark[]>;
  byEvidenceId: Map<string, EvidenceAlignment>;
}

interface SourceDoc {
  id: string;
  text: string;
}

function locate(evidence: Evidence, doc: SourceDoc, useOffsets: boolean): { start: number; end: number } | null {
  const { quote } = evidence;
  if (!quote) return null;
  if (useOffsets && evidence.offsets) {
    const [start, end] = evidence.offsets;
    if (doc.text.slice(start, end) === quote) return { start, end };
  }
  const first = doc.text.indexOf(quote);
  if (first === -1) return null;
  const second = doc.text.indexOf(quote, first + 1);
  if (second !== -1 && !useOffsets) return null; // ambiguous without offsets — do not guess
  return { start: first, end: first + quote.length };
}

function overlaps(marks: TextMark[], start: number, end: number): boolean {
  return marks.some((m) => start < m.end && end > m.start);
}

export function alignEvidence(
  analysis: CaseAnalysis,
  communication: { subject: string; bodyText: string },
  attachments: Array<{ id: string; filename: string; text: string }>,
): AlignmentResult {
  const bodyMarks: TextMark[] = [];
  const subjectMarks: TextMark[] = [];
  const attachmentMarks: Record<string, TextMark[]> = Object.fromEntries(attachments.map((a) => [a.id, []]));
  const byEvidenceId = new Map<string, EvidenceAlignment>();

  for (const ev of analysis.evidence) {
    let alignment: EvidenceAlignment = {
      evidenceId: ev.id,
      quote: ev.quote,
      sourceLabel: 'Fuente',
      aligned: false,
    };

    if (ev.sourceType === 'EMAIL_BODY') {
      alignment.sourceLabel = 'Correo';
      const loc = locate(ev, { id: 'body', text: communication.bodyText }, true);
      if (loc && !overlaps(bodyMarks, loc.start, loc.end)) {
        bodyMarks.push({ id: ev.id, start: loc.start, end: loc.end });
        alignment = { ...alignment, aligned: true, targetId: `body-${ev.id}` };
      }
    } else if (ev.sourceType === 'EMAIL_SUBJECT') {
      alignment.sourceLabel = 'Asunto';
      const loc = locate(ev, { id: 'subject', text: communication.subject }, true);
      if (loc && !overlaps(subjectMarks, loc.start, loc.end)) {
        subjectMarks.push({ id: ev.id, start: loc.start, end: loc.end });
        alignment = { ...alignment, aligned: true, targetId: `subject-${ev.id}` };
      }
    } else if (ev.sourceType === 'ATTACHMENT') {
      const holder = attachments.find((a) => a.text.includes(ev.quote));
      if (holder) {
        alignment.sourceLabel = `Adjunto ${holder.filename}`;
        const loc = locate(ev, { id: holder.id, text: holder.text }, false);
        if (loc && !overlaps(attachmentMarks[holder.id]!, loc.start, loc.end)) {
          attachmentMarks[holder.id]!.push({ id: ev.id, start: loc.start, end: loc.end });
          alignment = {
            ...alignment,
            aligned: true,
            targetId: `att-${holder.id}-${ev.id}`,
            containerId: `att-panel-${holder.id}`,
          };
        }
      } else {
        alignment.sourceLabel = 'Adjunto';
      }
    } else {
      // RULE / POLICY_RECORD — deterministic sources, nothing to highlight in the email.
      alignment.sourceLabel = ev.sourceType === 'RULE' ? 'Regla determinista' : 'Registro de póliza';
      alignment.deterministic = true;
    }

    byEvidenceId.set(ev.id, alignment);
  }

  return { bodyMarks, subjectMarks, attachmentMarks, byEvidenceId };
}
