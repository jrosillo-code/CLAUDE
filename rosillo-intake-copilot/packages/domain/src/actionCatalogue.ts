import type { WorkflowType } from './types';

/**
 * The enumerated action catalogue (spec FR-008). The AI may only recommend one of these codes;
 * anything else is rejected at validation time. None of them execute anything — they are
 * suggestions for a human employee.
 */
export const ACTION_CATALOGUE = {
  REQUEST_CLAIM_DETAILS: 'Pedir al cliente los datos que faltan del siniestro',
  PREPARE_CLAIM_OPENING: 'Preparar el resumen de apertura de siniestro para revisión',
  REQUEST_CANCELLATION_CONFIRMATION: 'Pedir confirmación firmada y fecha de efecto de la baja',
  PREPARE_CANCELLATION_SUMMARY: 'Preparar resumen de baja para tramitación humana',
  REQUEST_AMENDMENT_DETAILS: 'Pedir los datos o documentos que faltan para la modificación',
  PREPARE_AMENDMENT_SUMMARY: 'Preparar resumen de la modificación solicitada',
  REQUEST_QUOTE_DETAILS: 'Pedir la información de riesgo que falta para cotizar',
  ROUTE_TO_QUOTATION: 'Trasladar al proceso de cotización aprobado',
  PREPARE_RENEWAL_CONTEXT: 'Preparar contexto de renovación para revisión humana',
  ROUTE_TO_RETENTION_REVIEW: 'Trasladar a revisión de retención (sin recotización automática)',
  REQUEST_MISSING_DOCUMENTS: 'Solicitar al cliente los documentos pendientes',
  NO_ACTION_NOT_OPERATIONAL: 'Sin acción: el mensaje no es un caso operativo',
  ESCALATE_TO_SUPERVISOR: 'Escalar a supervisión',
} as const;

export type ActionCode = keyof typeof ACTION_CATALOGUE;
export const ACTION_CODES = Object.keys(ACTION_CATALOGUE) as ActionCode[];

/** Actions the system must never suggest as executed, per workflow (spec section 14 fixtures). */
export const PROHIBITED_ACTIONS = [
  'CANCEL_POLICY',
  'AMEND_POLICY',
  'SEND_EMAIL',
  'ISSUE_QUOTE',
  'BIND_COVERAGE',
  'APPROVE_CLAIM',
  'DENY_CLAIM',
  'REPRICE_POLICY',
] as const;
export type ProhibitedAction = (typeof PROHIBITED_ACTIONS)[number];

/** Which catalogue actions are plausible per workflow — used to sanity-check provider output. */
export const WORKFLOW_ACTIONS: Record<WorkflowType, ActionCode[]> = {
  MOTOR_CLAIM: ['REQUEST_CLAIM_DETAILS', 'PREPARE_CLAIM_OPENING', 'ESCALATE_TO_SUPERVISOR'],
  POLICY_CANCELLATION: [
    'REQUEST_CANCELLATION_CONFIRMATION',
    'PREPARE_CANCELLATION_SUMMARY',
    'ROUTE_TO_RETENTION_REVIEW',
    'ESCALATE_TO_SUPERVISOR',
  ],
  POLICY_AMENDMENT: ['REQUEST_AMENDMENT_DETAILS', 'PREPARE_AMENDMENT_SUMMARY', 'ESCALATE_TO_SUPERVISOR'],
  QUOTE_REQUEST: ['REQUEST_QUOTE_DETAILS', 'ROUTE_TO_QUOTATION', 'ESCALATE_TO_SUPERVISOR'],
  RENEWAL_QUESTION: ['PREPARE_RENEWAL_CONTEXT', 'ROUTE_TO_RETENTION_REVIEW', 'ESCALATE_TO_SUPERVISOR'],
  MISSING_DOCUMENT_FOLLOWUP: ['REQUEST_MISSING_DOCUMENTS', 'ESCALATE_TO_SUPERVISOR'],
  UNKNOWN: ['NO_ACTION_NOT_OPERATIONAL', 'ESCALATE_TO_SUPERVISOR'],
};
