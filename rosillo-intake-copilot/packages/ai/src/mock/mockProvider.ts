import type {
  AIProvider,
  AnalyseCaseInput,
  DraftResponseInput,
  RankCandidatesInput,
  ProviderHealth,
  WorkflowType,
  CommunicationInput,
  Evidence,
  ExtractedField,
} from '@rosillo/domain';
import { promptRegistry } from '../prompts/registry';

/**
 * Deterministic mock AI provider (ADR-0003). Keyword classification + rule-based
 * extraction, no randomness, no network. All tests and the default evaluation
 * run use this provider. It intentionally mirrors the real provider's contract:
 * it returns plain objects that must survive the pipeline's schema validation.
 */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

interface Signal {
  workflow: WorkflowType;
  pattern: RegExp;
  weight: number;
}

// Patterns run against normalized (lowercase, accent-stripped) subject + body.
const SIGNALS: Signal[] = [
  // Explicit cancellation request — strongest signal.
  { workflow: 'POLICY_CANCELLATION', pattern: /quiero dar de baja|dar de baja el seguro|dar de baja la poliza|anular (el seguro|la poliza)|cancelar (el seguro|la poliza)/, weight: 5 },
  { workflow: 'POLICY_CANCELLATION', pattern: /solicito la baja|tramitar la baja/, weight: 5 },
  { workflow: 'POLICY_CANCELLATION', pattern: /vend(i|ido|imos) (el|mi|nuestro) (coche|vehiculo|moto)/, weight: 2 },

  { workflow: 'MOTOR_CLAIM', pattern: /golpe/, weight: 2 },
  { workflow: 'MOTOR_CLAIM', pattern: /siniestro/, weight: 2 },
  { workflow: 'MOTOR_CLAIM', pattern: /accidente|colision|choque|alcance/, weight: 2 },
  { workflow: 'MOTOR_CLAIM', pattern: /parte amistoso|declaracion amistosa/, weight: 3 },
  { workflow: 'MOTOR_CLAIM', pattern: /dan(o|os) (en|del|al) (el )?(coche|vehiculo|moto)/, weight: 2 },

  { workflow: 'POLICY_AMENDMENT', pattern: /anadir|incluir a/, weight: 2 },
  { workflow: 'POLICY_AMENDMENT', pattern: /conductor (ocasional|habitual|adicional)/, weight: 3 },
  { workflow: 'POLICY_AMENDMENT', pattern: /cambiar|cambio de|modificar/, weight: 2 },
  { workflow: 'POLICY_AMENDMENT', pattern: /cuenta bancaria|iban|domiciliacion/, weight: 3 },

  { workflow: 'QUOTE_REQUEST', pattern: /presupuesto|cotizacion|cotizar|oferta para/, weight: 3 },
  { workflow: 'QUOTE_REQUEST', pattern: /contratar (un|el) seguro|nuevo seguro|asegurar (una|la|nuestra|mi)/, weight: 2 },

  { workflow: 'RENEWAL_QUESTION', pattern: /renovacion|renovar/, weight: 2 },
  { workflow: 'RENEWAL_QUESTION', pattern: /prima|recibo/, weight: 2 },
  { workflow: 'RENEWAL_QUESTION', pattern: /ha subido|subida|incremento|% mas/, weight: 2 },

  // Weight 1 keeps a bare "expediente" mention below the classification
  // threshold — marketing/injection text citing expedientes must not open a case.
  { workflow: 'MISSING_DOCUMENT_FOLLOWUP', pattern: /expediente/, weight: 1 },
  { workflow: 'MISSING_DOCUMENT_FOLLOWUP', pattern: /documentacion (pendiente|que falta)|que falta para|documentos pendientes/, weight: 3 },
  { workflow: 'MISSING_DOCUMENT_FOLLOWUP', pattern: /me hab(eis|ian) pedido|me solicitasteis/, weight: 3 },
];

function classify(text: string): { workflow: WorkflowType; confidence: number; secondary: WorkflowType[] } {
  const scores = new Map<WorkflowType, number>();
  for (const s of SIGNALS) {
    if (s.pattern.test(text)) scores.set(s.workflow, (scores.get(s.workflow) ?? 0) + s.weight);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || top[1] < 2) return { workflow: 'UNKNOWN', confidence: 0.9, secondary: [] };
  const secondary = ranked
    .slice(1)
    .filter(([, score]) => score >= 4)
    .map(([w]) => w)
    .slice(0, 2);
  const confidence = Math.min(0.97, 0.55 + top[1] * 0.06);
  return { workflow: top[0], confidence, secondary };
}

/** Evidence builder that records quotes with offsets into subject/body. */
class EvidenceBag {
  evidence: Evidence[] = [];
  private n = 0;
  constructor(private comm: CommunicationInput) {}

  fromBody(match: RegExpMatchArray | null, fallbackQuote?: string): string[] {
    if (!match || match.index === undefined) return fallbackQuote ? this.manual(fallbackQuote) : [];
    const id = `ev-${++this.n}`;
    this.evidence.push({
      id,
      sourceType: 'EMAIL_BODY',
      sourceId: this.comm.id,
      quote: match[0].slice(0, 200),
      offsets: [match.index, match.index + match[0].length],
    });
    return [id];
  }

  manual(quote: string, sourceType: Evidence['sourceType'] = 'EMAIL_BODY'): string[] {
    const id = `ev-${++this.n}`;
    this.evidence.push({ id, sourceType, sourceId: this.comm.id, quote: quote.slice(0, 200), offsets: null });
    return [id];
  }
}

function field(
  value: string | null,
  status: 'EXPLICIT' | 'INFERRED' | 'UNKNOWN',
  confidence: number,
  evidenceIds: string[],
  note: string | null = null,
): ExtractedField {
  return { value, status, confidence, evidenceIds, note };
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function extractEntities(
  workflow: WorkflowType,
  comm: CommunicationInput,
  bag: EvidenceBag,
): Record<string, ExtractedField> {
  const body = comm.bodyText;
  const entities: Record<string, ExtractedField> = {};

  const dateMatch = body.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\b/);
  const plate = body.match(/\b\d{4}[- ]?[A-Z]{3}\b/);
  const policyRef = (comm.subject + '\n' + body).match(/\b(AUTO|HOME|MOTO|FLEET|RC)-\d{6}\b/);

  if (workflow === 'MOTOR_CLAIM') {
    const ayer = body.match(/\bayer\b/i);
    const hoy = body.match(/\b(hoy|esta manana|esta mañana)\b/i);
    if (dateMatch) {
      entities['incident_date'] = field(dateMatch[0], 'EXPLICIT', 0.95, bag.fromBody(dateMatch));
    } else if (ayer) {
      entities['incident_date'] = field(
        shiftDate(comm.receivedAt, -1),
        'INFERRED',
        0.76,
        bag.fromBody(ayer),
        'Inferida de "ayer" respecto a la fecha de recepción; requiere confirmación del empleado.',
      );
    } else if (hoy) {
      entities['incident_date'] = field(shiftDate(comm.receivedAt, 0), 'INFERRED', 0.8, bag.fromBody(hoy), 'Inferida de la fecha de recepción.');
    }
    const time = body.match(/a las (\d{1,2}([:.h]\d{2})?)/i);
    if (time) entities['incident_time'] = field(time[1] ?? time[0], 'EXPLICIT', 0.9, bag.fromBody(time));
    const loc = body.match(/(parking de [^.,\n]+|calle [^.,\n]+|avenida [^.,\n]+|carretera [^.,\n]+)/i);
    if (loc) entities['location'] = field(loc[0].trim(), 'EXPLICIT', 0.95, bag.fromBody(loc));
    const police = body.match(/[^.\n]*(policia|policía|atestado|guardia civil)[^.\n]*/i);
    if (police) entities['police_report'] = field(police[0].trim().slice(0, 200), 'EXPLICIT', 0.85, bag.fromBody(police));
    if (plate) entities['vehicle_plate'] = field(plate[0], 'EXPLICIT', 0.95, bag.fromBody(plate));
    const injury = body.match(/[^.\n]*(dolor|herid\w*|lesion\w*|lesión)[^.\n]*/i);
    if (injury) entities['injury_mentioned'] = field(injury[0].trim().slice(0, 200), 'EXPLICIT', 0.8, bag.fromBody(injury), 'Mención ambigua; requiere aclaración.');
  }

  if (workflow === 'POLICY_CANCELLATION') {
    const sale = body.match(/vend(i|ido|imos)[^.\n]*/i);
    const price = body.match(/[^.\n]*(precio|prima|caro|cara)[^.\n]*/i);
    if (sale) {
      entities['cancellation_reason'] = field('Venta del vehículo', 'EXPLICIT', 0.95, bag.fromBody(sale));
    } else if (price) {
      entities['cancellation_reason'] = field('Disconformidad con el precio', 'EXPLICIT', 0.85, bag.fromBody(price));
    }
    const eff = body.match(/(a partir del|con efecto|efecto del?)\s+([^.,\n]+)/i);
    if (eff && /\d/.test(eff[2] ?? '')) {
      entities['requested_effective_date'] = field((eff[2] ?? '').trim(), 'EXPLICIT', 0.85, bag.fromBody(eff));
    }
  }

  if (workflow === 'POLICY_AMENDMENT') {
    const driver = body.match(/[^.\n]*(conductor|hijo|hija)[^.\n]*/i);
    const bank = body.match(/[^.\n]*(cuenta|iban|domiciliacion|domiciliación)[^.\n]*/i);
    if (driver && /conductor/i.test(body)) {
      entities['requested_change'] = field('Añadir conductor', 'EXPLICIT', 0.9, bag.fromBody(driver));
      const age = body.match(/(\d{1,2}) an(o|̃o|os|̃os)|(\d{1,2}) años/i);
      if (age) entities['driver_age'] = field((age[1] ?? age[3]) ?? null, 'EXPLICIT', 0.9, bag.fromBody(age));
      const licence = body.match(/carnet[^.\n]*(\d{4})[^.\n]*/i);
      if (licence) entities['driver_licence_date'] = field(licence[1] ?? null, 'EXPLICIT', 0.85, bag.fromBody(licence));
    } else if (bank) {
      entities['requested_change'] = field('Cambio de cuenta bancaria', 'EXPLICIT', 0.9, bag.fromBody(bank));
      const iban = body.match(/ES[\d ]{6,30}/);
      if (iban) {
        entities['new_iban'] = field(iban[0].replace(/\s+/g, ''), 'EXPLICIT', 0.9, bag.fromBody(iban));
      }
    }
    if (dateMatch) entities['requested_effective_date'] = field(dateMatch[0], 'EXPLICIT', 0.85, bag.fromBody(dateMatch));
  }

  if (workflow === 'QUOTE_REQUEST') {
    const home = /vivienda|casa|piso|hogar|inmueble/i.test(body);
    const fleet = /flota|furgonetas|camiones/i.test(body);
    entities['product'] = field(
      fleet ? 'Flota' : home ? 'Hogar' : 'Por determinar',
      fleet || home ? 'EXPLICIT' : 'UNKNOWN',
      fleet || home ? 0.9 : 0.4,
      bag.manual(fleet ? 'mención de flota' : home ? 'mención de vivienda' : 'producto no identificado'),
    );
    const year = body.match(/(construid[oa] en|ano de construccion|año de construcción)[^\d]*(\d{4})/i);
    if (year) entities['construction_year'] = field(year[2] ?? null, 'EXPLICIT', 0.9, bag.fromBody(year));
    const soon = body.match(/la semana que viene|proxima semana|próxima semana/i);
    if (dateMatch) {
      entities['desired_start_date'] = field(dateMatch[0], 'EXPLICIT', 0.9, bag.fromBody(dateMatch));
    } else if (soon) {
      entities['desired_start_date'] = field(
        shiftDate(comm.receivedAt, 7),
        'INFERRED',
        0.7,
        bag.fromBody(soon),
        'Aproximada a una semana desde la recepción.',
      );
    }
  }

  if (workflow === 'RENEWAL_QUESTION') {
    const pct = body.match(/(\d{1,3})\s?%/);
    if (pct) entities['premium_increase_pct'] = field(pct[1] ?? null, 'EXPLICIT', 0.9, bag.fromBody(pct));
    const threat = body.match(/[^.\n]*(otra (compania|compañia|compañía)|competencia|me ire|me iré|plantear\w* la baja)[^.\n]*/i);
    if (threat) entities['cancellation_risk'] = field(threat[0].trim().slice(0, 200), 'EXPLICIT', 0.85, bag.fromBody(threat));
  }

  if (workflow === 'MISSING_DOCUMENT_FOLLOWUP') {
    const items: string[] = [];
    if (/factura/i.test(body)) items.push('factura de reparación');
    if (/foto/i.test(body)) items.push('fotos de los daños');
    if (/justificante|recibo/i.test(body)) items.push('justificante');
    if (items.length > 0) {
      entities['outstanding_items'] = field(items.join(', '), 'EXPLICIT', 0.85, bag.manual('documentos citados en el mensaje'));
    }
  }

  if (policyRef) entities['policy_reference'] = field(policyRef[0], 'EXPLICIT', 0.95, bag.fromBody(policyRef, policyRef[0]));

  return entities;
}

const SUMMARIES: Record<WorkflowType, string> = {
  MOTOR_CLAIM: 'El cliente comunica un incidente con su vehículo y aporta información inicial del siniestro.',
  POLICY_CANCELLATION: 'El cliente solicita la baja de una póliza.',
  POLICY_AMENDMENT: 'El cliente solicita una modificación de su póliza.',
  QUOTE_REQUEST: 'El cliente solicita presupuesto para un nuevo seguro.',
  RENEWAL_QUESTION: 'El cliente plantea una consulta sobre la renovación o la prima de su póliza.',
  MISSING_DOCUMENT_FOLLOWUP: 'El mensaje se refiere a documentación pendiente de un expediente abierto.',
  UNKNOWN: 'El mensaje no corresponde a un caso operativo de seguros identificable.',
};

function suggestAction(workflow: WorkflowType, entities: Record<string, ExtractedField>, text: string): { code: string; rationale: string } {
  switch (workflow) {
    case 'MOTOR_CLAIM':
      return entities['incident_time']
        ? { code: 'PREPARE_CLAIM_OPENING', rationale: 'Datos principales presentes; preparar apertura para revisión.' }
        : { code: 'REQUEST_CLAIM_DETAILS', rationale: 'Faltan datos del siniestro (hora exacta u otros); pedirlos al cliente.' };
    case 'POLICY_CANCELLATION':
      return entities['requested_effective_date']
        ? { code: 'PREPARE_CANCELLATION_SUMMARY', rationale: 'Solicitud completa; preparar resumen para tramitación humana.' }
        : { code: 'REQUEST_CANCELLATION_CONFIRMATION', rationale: 'Falta la fecha de efecto y la confirmación firmada.' };
    case 'POLICY_AMENDMENT': {
      const needsLicence = /conductor/i.test(text) && !entities['driver_licence_date'];
      const iban = entities['new_iban']?.value ?? '';
      const badIban = /iban|cuenta/i.test(text) && !/^ES\d{22}$/.test(iban.replace(/\s+/g, ''));
      return needsLicence || badIban
        ? { code: 'REQUEST_AMENDMENT_DETAILS', rationale: 'Faltan datos necesarios para la modificación.' }
        : { code: 'PREPARE_AMENDMENT_SUMMARY', rationale: 'Cambio identificado; preparar resumen para revisión.' };
    }
    case 'QUOTE_REQUEST': {
      const home = /vivienda|casa|piso|hogar/i.test(text);
      const fleet = /flota/i.test(text);
      const missingYear = home && !entities['construction_year'];
      return missingYear
        ? { code: 'REQUEST_QUOTE_DETAILS', rationale: 'Falta información de riesgo (p. ej. año de construcción).' }
        : { code: 'ROUTE_TO_QUOTATION', rationale: fleet ? 'Trasladar al proceso de cotización de flotas.' : 'Información suficiente para el proceso de cotización aprobado.' };
    }
    case 'RENEWAL_QUESTION':
      return entities['cancellation_risk']
        ? { code: 'ROUTE_TO_RETENTION_REVIEW', rationale: 'Riesgo de anulación detectado; revisión de retención humana, sin recotización automática.' }
        : { code: 'PREPARE_RENEWAL_CONTEXT', rationale: 'Preparar contexto de renovación para respuesta humana.' };
    case 'MISSING_DOCUMENT_FOLLOWUP':
      return { code: 'REQUEST_MISSING_DOCUMENTS', rationale: 'Solicitar al cliente los documentos pendientes identificados.' };
    default:
      return { code: 'NO_ACTION_NOT_OPERATIONAL', rationale: 'El mensaje no genera un caso operativo.' };
  }
}

export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'mock-deterministic-v1';
  readonly promptVersions = promptRegistry.currentVersions();

  async analyseCase(input: AnalyseCaseInput): Promise<unknown> {
    const comm = input.communication;
    const text = norm(`${comm.subject}\n${comm.bodyText}`);
    const { workflow, confidence, secondary } = classify(text);
    const bag = new EvidenceBag(comm);
    const entities = extractEntities(workflow, comm, bag);
    const action = suggestAction(workflow, entities, comm.bodyText);

    const riskFlags: string[] = [];
    for (const [key, f] of Object.entries(entities)) {
      if (f.status === 'INFERRED') riskFlags.push(`El campo ${key} es inferido y requiere confirmación del empleado.`);
    }
    if (workflow === 'MOTOR_CLAIM' && entities['injury_mentioned']) {
      riskFlags.push('Posible daño personal mencionado de forma ambigua; requiere aclaración humana.');
    }

    return {
      workflow,
      workflowConfidence: confidence,
      secondaryWorkflows: secondary,
      summary: SUMMARIES[workflow],
      entities,
      evidence: bag.evidence,
      customerCandidates: [],
      policyCandidates: [],
      missingInformation: [],
      riskFlags,
      suggestedActionCode: action.code,
      suggestedActionRationale: action.rationale,
      externalActionAllowed: false,
    };
  }

  async rankCandidates(input: RankCandidatesInput): Promise<unknown> {
    // Deterministic: trust the supplied deterministic scores and keep their order.
    return {
      rankedCustomerIds: input.customerCandidates.map((c) => c.id),
      rankedPolicyIds: input.policyCandidates.map((c) => c.id),
      rationale: 'Orden mantenido según las señales deterministas de búsqueda.',
    };
  }

  async draftResponse(input: DraftResponseInput): Promise<unknown> {
    const { analysis, missingInformation } = input;
    const customer = analysis.customerCandidates[0]?.label ?? null;
    const greeting = customer ? `Estimado/a ${customer.split(' ')[0]}:` : 'Estimado/a cliente:';

    const intro: Record<string, string> = {
      MOTOR_CLAIM: 'Gracias por comunicarnos el incidente de su vehículo. Lamentamos lo ocurrido y ya estamos revisando la información recibida.',
      POLICY_CANCELLATION: 'Hemos recibido su solicitud de baja y la estamos tramitando con nuestro equipo.',
      POLICY_AMENDMENT: 'Hemos recibido su solicitud de modificación de la póliza.',
      QUOTE_REQUEST: 'Gracias por su interés. Con mucho gusto prepararemos un presupuesto adaptado a sus necesidades.',
      RENEWAL_QUESTION: 'Gracias por su mensaje sobre la renovación de su póliza. Entendemos su consulta y queremos ayudarle.',
      MISSING_DOCUMENT_FOLLOWUP: 'Le escribimos en relación con la documentación pendiente de su expediente.',
      UNKNOWN: 'Hemos recibido su mensaje.',
    };

    const questions = missingInformation.map((m) => `- ¿Podría facilitarnos ${m.label.toLowerCase()}?`);
    const placeholders = missingInformation.map((m) => `[${m.key.toUpperCase()}]`);

    const closing =
      missingInformation.length > 0
        ? 'Para poder continuar, le agradeceríamos que nos enviara la información indicada respondiendo a este correo.'
        : 'Le mantendremos informado/a del siguiente paso en cuanto nuestro equipo complete la revisión.';

    const body = [
      greeting,
      '',
      intro[analysis.workflow] ?? intro['UNKNOWN'],
      ...(questions.length > 0 ? ['', 'Para avanzar necesitamos:', ...questions] : []),
      '',
      closing,
      '',
      'Atentamente,',
      'Equipo de Operaciones · Rosillo Hermanos',
      '(BORRADOR INTERNO — pendiente de revisión y aprobación por un empleado; este sistema no envía correos)',
    ].join('\n');

    return { language: 'es', tone: input.tone, body, placeholders };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { ok: true, provider: this.name, model: this.model };
  }
}
