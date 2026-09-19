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
    const text = await complete(NARRATIVE_SYSTEM, JSON.stringify(stripForPrompt(brief)));
    const trimmed = text.trim();
    return trimmed ? trimmed.slice(0, 1200) : undefined;
  } catch (e) {
    console.error("field-brief: narrative failed, serving the live brief", e);
    return undefined;
  }
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
