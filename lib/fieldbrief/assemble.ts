import { type CountryRules, daysSinceVerified, isStale, rulesFor as defaultRulesFor, sourceLabel } from "./rules";
import { lightWindows, type LightWindows } from "./light";
import { fetchWind as defaultFetchWind, type WindResult } from "./wind";

// The brief assembler: code gathers the evidence — curated rules, computed
// light, fetched wind, the viewer's own nearby scouting — into one object.
// Nothing in here is ever produced by a model; the optional narrative
// (lib/fieldbrief/narrative.ts) only rewrites this object in a warmer voice.

export interface RulesSummary {
  covered: true;
  countryCode: string;
  countryName: string;
  /** "as of {date}, per {source}" — the only way legality is ever phrased. */
  asOf: string;
  lastVerifiedOn: string;
  source: string;
  sourceUrls: string[];
  verifiedBy: string;
  stale: boolean;
  daysSinceVerified: number;
  regime: CountryRules["regime"];
  authority: { name: string; url: string };
  registrationRequired: CountryRules["registrationRequired"];
  pilotCertRequired: CountryRules["pilotCertRequired"];
  insuranceRequired: CountryRules["insuranceRequired"];
  weightClasses: CountryRules["weightClasses"];
  maxAltitudeM: number;
  maxDistanceRule: string;
  importRestriction: CountryRules["importRestriction"];
  noFlyHighlights: string[];
  permitProcess: CountryRules["permitProcess"];
  nationalApp: CountryRules["nationalApp"];
  notes: string;
  flyPath: string;
}

export interface Uncovered {
  covered: false;
  countryCode: string | null;
  /** Only ever set from curated data — never guessed. */
  authority?: { name: string; url: string };
}

/** What the viewer's circle has done here — computed client-side from the
 *  store, which is already scoped by RLS in live mode. Ids and short strings. */
export interface NearbySummary {
  scoutPins: {
    pinId: string;
    placeName: string;
    ownerName: string;
    distanceKm: number;
    timeOfDay?: string;
    bearingDeg?: number;
    note: string;
  }[];
  reports: {
    id: string;
    ownerHandle: string;
    outcome: string;
    flownOn: string;
    droneClass: string;
    quote: string;
    placeName?: string;
  }[];
}

export interface FieldBrief {
  source: "ai" | "live";
  place: { lat: number; lng: number; date: string; countryCode: string | null };
  legality: RulesSummary | Uncovered;
  light: LightWindows;
  wind: WindResult;
  nearby: NearbySummary;
  narrative?: string;
}

export interface AssembleInput {
  lat: number;
  lng: number;
  /** YYYY-MM-DD */
  date: string;
  countryCode?: string | null;
  nearby?: NearbySummary;
}

export interface AssembleDeps {
  rulesFor?: (cc: string | null | undefined) => CountryRules | null;
  fetchWind?: (lat: number, lng: number, date: string) => Promise<WindResult>;
  now?: () => Date;
}

export function summarizeRules(rules: CountryRules, now = new Date()): RulesSummary {
  return {
    covered: true,
    countryCode: rules.countryCode,
    countryName: rules.countryName,
    asOf: `as of ${rules.lastVerifiedOn}, per ${sourceLabel(rules)}`,
    lastVerifiedOn: rules.lastVerifiedOn,
    source: sourceLabel(rules),
    sourceUrls: rules.sourceUrls,
    verifiedBy: rules.verifiedBy,
    stale: isStale(rules, now),
    daysSinceVerified: daysSinceVerified(rules, now),
    regime: rules.regime,
    authority: { name: rules.authorityName, url: rules.authorityUrl },
    registrationRequired: rules.registrationRequired,
    pilotCertRequired: rules.pilotCertRequired,
    insuranceRequired: rules.insuranceRequired,
    weightClasses: rules.weightClasses,
    maxAltitudeM: rules.maxAltitudeM,
    maxDistanceRule: rules.maxDistanceRule,
    importRestriction: rules.importRestriction,
    noFlyHighlights: rules.noFlyHighlights,
    permitProcess: rules.permitProcess,
    nationalApp: rules.nationalApp,
    notes: rules.notes,
    flyPath: `/fly/${rules.countryCode.toLowerCase()}`,
  };
}

const EMPTY_NEARBY: NearbySummary = { scoutPins: [], reports: [] };

export async function assembleBrief(input: AssembleInput, deps: AssembleDeps = {}): Promise<FieldBrief> {
  const rulesFor = deps.rulesFor ?? defaultRulesFor;
  const fetchWind = deps.fetchWind ?? ((lat, lng, date) => defaultFetchWind(lat, lng, date));
  const now = deps.now ? deps.now() : new Date();
  const cc = input.countryCode ? input.countryCode.toUpperCase() : null;
  const rules = rulesFor(cc);
  const legality: RulesSummary | Uncovered = rules ? summarizeRules(rules, now) : { covered: false, countryCode: cc };

  // Light is pure math; wind is the only network call and it never blocks the
  // brief past its own timeout.
  const light = lightWindows(input.lat, input.lng, input.date);
  const wind = await fetchWind(input.lat, input.lng, input.date);

  return {
    source: "live",
    place: { lat: input.lat, lng: input.lng, date: input.date, countryCode: cc },
    legality,
    light,
    wind,
    nearby: sanitizeNearby(input.nearby),
  };
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

/** The client sends its nearby summary; keep it to the shape and sizes we render. */
export function sanitizeNearby(n: NearbySummary | undefined): NearbySummary {
  if (!n) return EMPTY_NEARBY;
  return {
    scoutPins: (Array.isArray(n.scoutPins) ? n.scoutPins : []).slice(0, 12).map((p) => ({
      pinId: clip(p.pinId, 64),
      placeName: clip(p.placeName, 120),
      ownerName: clip(p.ownerName, 80),
      distanceKm: Number.isFinite(p.distanceKm) ? Math.round(p.distanceKm * 10) / 10 : 0,
      timeOfDay: p.timeOfDay ? clip(p.timeOfDay, 16) : undefined,
      bearingDeg: Number.isFinite(p.bearingDeg as number) ? Math.round(p.bearingDeg as number) : undefined,
      note: clip(p.note, 400),
    })),
    reports: (Array.isArray(n.reports) ? n.reports : []).slice(0, 12).map((r) => ({
      id: clip(r.id, 64),
      ownerHandle: clip(r.ownerHandle, 40),
      outcome: clip(r.outcome, 16),
      flownOn: clip(r.flownOn, 10),
      droneClass: clip(r.droneClass, 60),
      quote: clip(r.quote, 1000),
      placeName: r.placeName ? clip(r.placeName, 120) : undefined,
    })),
  };
}
