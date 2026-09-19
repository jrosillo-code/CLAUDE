// World lists: curated "best of" places (beaches, hikes, surf…) bundled with
// the app so a brand-new account has something to explore before it has a
// single friend. They are research-sourced public rankings — every surface
// says so, and they never pose as a person's recommendation.

export type WorldListId =
  | "beaches"
  | "hikes"
  | "surf"
  | "kite"
  | "restaurants"
  | "dive"
  | "ski"
  | "roadtrips"
  | "nightskies"
  | "drone";

export interface ListPlace {
  /** `${listId}-${slug}`; unique across all lists. */
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** ISO 3166-1 alpha-2, upper case. */
  countryCode: string;
  /** Region or nearest town, for the card subtitle. */
  region: string;
  /** One line on why it is on the list, ≤ 160 chars, no marketing voice. */
  why: string;
  /** 1–12; empty when it is good all year. */
  bestMonths: number[];
  /** From the list's own vocabulary (see LIST_META.tags). */
  tags: string[];
  /** Where this ranking came from, short, e.g. "Lonely Planet 2025". */
  source: string;
}

export interface WorldList {
  id: WorldListId;
  label: string;
  /** One sentence shown in the Layers card and on the empty-state Explore. */
  blurb: string;
  /** Sources the list was compiled from. */
  sources: string[];
  /** ISO date the research was compiled. */
  compiledOn: string;
  places: ListPlace[];
}

export const LIST_META: Record<WorldListId, { label: string; color: string; glyph: string; blurb: string; tags: string[] }> = {
  beaches: { label: "Beaches", color: "#1f8fb8", glyph: "🌊", blurb: "The world's most-ranked beaches, from Lonely Planet to Condé Nast.", tags: ["white-sand", "black-sand", "snorkel", "swim", "remote", "family", "party", "cliffs", "lagoon", "dunes"] },
  hikes: { label: "Hikes", color: "#2e8f57", glyph: "🥾", blurb: "Great day hikes and multi-day treks, ranked by the outdoor press.", tags: ["day-hike", "multi-day", "alpine", "coastal", "desert", "volcano", "jungle", "hut-to-hut", "permit", "technical"] },
  surf: { label: "Surf", color: "#0d7a8c", glyph: "🏄", blurb: "Famous breaks for every level, from beginner beach breaks to big-wave reefs.", tags: ["beginner", "intermediate", "advanced", "big-wave", "reef", "point", "beach-break", "left", "right", "crowded"] },
  kite: { label: "Kite & wind", color: "#3b7dd8", glyph: "🪁", blurb: "Kitesurf and windsurf spots with reliable wind and room to launch.", tags: ["flat-water", "waves", "beginner", "advanced", "lagoon", "school", "thermal", "trade-wind", "downwinder", "foil"] },
  restaurants: { label: "Restaurants", color: "#b8412e", glyph: "🍴", blurb: "Three-Michelin-star tables and the World's 50 Best.", tags: ["3-star", "2-star", "50-best", "tasting-menu", "seafood", "sushi", "farm", "wine", "book-months-ahead", "casual"] },
  dive: { label: "Dive", color: "#1b5fa8", glyph: "🤿", blurb: "Wrecks, walls, reefs and pelagics the dive press keeps ranking.", tags: ["reef", "wreck", "wall", "drift", "sharks", "manta", "whale-shark", "cenote", "cold-water", "liveaboard"] },
  ski: { label: "Ski", color: "#5f6f9e", glyph: "🎿", blurb: "Resorts and backcountry areas with the runs people cross oceans for.", tags: ["resort", "backcountry", "powder", "freeride", "family", "heli", "cat", "glacier", "village", "spring"] },
  roadtrips: { label: "Road trips", color: "#a8642a", glyph: "🚗", blurb: "Scenic drives and classic routes, marked at their best viewpoint.", tags: ["coastal", "mountain", "desert", "loop", "pass", "one-day", "week", "gravel", "seasonal-closure", "campervan"] },
  nightskies: { label: "Night skies", color: "#4b3f8f", glyph: "🌌", blurb: "Dark-sky reserves and aurora stations, marked where you would stand.", tags: ["dark-sky-reserve", "aurora", "milky-way", "observatory", "desert", "island", "winter", "summer", "guided", "drive-in"] },
  drone: { label: "Drone landscapes", color: "#c65d3b", glyph: "🚁", blurb: "Landscapes that read from the air — always with the field brief first.", tags: ["coast", "canyon", "waterfall", "volcano", "salt-flat", "terraces", "ice", "dunes", "island", "check-rules"] },
};

export const LIST_IDS = Object.keys(LIST_META) as WorldListId[];

const CC = /^[A-Z]{2}$/;
const ID = /^[a-z]+-[a-z0-9]+(-[a-z0-9]+)*$/;

/** Problems with one list file; empty = valid. Cheap, no geometry. */
export function validateList(input: unknown): string[] {
  const out: string[] = [];
  if (!input || typeof input !== "object") return ["not an object"];
  const l = input as Record<string, unknown>;
  const id = l.id as WorldListId;
  if (!LIST_META[id]) out.push(`id: one of ${LIST_IDS.join(", ")}`);
  if (typeof l.label !== "string" || !l.label.trim()) out.push("label: string");
  if (typeof l.blurb !== "string" || !l.blurb.trim()) out.push("blurb: string");
  if (!Array.isArray(l.sources) || !l.sources.length || l.sources.some((s) => typeof s !== "string" || !s.trim())) out.push("sources: string[] (at least one)");
  if (typeof l.compiledOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(l.compiledOn)) out.push("compiledOn: ISO date");
  if (!Array.isArray(l.places)) return [...out, "places: array"];
  const tags = new Set(LIST_META[id]?.tags ?? []);
  const ids = new Set<string>();
  const names = new Set<string>();
  l.places.forEach((p: unknown, i: number) => {
    const at = `places[${i}]`;
    if (!p || typeof p !== "object") { out.push(`${at}: object`); return; }
    const x = p as Record<string, unknown>;
    if (typeof x.id !== "string" || !ID.test(x.id) || !x.id.startsWith(`${id}-`)) out.push(`${at}.id: "${id}-<slug>" in lower-case kebab`);
    else if (ids.has(x.id)) out.push(`${at}.id: duplicate ${x.id}`); else ids.add(x.id);
    if (typeof x.name !== "string" || !x.name.trim()) out.push(`${at}.name: string`);
    else { const k = x.name.trim().toLowerCase(); if (names.has(k)) out.push(`${at}.name: duplicate "${x.name}"`); names.add(k); }
    if (typeof x.lat !== "number" || !(x.lat >= -90 && x.lat <= 90)) out.push(`${at}.lat: -90..90`);
    if (typeof x.lng !== "number" || !(x.lng >= -180 && x.lng <= 180)) out.push(`${at}.lng: -180..180`);
    if (typeof x.lat === "number" && typeof x.lng === "number" && x.lat === 0 && x.lng === 0) out.push(`${at}: null island`);
    if (typeof x.countryCode !== "string" || !CC.test(x.countryCode)) out.push(`${at}.countryCode: ISO alpha-2 upper case`);
    if (typeof x.region !== "string" || !x.region.trim()) out.push(`${at}.region: string`);
    if (typeof x.why !== "string" || !x.why.trim() || x.why.length > 160) out.push(`${at}.why: 1..160 chars`);
    if (!Array.isArray(x.bestMonths) || x.bestMonths.some((m) => !Number.isInteger(m) || (m as number) < 1 || (m as number) > 12)) out.push(`${at}.bestMonths: integers 1..12`);
    if (!Array.isArray(x.tags) || !x.tags.length || x.tags.some((t) => !tags.has(t as string))) out.push(`${at}.tags: 1+ from [${[...tags].join(", ")}]`);
    if (typeof x.source !== "string" || !x.source.trim() || x.source.length > 80) out.push(`${at}.source: 1..80 chars`);
  });
  return out;
}

export const LIST_MIN_PLACES = 150;
export const LIST_TARGET_PLACES = 200;
