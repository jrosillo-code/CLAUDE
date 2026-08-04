import type { CommunicationInput, CustomerRecord, PolicyRecord, CandidateMatch } from '../types';

/**
 * Deterministic customer/policy candidate search (FR-006, pipeline stage 3).
 * The AI never queries the database; it only re-ranks candidates produced here.
 */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function textOf(comm: CommunicationInput): string {
  return norm(
    [comm.subject, comm.bodyText, ...comm.attachments.map((a) => `${a.filename} ${a.text}`)].join('\n'),
  );
}

export function findCustomerCandidates(
  comm: CommunicationInput,
  customers: CustomerRecord[],
  limit = 5,
): CandidateMatch[] {
  const text = textOf(comm);
  const fromEmail = norm(comm.from);

  const scored = customers.map((c) => {
    const signals: string[] = [];
    let score = 0;

    if (c.email && norm(c.email) === fromEmail) {
      score += 0.6;
      signals.push(`Remitente coincide con el email del cliente (${c.email})`);
    }
    const nameParts = norm(c.name).split(/\s+/).filter((p) => p.length > 2);
    const hits = nameParts.filter((p) => text.includes(p) || fromEmail.includes(p));
    if (hits.length > 0) {
      score += Math.min(0.4, 0.15 * hits.length);
      signals.push(`Nombre parcialmente presente: ${hits.join(', ')}`);
    }
    if (c.taxIdFake && text.includes(norm(c.taxIdFake))) {
      score += 0.5;
      signals.push('Identificador fiscal (sintético) presente en el texto');
    }
    if (c.phone && text.includes(c.phone.replace(/\s+/g, ''))) {
      score += 0.3;
      signals.push('Teléfono presente en el texto');
    }
    return { id: c.id, kind: 'CUSTOMER' as const, label: c.name, score: Math.min(1, score), signals };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function findPolicyCandidates(
  comm: CommunicationInput,
  policies: PolicyRecord[],
  customerCandidates: CandidateMatch[],
  limit = 5,
): CandidateMatch[] {
  const text = textOf(comm);
  const topCustomerIds = new Set(customerCandidates.map((c) => c.id));

  const scored = policies.map((p) => {
    const signals: string[] = [];
    let score = 0;

    if (text.includes(norm(p.policyNumber))) {
      score += 0.7;
      signals.push(`Número de póliza citado (${p.policyNumber})`);
    }
    if (topCustomerIds.has(p.customerId)) {
      const customerRank = customerCandidates.findIndex((c) => c.id === p.customerId);
      score += customerRank === 0 ? 0.4 : 0.25;
      signals.push('Pertenece a un cliente candidato');
    }
    // Risk keywords: plate, make/model words from the risk summary appearing in the text.
    const riskTokens = norm(p.riskSummary)
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const riskHits = riskTokens.filter((t) => text.includes(t));
    if (riskHits.length > 0) {
      score += Math.min(0.35, 0.12 * riskHits.length);
      signals.push(`Riesgo coincide: ${riskHits.slice(0, 4).join(', ')}`);
    }
    if (p.status === 'CANCELLED') score *= 0.5;

    return {
      id: p.id,
      kind: 'POLICY' as const,
      label: `${p.policyNumber} · ${p.product} · ${p.riskSummary}`,
      score: Math.min(1, score),
      signals,
    };
  });

  return scored
    .filter((s) => s.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
