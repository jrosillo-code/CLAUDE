import type { WorkflowType } from '../types';
import type { CaseAnalysis, MissingInformationItem } from '../schemas';

/**
 * Versioned deterministic missing-information rules (FR-007, spec section 07).
 * Rules run over the validated analysis, never over raw model output, and their
 * verdicts overwrite whatever the model proposed for missing_information.
 */

export const MISSING_INFO_RULES_VERSION = 'rules-v1';

interface RuleContext {
  workflow: WorkflowType;
  entities: CaseAnalysis['entities'];
  attachmentFilenames: string[];
  bodyText: string;
}

interface Rule {
  id: string;
  workflow: WorkflowType;
  evaluate(ctx: RuleContext): MissingInformationItem | null;
}

function fieldMissing(ctx: RuleContext, key: string): boolean {
  const f = ctx.entities[key];
  return !f || f.value === null || f.status === 'UNKNOWN';
}

function fieldInferred(ctx: RuleContext, key: string): boolean {
  const f = ctx.entities[key];
  return !!f && f.status === 'INFERRED';
}

function item(
  ruleId: string,
  key: string,
  label: string,
  severity: 'REQUIRED' | 'RECOMMENDED',
): MissingInformationItem {
  return { key, label, severity, ruleId };
}

const bodyMentions = (ctx: RuleContext, patterns: RegExp[]) =>
  patterns.some((p) => p.test(ctx.bodyText));

const hasAttachmentLike = (ctx: RuleContext, pattern: RegExp) =>
  ctx.attachmentFilenames.some((f) => pattern.test(f));

const RULES: Rule[] = [
  // ── Motor claim ────────────────────────────────────────────────────────────
  {
    id: 'MC-001-incident-time',
    workflow: 'MOTOR_CLAIM',
    evaluate: (ctx) =>
      fieldMissing(ctx, 'incident_time') || fieldInferred(ctx, 'incident_date')
        ? item('MC-001-incident-time', 'exact_incident_time', 'Hora exacta del incidente', 'REQUIRED')
        : null,
  },
  {
    id: 'MC-002-police-report',
    workflow: 'MOTOR_CLAIM',
    evaluate: (ctx) =>
      fieldMissing(ctx, 'police_report')
        ? item('MC-002-police-report', 'police_report', 'Si existe parte policial o de seguridad', 'RECOMMENDED')
        : null,
  },
  {
    id: 'MC-003-photos',
    workflow: 'MOTOR_CLAIM',
    evaluate: (ctx) =>
      hasAttachmentLike(ctx, /foto|photo|\.jpe?g$|\.png$/i)
        ? null
        : item('MC-003-photos', 'damage_photos', 'Fotos de los daños', 'REQUIRED'),
  },
  {
    id: 'MC-004-repair-workshop',
    workflow: 'MOTOR_CLAIM',
    evaluate: (ctx) =>
      fieldMissing(ctx, 'repair_workshop')
        ? item('MC-004-repair-workshop', 'preferred_repair_workshop', 'Taller de reparación preferido', 'RECOMMENDED')
        : null,
  },
  {
    id: 'MC-005-injury-details',
    workflow: 'MOTOR_CLAIM',
    evaluate: (ctx) =>
      bodyMentions(ctx, [/herid|lesion|lesión|dolor|daño personal/i]) && fieldMissing(ctx, 'injury_details')
        ? item('MC-005-injury-details', 'injury_details', 'Detalle de posibles lesiones personales', 'REQUIRED')
        : null,
  },
  {
    id: 'MC-006-third-party',
    workflow: 'MOTOR_CLAIM',
    evaluate: (ctx) =>
      bodyMentions(ctx, [/otro (vehículo|vehiculo|coche|conductor)|tercero|contrario/i]) &&
      fieldMissing(ctx, 'third_party_details')
        ? item('MC-006-third-party', 'third_party_details', 'Datos del tercero implicado', 'RECOMMENDED')
        : null,
  },

  // ── Cancellation ───────────────────────────────────────────────────────────
  {
    id: 'CA-001-effective-date',
    workflow: 'POLICY_CANCELLATION',
    evaluate: (ctx) =>
      fieldMissing(ctx, 'requested_effective_date')
        ? item('CA-001-effective-date', 'requested_effective_date', 'Fecha de efecto solicitada para la baja', 'REQUIRED')
        : null,
  },
  {
    id: 'CA-002-signed-instruction',
    workflow: 'POLICY_CANCELLATION',
    evaluate: (ctx) =>
      hasAttachmentLike(ctx, /firmad|signed|instruccion/i)
        ? null
        : item('CA-002-signed-instruction', 'signed_instruction', 'Instrucción de baja firmada', 'REQUIRED'),
  },
  {
    id: 'CA-003-sale-proof',
    workflow: 'POLICY_CANCELLATION',
    evaluate: (ctx) =>
      bodyMentions(ctx, [/vend(í|i|ido|imos)|venta del/i]) && !hasAttachmentLike(ctx, /venta|sale|contrato|contract/i)
        ? item('CA-003-sale-proof', 'sale_proof', 'Justificante de venta del vehículo', 'REQUIRED')
        : null,
  },

  // ── Amendment ──────────────────────────────────────────────────────────────
  {
    id: 'AM-001-effective-date',
    workflow: 'POLICY_AMENDMENT',
    evaluate: (ctx) =>
      fieldMissing(ctx, 'requested_effective_date')
        ? item('AM-001-effective-date', 'requested_effective_date', 'Fecha de efecto de la modificación', 'RECOMMENDED')
        : null,
  },
  {
    id: 'AM-002-driver-licence',
    workflow: 'POLICY_AMENDMENT',
    evaluate: (ctx) =>
      bodyMentions(ctx, [/conductor|hijo|hija|carnet|licencia/i]) && fieldMissing(ctx, 'driver_licence_date')
        ? item('AM-002-driver-licence', 'driver_licence_date', 'Fecha de carnet del nuevo conductor', 'REQUIRED')
        : null,
  },
  {
    id: 'AM-003-valid-iban',
    workflow: 'POLICY_AMENDMENT',
    evaluate: (ctx) => {
      if (!bodyMentions(ctx, [/iban|cuenta|banco|domiciliaci/i])) return null;
      const iban = ctx.entities['new_iban'];
      const valid = !!iban?.value && /^ES\d{22}$/.test(iban.value.replace(/\s+/g, ''));
      return valid
        ? null
        : item('AM-003-valid-iban', 'complete_iban', 'IBAN completo y válido (ES + 22 dígitos)', 'REQUIRED');
    },
  },
  {
    id: 'AM-004-supporting-docs',
    workflow: 'POLICY_AMENDMENT',
    evaluate: (ctx) =>
      ctx.attachmentFilenames.length === 0
        ? item('AM-004-supporting-docs', 'supporting_documents', 'Documentación que acredite el cambio', 'RECOMMENDED')
        : null,
  },

  // ── Quote request ──────────────────────────────────────────────────────────
  {
    id: 'QU-001-construction-year',
    workflow: 'QUOTE_REQUEST',
    evaluate: (ctx) =>
      bodyMentions(ctx, [/vivienda|casa|piso|hogar|inmueble/i]) && fieldMissing(ctx, 'construction_year')
        ? item('QU-001-construction-year', 'construction_year', 'Año de construcción de la vivienda', 'REQUIRED')
        : null,
  },
  {
    id: 'QU-002-start-date',
    workflow: 'QUOTE_REQUEST',
    evaluate: (ctx) =>
      fieldMissing(ctx, 'desired_start_date')
        ? item('QU-002-start-date', 'desired_start_date', 'Fecha de inicio deseada', 'RECOMMENDED')
        : null,
  },
  {
    id: 'QU-003-fleet-list',
    workflow: 'QUOTE_REQUEST',
    evaluate: (ctx) =>
      bodyMentions(ctx, [/flota|vehículos|vehiculos|furgonetas|camiones/i]) &&
      !hasAttachmentLike(ctx, /\.xlsx?$|\.csv$|listado|lista|vehic/i)
        ? item('QU-003-fleet-list', 'vehicle_list', 'Listado de vehículos de la flota', 'REQUIRED')
        : null,
  },

  // ── Renewal question ───────────────────────────────────────────────────────
  {
    id: 'RE-001-policy-reference',
    workflow: 'RENEWAL_QUESTION',
    evaluate: (ctx) =>
      fieldMissing(ctx, 'policy_reference')
        ? item('RE-001-policy-reference', 'policy_reference', 'Referencia de la póliza afectada', 'RECOMMENDED')
        : null,
  },

  // ── Missing-document follow-up ─────────────────────────────────────────────
  {
    id: 'MD-001-outstanding-items',
    workflow: 'MISSING_DOCUMENT_FOLLOWUP',
    evaluate: (ctx) =>
      fieldMissing(ctx, 'outstanding_items')
        ? item('MD-001-outstanding-items', 'outstanding_items', 'Identificación de los documentos pendientes', 'REQUIRED')
        : null,
  },
];

export function evaluateMissingInformation(ctx: RuleContext): MissingInformationItem[] {
  return RULES.filter((r) => r.workflow === ctx.workflow)
    .map((r) => r.evaluate(ctx))
    .filter((x): x is MissingInformationItem => x !== null);
}

export function listRules(): { id: string; workflow: WorkflowType }[] {
  return RULES.map(({ id, workflow }) => ({ id, workflow }));
}
