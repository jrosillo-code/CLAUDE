import type { FieldBrief } from "./assemble";

// The optional warm voice. With ANTHROPIC_API_KEY set, Claude receives ONLY
// the assembled brief as JSON and is told to rewrite it, forbidden from adding
// any rule, number, place or claim that is not in it. Without a key this
// returns undefined and the panel shows the structured cards — fully usable.

export interface NarrativeDeps {
  apiKey?: string | undefined;
  /** Injected in tests; defaults to the Anthropic SDK. */
  complete?: (system: string, user: string) => Promise<string>;
}

export const NARRATIVE_SYSTEM =
  "You rewrite a drone field brief in a warm, plain voice for a traveling photographer. " +
  "You are given the brief as JSON. Write at most 120 words of prose. " +
  "Hard rules: never add a rule, number, date, place, authority, or claim that is not in the JSON; " +
  "never say 'legal' or 'allowed' — say 'as of {date}, per {source}' exactly as the JSON phrases it; " +
  "if legality.covered is false, say the country is not yet covered and do not guess; " +
  "if wind is unavailable, say so briefly; never invent nearby pins or quotes. Plain text only.";

export async function narrativeFor(brief: FieldBrief, deps: NarrativeDeps = {}): Promise<string | undefined> {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return undefined;
  const complete = deps.complete ?? defaultComplete;
  try {
    const payload = stripForPrompt(brief);
    const text = await complete(NARRATIVE_SYSTEM, JSON.stringify(payload));
    return vetNarrative(text, payload);
  } catch (e) {
    console.error("field-brief: narrative failed, serving the live brief", e);
    return undefined;
  }
}

// Words that turn a rewrite into advice. The brief phrases legality as
// "as of {date}, per {source}"; the voice may not upgrade that to a verdict.
const ADVICE = /\b(legal|illegal|allowed|permitted|forbidden|safe to fly|you can fly|you may fly|go ahead|cleared|clearance)\b/i;

/**
 * Accept the model's text only if it is plain prose that adds nothing: no
 * advice words, no number that isn't already in the evidence it was given,
 * no structured output. Anything else is dropped and the live cards stand.
 */
export function vetNarrative(text: unknown, evidence: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  const t = text.trim();
  if (!t || t.length > 1200) return undefined;
  if (/[{}<>\[\]]|```/.test(t)) return undefined; // JSON, markup, fences
  if (ADVICE.test(t)) return undefined;
  const allowed = new Set((JSON.stringify(evidence).match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ".")));
  for (const n of t.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    const norm = n.replace(",", ".");
    // "24.1426° N" may surface as 24.14 or 24 — accept prefixes of known numbers
    if (![...allowed].some((a) => a === norm || a.startsWith(norm))) return undefined;
  }
  return t;
}

/** Only what the voice needs: no full hourly wind table, no URLs to echo. */
function stripForPrompt(b: FieldBrief) {
  const wind = "unavailable" in b.wind
    ? { unavailable: true, reason: b.wind.reason }
    : {
        unit: b.wind.unit,
        maxGust: Math.max(...b.wind.hours.map((h) => h.gust10m)),
        calmHours: b.wind.hours.filter((h) => h.gust10m < 30).length,
      };
  return { place: b.place, legality: b.legality, light: b.light, wind, nearby: b.nearby };
}

async function defaultComplete(system: string, user: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: user }],
  });
  return message.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
}
