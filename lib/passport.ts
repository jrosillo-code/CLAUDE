import type { Pin } from "./types";

// Passport stats: which slice of the world a traveler has covered, computed
// entirely from their visible pins.

export interface ContinentRow {
  key: string;
  label: string;
  visited: number;
  total: number;
  pct: number;
}

export interface PassportStats {
  codes: string[]; // visited ISO alpha-2 codes
  continentsVisited: number;
  continentsTotal: number;
  countriesTotal: number;
  cities: number;
  coveragePct: number; // countries / 195
  first: { date: string; code?: string } | null;
  latest: { date: string; code?: string } | null;
  perContinent: ContinentRow[]; // inhabited continents, sorted by coverage
}

const WORLD_TARGET = 195; // matches the world-progress bar

// ISO alpha-2 codes per continent (UN members + common travel codes).
const CONTINENT_CODES: { key: string; label: string; codes: string }[] = [
  {
    key: "africa",
    label: "Africa",
    codes:
      "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW",
  },
  {
    key: "asia",
    label: "Asia",
    codes:
      "AF AM AZ BH BD BT BN KH CN CY GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP KR OM PK PS PH QA SA SG LK SY TW TJ TH TL TR TM AE UZ VN YE HK MO",
  },
  {
    key: "europe",
    label: "Europe",
    codes:
      "AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GR HU IS IE IT XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA",
  },
  {
    key: "northamerica",
    label: "North America",
    codes: "AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US PR",
  },
  {
    key: "southamerica",
    label: "South America",
    codes: "AR BO BR CL CO EC GY PY PE SR UY VE",
  },
  {
    key: "oceania",
    label: "Oceania",
    codes: "AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU",
  },
  { key: "antarctica", label: "Antarctica", codes: "AQ" },
];

const CODE_TO_CONTINENT = new Map<string, string>();
for (const c of CONTINENT_CODES) {
  for (const code of c.codes.split(" ")) CODE_TO_CONTINENT.set(code, c.key);
}

/** Country code → flag emoji ("PT" → 🇵🇹). */
export function flagEmoji(cc: string): string {
  const code = cc.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(
    ...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
  );
}

export function computePassport(pins: Pin[]): PassportStats {
  const codes = new Set<string>();
  const cities = new Set<string>();
  for (const p of pins) {
    if (p.countryCode) codes.add(p.countryCode.toUpperCase());
    if (p.placeName) cities.add(p.placeName.trim().toLowerCase());
  }

  const continentsHit = new Set<string>();
  for (const code of codes) {
    const cont = CODE_TO_CONTINENT.get(code);
    if (cont) continentsHit.add(cont);
  }

  const dated = pins
    .filter((p) => p.startedOn || p.createdAt)
    .sort((a, b) => (a.startedOn ?? a.createdAt).localeCompare(b.startedOn ?? b.createdAt));
  const toStamp = (p: Pin) => ({ date: p.startedOn ?? p.createdAt, code: p.countryCode });
  const first = dated.length ? toStamp(dated[0]) : null;
  const latest = dated.length > 1 ? toStamp(dated[dated.length - 1]) : null;

  const perContinent = CONTINENT_CODES.filter((c) => c.key !== "antarctica")
    .map((c) => {
      const all = c.codes.split(" ");
      const visited = all.filter((code) => codes.has(code)).length;
      return {
        key: c.key,
        label: c.label,
        visited,
        total: all.length,
        pct: visited / all.length,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  return {
    codes: [...codes],
    continentsVisited: continentsHit.size,
    continentsTotal: 7,
    countriesTotal: WORLD_TARGET,
    cities: cities.size,
    coveragePct: Math.min(1, codes.size / WORLD_TARGET),
    first,
    latest,
    perContinent,
  };
}
