export { MockProvider } from './mock/mockProvider';
export { AnthropicProvider } from './anthropic/anthropicProvider';
export { promptRegistry, type PromptName, type PromptTemplate } from './prompts/registry';
export { runEvaluation, formatEvaluationReport, type EvaluationResult } from './evaluation/evaluate';
export {
  MIN_OCR_CONFIDENCE,
  PassthroughExtractor,
  MockOcrAdapter,
  type AttachmentExtractor,
  type ExtractionResult,
} from './extraction/attachmentExtractor';

import type { AIProvider } from '@rosillo/domain';
import { MockProvider } from './mock/mockProvider';
import { AnthropicProvider } from './anthropic/anthropicProvider';

/** Resolve the configured provider. Defaults to the deterministic mock (ADR-0003). */
export function createProvider(kind?: string): AIProvider {
  const selected = kind ?? process.env.AI_PROVIDER ?? 'mock';
  if (selected === 'anthropic') return new AnthropicProvider();
  return new MockProvider();
}
