import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  AnalyseCaseInput,
  DraftResponseInput,
  RankCandidatesInput,
  ProviderHealth,
  ProviderUsage,
} from '@rosillo/domain';
import { promptRegistry } from '../prompts/registry';

/**
 * Live AI provider (M3). Server-side only — the API key never reaches the browser.
 * Outputs are returned as parsed JSON and validated by the pipeline (with one
 * repair retry) exactly like the mock provider's outputs. Never used in CI.
 */

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  readonly model: string;
  readonly promptVersions = promptRegistry.currentVersions();
  private client: Anthropic;
  private usage: ProviderUsage = { inputTokens: 0, outputTokens: 0, requests: 0 };

  constructor(opts?: { apiKey?: string; model?: string }) {
    const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('AnthropicProvider requires ANTHROPIC_API_KEY (server-side only).');
    this.model = opts?.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';
    // Bounded request timeout so a slow provider degrades gracefully instead of
    // hanging an analysis job (the pipeline adds its own overall timeout).
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  }

  getUsage(): ProviderUsage {
    return { ...this.usage };
  }

  private async completeJson(system: string, user: string): Promise<unknown> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    });
    this.usage.requests += 1;
    this.usage.inputTokens += response.usage.input_tokens;
    this.usage.outputTokens += response.usage.output_tokens;
    if (response.stop_reason === 'refusal') {
      throw new Error('Provider declined the request (refusal stop reason).');
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const jsonText = text.replace(/^```(json)?\s*/i, '').replace(/\s*```\s*$/, '');
    return JSON.parse(jsonText);
  }

  async analyseCase(input: AnalyseCaseInput): Promise<unknown> {
    const prompt = promptRegistry.get('CASE_ANALYST');
    const payload = {
      task: 'Analyse the following synthetic insurance communication.',
      allowed_workflows: input.allowedWorkflows,
      output_schema_hint: {
        workflow: 'one of allowed_workflows',
        workflowConfidence: '0..1',
        secondaryWorkflows: 'array, max 2',
        summary: 'short operational summary in Spanish',
        entities: '{ [key]: { value, status: EXPLICIT|INFERRED|UNKNOWN, confidence, evidenceIds, note } }',
        evidence: '[{ id, sourceType: EMAIL_SUBJECT|EMAIL_BODY|ATTACHMENT, sourceId, quote, offsets|null }]',
        customerCandidates: '[] (always empty — matching is done outside the model)',
        policyCandidates: '[] (always empty)',
        missingInformation: '[] (always empty — deterministic rules decide)',
        riskFlags: 'array of short strings',
        suggestedActionCode: 'a catalogue action code',
        suggestedActionRationale: 'short string',
        externalActionAllowed: false,
      },
      communication: {
        id: input.communication.id,
        from: input.communication.from,
        subject: input.communication.subject,
        body: input.communication.bodyText,
        received_at: input.communication.receivedAt,
        attachments: input.communication.attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          mime_type: a.mimeType,
          text: a.text.slice(0, 20000),
        })),
      },
    };
    return this.completeJson(prompt.text, JSON.stringify(payload));
  }

  async rankCandidates(input: RankCandidatesInput): Promise<unknown> {
    const prompt = promptRegistry.get('CANDIDATE_RANKER');
    const payload = {
      summary: input.analysis.summary,
      workflow: input.analysis.workflow,
      communication_subject: input.communication.subject,
      customer_candidates: input.customerCandidates,
      policy_candidates: input.policyCandidates,
    };
    return this.completeJson(prompt.text, JSON.stringify(payload));
  }

  async draftResponse(input: DraftResponseInput): Promise<unknown> {
    const prompt = promptRegistry.get('RESPONSE_DRAFTER');
    const payload = {
      workflow: input.analysis.workflow,
      summary: input.analysis.summary,
      tone: input.tone,
      confirmed_entities: Object.fromEntries(
        Object.entries(input.analysis.entities).filter(([, f]) => f.status === 'EXPLICIT'),
      ),
      missing_information: input.missingInformation,
      customer_label: input.analysis.customerCandidates[0]?.label ?? null,
    };
    return this.completeJson(prompt.text, JSON.stringify(payload));
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Say OK.' }],
      });
      return { ok: true, provider: this.name, model: this.model };
    } catch (err) {
      return { ok: false, provider: this.name, model: this.model, detail: err instanceof Error ? err.message : 'unknown' };
    }
  }
}
