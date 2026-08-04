import { describe, it, expect } from 'vitest';
import { evaluateMissingInformation, type ExtractedField } from '../src';

const explicitField = (value: string): ExtractedField => ({
  value,
  status: 'EXPLICIT',
  confidence: 0.9,
  evidenceIds: ['ev-1'],
  note: null,
});

describe('missing-information rules', () => {
  it('requires exact time and photos for a motor claim without them', () => {
    const items = evaluateMissingInformation({
      workflow: 'MOTOR_CLAIM',
      entities: {},
      attachmentFilenames: [],
      bodyText: 'Encontré el coche golpeado en el parking.',
    });
    const keys = items.map((i) => i.key);
    expect(keys).toContain('exact_incident_time');
    expect(keys).toContain('damage_photos');
    expect(items.find((i) => i.key === 'exact_incident_time')?.severity).toBe('REQUIRED');
  });

  it('does not ask for photos when photo attachments exist', () => {
    const items = evaluateMissingInformation({
      workflow: 'MOTOR_CLAIM',
      entities: {},
      attachmentFilenames: ['foto-1.jpg'],
      bodyText: 'Golpe en el parking.',
    });
    expect(items.map((i) => i.key)).not.toContain('damage_photos');
  });

  it('flags inferred incident dates as needing the exact time', () => {
    const items = evaluateMissingInformation({
      workflow: 'MOTOR_CLAIM',
      entities: {
        incident_date: { value: '2026-08-03', status: 'INFERRED', confidence: 0.7, evidenceIds: [], note: null },
        incident_time: explicitField('18:30'),
      },
      attachmentFilenames: ['foto.jpg'],
      bodyText: 'Ayer hubo un golpe.',
    });
    expect(items.map((i) => i.key)).toContain('exact_incident_time');
  });

  it('requires effective date and signed instruction for cancellations', () => {
    const items = evaluateMissingInformation({
      workflow: 'POLICY_CANCELLATION',
      entities: {},
      attachmentFilenames: [],
      bodyText: 'Quiero dar de baja el seguro.',
    });
    const keys = items.map((i) => i.key);
    expect(keys).toContain('requested_effective_date');
    expect(keys).toContain('signed_instruction');
  });

  it('requires sale proof when a sale is mentioned without a contract attachment', () => {
    const items = evaluateMissingInformation({
      workflow: 'POLICY_CANCELLATION',
      entities: {},
      attachmentFilenames: [],
      bodyText: 'Vendí el coche y quiero dar de baja el seguro.',
    });
    expect(items.map((i) => i.key)).toContain('sale_proof');
  });

  it('accepts a valid 24-character Spanish IBAN', () => {
    const items = evaluateMissingInformation({
      workflow: 'POLICY_AMENDMENT',
      entities: { new_iban: explicitField('ES1234567890123456789012') },
      attachmentFilenames: ['orden.pdf'],
      bodyText: 'Cambio de cuenta bancaria, nuevo IBAN adjunto.',
    });
    expect(items.map((i) => i.key)).not.toContain('complete_iban');
  });

  it('rejects an incomplete IBAN', () => {
    const items = evaluateMissingInformation({
      workflow: 'POLICY_AMENDMENT',
      entities: { new_iban: explicitField('ES123456') },
      attachmentFilenames: [],
      bodyText: 'Quiero cambiar la cuenta bancaria.',
    });
    expect(items.map((i) => i.key)).toContain('complete_iban');
  });

  it('requires driver licence date when adding a driver', () => {
    const items = evaluateMissingInformation({
      workflow: 'POLICY_AMENDMENT',
      entities: {},
      attachmentFilenames: [],
      bodyText: 'Quiero añadir a mi hijo como conductor ocasional.',
    });
    expect(items.map((i) => i.key)).toContain('driver_licence_date');
  });

  it('requires construction year for home quotes', () => {
    const items = evaluateMissingInformation({
      workflow: 'QUOTE_REQUEST',
      entities: {},
      attachmentFilenames: [],
      bodyText: 'Presupuesto para el seguro de una casa nueva.',
    });
    expect(items.map((i) => i.key)).toContain('construction_year');
  });

  it('returns nothing for UNKNOWN workflow', () => {
    const items = evaluateMissingInformation({
      workflow: 'UNKNOWN',
      entities: {},
      attachmentFilenames: [],
      bodyText: 'Boletín de ofertas.',
    });
    expect(items).toHaveLength(0);
  });
});
