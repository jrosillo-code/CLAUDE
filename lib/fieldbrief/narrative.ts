import { weatherSummary } from "./weather";
import type { FieldBrief } from "./assemble";

// The optional warm voice, made safe by construction. A prompt that says
// "add nothing" and a filter that bans words and unknown numbers cannot
// guarantee that generated prose is grounded — a rewrite can still invent a
// claim without a number in it. So the model never writes displayed text:
// code composes every candidate sentence from the evidence, and the model
// only CHOOSES which of them to show, by index. An invalid, duplicated or
// out-of-range answer, or anything that is not a JSON array of integers,
// drops the narrative and the structured cards stand on their own. Without
// ANTHROPIC_API_KEY nothing is called.

export interface NarrativeDeps {
  apiKey?: string | undefined;
  /** Injected in tests; defaults to the Anthropic SDK. */
  complete?: (system: string, user: string) => Promise<string>;
}

export const MAX_PICKS = 4;

export const NARRATIVE_SYSTEM =
  "You are choosing which sentences of a drone field brief to show a traveling photographer. " +
  "You will receive a numbered list of sentences that were composed from verified data. " +
  `Reply with ONLY a JSON array of at most ${MAX_PICKS} distinct sentence numbers, most useful first, e.g. [2,0,5]. ` +
  "Do not write any sentence of your own. Do not add words, numbers or explanations outside the array.";

const hhmm = (iso: string | null | undefined) =>
  iso ? new Date(iso).toISOString().slice(11, 16) + " UTC" : null;

/**
 * Every sentence the narrative may consist of, each derived from one piece of
 * the assembled brief. Nothing here can say more than the cards do.
 */
export function candidateSentences(b: FieldBrief): string[] {
  const out: string[] = [];
  const L = b.legality;
  if (L.covered) {
    out.push(`Rules for ${L.countryName} are shown ${L.asOf}${L.stale ? ", and they need re-verification" : ""}.`);
    const word = (v: boolean | null) => (v === null ? "depends on the operation" : v ? "is required" : "is not required");
    out.push(`Registration ${word(L.registrationRequired.value)}; a pilot certificate ${word(L.pilotCertRequired.value)}; insurance ${word(L.insuranceRequired.value)}.`);
    if (L.maxAltitudeM != null) out.push(`The general ceiling is ${L.maxAltitudeM} m above ground, ${L.maxDistanceRule.replace(/\.$/, "")}.`);
    if (L.noFlyHighlights.length) out.push(`Places most often off limits: ${L.noFlyHighlights.join("; ")}.`);
    out.push(`Waypoint does not check airspace; ${L.nationalApp ? L.nationalApp.name : L.authority.name} does.`);
  } else {
    out.push(`${L.countryCode ?? "This country"} is not yet covered: no rules are shown rather than a guess.`);
  }
  const lt = b.light;
  if (lt.polar === "day") out.push("The sun never sets on this date here — polar day, no golden hour.");
  else if (lt.polar === "night") out.push("The sun never rises on this date here — polar night.");
  else {
    if (lt.sunrise && lt.sunset) out.push(`Sunrise is at ${hhmm(lt.sunrise)} and sunset at ${hhmm(lt.sunset)}.`);
    if (lt.goldenPm) out.push(`Evening golden hour runs ${hhmm(lt.goldenPm[0])} to ${hhmm(lt.goldenPm[1])}${lt.sunAzimuthAtGoldenPm != null ? `, with the sun at ${lt.sunAzimuthAtGoldenPm}°` : ""}.`);
    if (lt.goldenAm) out.push(`Morning golden hour runs ${hhmm(lt.goldenAm[0])} to ${hhmm(lt.goldenAm[1])}.`);
  }
  if ("unavailable" in b.wind) out.push(`Wind is unavailable for this date: ${b.wind.reason}`);
  else {
    const calm = b.wind.hours.filter((h) => Number.isFinite(h.gust10m) && h.gust10m >= 0 && h.gust10m < 30);
    const maxGust = Math.max(...b.wind.hours.map((h) => h.gust10m));
    out.push(calm.length ? `${calm.length} of ${b.wind.hours.length} forecast hours have gusts under 30 km/h; the day's maximum gust is ${Math.round(maxGust)} km/h.` : `No forecast hour has gusts under 30 km/h; the maximum is ${Math.round(maxGust)} km/h.`);
  }
  if (!("unavailable" in b.wind)) {
    const w = weatherSummary(b.wind.hours);
    if (w) {
      out.push(w.rainHours === 0
        ? `The sky reads ${w.dominant.label.toLowerCase()} for the day with no forecast hour likely to be wet.`
        : `The sky reads mostly ${w.dominant.label.toLowerCase()}, with ${w.rainHours} of ${w.totalHours} forecast hours likely wet.`);
      if (w.tempMinC != null && w.tempMaxC != null) out.push(`Temperatures run from ${Math.round(w.tempMinC)} to ${Math.round(w.tempMaxC)} °C.`);
    }
  }
  if (b.airfields.length) {
    const a = b.airfields[0];
    out.push(`The nearest listed airfield is ${a.name}${a.iata ? ` (${a.iata})` : ""}, about ${Math.round(a.distanceKm)} km away — a distance, not an airspace check.`);
  }
  const n = b.nearby;
  if (n.scoutPins.length || n.reports.length) {
    out.push(`Your circle has ${n.scoutPins.length} scout ${n.scoutPins.length === 1 ? "pin" : "pins"} and ${n.reports.length} field ${n.reports.length === 1 ? "report" : "reports"} near here.`);
  } else {
    out.push("Nobody in your circle has scouted or reported here yet.");
  }
  return out;
}

/** Parse the model's pick. Anything but a valid, distinct index array is rejected. */
export function selectNarrative(raw: unknown, sentences: readonly string[]): string | undefined {
  if (typeof raw !== "string") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > MAX_PICKS) return undefined;
  if (parsed.some((i) => !Number.isInteger(i) || (i as number) < 0 || (i as number) >= sentences.length)) return undefined;
  const picks = [...new Set(parsed as number[])];
  return picks.map((i) => sentences[i]).join(" ");
}

export async function narrativeFor(brief: FieldBrief, deps: NarrativeDeps = {}): Promise<string | undefined> {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return undefined;
  const complete = deps.complete ?? defaultComplete;
  const sentences = candidateSentences(brief);
  try {
    const raw = await complete(NARRATIVE_SYSTEM, sentences.map((s, i) => `${i}. ${s}`).join("\n"));
    return selectNarrative(raw, sentences);
  } catch (e) {
    console.error("field-brief: narrative selection failed, serving the live brief", e);
    return undefined;
  }
}

async function defaultComplete(system: string, user: string): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 60,
    system,
    messages: [{ role: "user", content: user }],
  });
  return message.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
}
