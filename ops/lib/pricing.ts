// USD per million tokens. Verified against platform.claude.com pricing on
// 2026-09-11; re-check when changing models. Used only for cost estimates in
// the audit log and budget alerts, never for billing.
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
}

export const PRICES: Record<string, ModelPrice> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5"];
  const uncachedInput = Math.max(0, inputTokens - cacheReadTokens);
  return (
    (uncachedInput * p.input + cacheReadTokens * p.cacheRead + outputTokens * p.output) /
    1_000_000
  );
}
