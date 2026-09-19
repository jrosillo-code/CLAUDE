import { type CountryRules, type CityNote, type ReviewTier, TIER_LABEL, authorityFor, daysSinceVerified, isDeskReview, isStale, reviewTierOf, rulesFor as defaultRulesFor, sourceLabel } from "./rules";
import { type AirfieldNear, nearestAirfields as defaultNearestAirfields } from "./airfields";
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
  /** true when the record is a desk review, not a pilot's verification. */
  deskReview: boolean;
  reviewTier: ReviewTier;
  /** The label every surface shows for this tier. */
  tierLabel: string;
  /** Place-specific notes; the client shows the ones matching the place name. */
  cityNotes: CityNote[];
  coverage: CountryRules["coverage"];
  scope: string;
  regime: CountryRules["regime"];
  authority: { name: string; url: string };
  registrationRequired: CountryRules["registrationRequired"];
  pilotCertRequired: CountryRules["pilotCertRequired"];
  insuranceRequired: CountryRules["insuranceRequired"];
  weightClasses: CountryRules["weightClasses"];
  maxAltitudeM: number | null;
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

/** How to show times for this place: an exact zone, or a longitude estimate. */
export interface PlaceClock {
  timezone: string | null;
  utcOffsetMinutes: number;
  /** false when the offset is only lng/15 rounded — shown with "≈". */
  exact: boolean;
}

export function placeClock(lng: number, wind: WindResult): PlaceClock {
  if (!("unavailable" in wind) && wind.timezone && typeof wind.utcOffsetSeconds === "number") {
    return { timezone: wind.timezone, utcOffsetMinutes: Math.round(wind.utcOffsetSeconds / 60), exact: true };
  }
  return { timezone: null, utcOffsetMinutes: Math.round(lng / 15) * 60, exact: false };
}

export interface FieldBrief {
  source: "ai" | "live";
  place: { lat: number; lng: number; date: string; countryCode: string | null };
  clock: PlaceClock;
  legality: RulesSummary | Uncovered;
  light: LightWindows;
  wind: WindResult;
  /** Nearest airfields — a distance, never an airspace check. */
  airfields: AirfieldNear[];
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
  /** May return a promise that was started earlier — the route begins the
   *  wind lookup before the country is known so the two don't add up. */
  fetchWind?: (lat: number, lng: number, date: string) => Promise<WindResult>;
  nearestAirfields?: (lat: number, lng: number) => AirfieldNear[];
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
    deskReview: isDeskReview(rules),
    reviewTier: reviewTierOf(rules),
    tierLabel: TIER_LABEL[reviewTierOf(rules)],
    cityNotes: (rules.cityNotes ?? []).map((n) => ({ ...n, reviewTier: n.reviewTier ?? reviewTierOf(rules) })),
    coverage: rules.coverage,
    scope: rules.scope ?? "",
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
  const nearestAirfields = deps.nearestAirfields ?? ((lat, lng) => defaultNearestAirfields(lat, lng));
  const now = deps.now ? deps.now() : new Date();
  const cc = input.countryCode ? input.countryCode.toUpperCase() : null;
  const rules = rulesFor(cc);
  const authority = rules ? null : authorityFor(cc);
  const legality: RulesSummary | Uncovered = rules
    ? summarizeRules(rules, now)
    : { covered: false, countryCode: cc, ...(authority ? { authority: { name: authority.authorityName, url: authority.authorityUrl } } : {}) };

  // Light is pure math; wind is the only network call and it never blocks the
  // brief past its own timeout — and never fails it: a thrown lookup becomes
  // an "unavailable" card, the other cards stay.
  const light = lightWindows(input.lat, input.lng, input.date);
  const wind = await fetchWind(input.lat, input.lng, input.date).catch(
    (): WindResult => ({ unavailable: true, reason: "Wind lookup failed." })
  );

  return {
    source: "live",
    place: { lat: input.lat, lng: input.lng, date: input.date, countryCode: cc },
    clock: placeClock(input.lng, wind),
    legality,
    light,
    wind,
    airfields: safeAirfields(() => nearestAirfields(input.lat, input.lng)),
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

/** The airfield list can never fail the brief: a broken file reads as none. */
function safeAirfields(get: () => AirfieldNear[]): AirfieldNear[] {
  try {
    return get().slice(0, 3);
  } catch {
    return [];
  }
}
