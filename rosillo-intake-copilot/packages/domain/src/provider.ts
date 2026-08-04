import type { CommunicationInput, CandidateMatch, WorkflowType } from './types';
import type { CaseAnalysis, CandidateRanking, ResponseDraft, MissingInformationItem } from './schemas';

/**
 * Provider-neutral AI interface (spec section 11). Implementations live in @rosillo/ai.
 * The pipeline treats every provider as untrusted: outputs are schema-validated and
 * constrained after the call.
 */

export interface AnalyseCaseInput {
  communication: CommunicationInput;
  /** Names of the workflows the classifier may choose from. */
  allowedWorkflows: readonly WorkflowType[];
}

export interface RankCandidatesInput {
  communication: CommunicationInput;
  analysis: CaseAnalysis;
  customerCandidates: CandidateMatch[];
  policyCandidates: CandidateMatch[];
}

export interface DraftResponseInput {
  communication: CommunicationInput;
  analysis: CaseAnalysis;
  missingInformation: MissingInformationItem[];
  tone: 'FORMAL' | 'WARM';
}

export interface ProviderHealth {
  ok: boolean;
  provider: string;
  model: string;
  detail?: string;
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly promptVersions: Record<string, string>;
  analyseCase(input: AnalyseCaseInput): Promise<unknown>;
  rankCandidates(input: RankCandidatesInput): Promise<unknown>;
  draftResponse(input: DraftResponseInput): Promise<unknown>;
  healthCheck(): Promise<ProviderHealth>;
  /** Cumulative token usage, when the provider can report it (live providers only). */
  getUsage?(): ProviderUsage;
}

export interface ResponseDraftResult extends ResponseDraft {}
export interface CandidateRankingResult extends CandidateRanking {}
