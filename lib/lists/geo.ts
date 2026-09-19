// Geometry sanity for list places, node-only (reads the bundled atlas).
// A place must sit inside its country's 110m outline or within ~1.4° of a
// vertex of it (coastlines and islands are generalised at this scale).
// Countries missing from the atlas (Singapore, Maldives…) skip the check.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WorldList } from "./schema";

type Ring = [number, number][];
interface Country { name: string; polys: Ring[][] }

let atlas: Country[] | null = null;
function loadAtlas(root: string): Country[] {
  if (atlas) return atlas;
  const geo = JSON.parse(readFileSync(join(root, "public", "geo", "countries-110m.json"), "utf8"));
  atlas = (geo.features ?? []).map((f: { properties?: { name?: string }; geometry?: { type?: string; coordinates?: unknown } }) => ({
    name: String(f.properties?.name ?? ""),
    polys: f.geometry?.type === "MultiPolygon" ? (f.geometry.coordinates as Ring[][]) : f.geometry?.type === "Polygon" ? [f.geometry.coordinates as Ring[]] : [],
  }));
  return atlas!;
}

// The atlas names countries in its own words; map the codes it spells differently.
const NAME_ALIAS: Record<string, string[]> = {
  US: ["United States of America"], GB: ["United Kingdom"], RU: ["Russia"], KR: ["South Korea"], KP: ["North Korea"],
  CZ: ["Czechia"], BA: ["Bosnia and Herz."], MK: ["North Macedonia"], CD: ["Dem. Rep. Congo"], CG: ["Congo"],
  CF: ["Central African Rep."], SS: ["S. Sudan"], TZ: ["Tanzania"], DO: ["Dominican Rep."], LA: ["Laos"], SY: ["Syria"],
  IR: ["Iran"], VN: ["Vietnam"], BO: ["Bolivia"], VE: ["Venezuela"], EH: ["W. Sahara"], TW: ["Taiwan"], BN: ["Brunei"],
  TL: ["Timor-Leste"], SB: ["Solomon Is."], FK: ["Falkland Is."], GL: ["Greenland"], PS: ["Palestine"], CI: ["Côte d'Ivoire"],
  GQ: ["Eq. Guinea"], SZ: ["eSwatini"], NC: ["New Caledonia"], PR: ["Puerto Rico"], FR: ["France"], NO: ["Norway"],
  MM: ["Myanmar"], AE: ["United Arab Emirates"], TF: ["Fr. S. Antarctic Lands"], CY: ["Cyprus", "N. Cyprus"], XK: ["Kosovo"],
  MD: ["Moldova"], BS: ["Bahamas"], GM: ["Gambia"], LB: ["Lebanon"], TT: ["Trinidad and Tobago"], VU: ["Vanuatu"],
};

function countryFor(cc: string, root: string): Country[] {
  const all = loadAtlas(root);
  const names = new Set<string>(NAME_ALIAS[cc] ?? []);
  try {
    const n = new Intl.DisplayNames(["en"], { type: "region" }).of(cc);
    if (n) names.add(n);
  } catch { /* no ICU */ }
  return all.filter((c) => names.has(c.name));
}

function inRing(pt: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function nearRing(pt: [number, number], ring: Ring, deg: number): boolean {
  for (const [x, y] of ring) if (Math.abs(x - pt[0]) < deg && Math.abs(y - pt[1]) < deg) return true;
  return false;
}

export function geoProblems(list: WorldList, root: string, tolDeg = 1.4): string[] {
  const out: string[] = [];
  const missing = new Set<string>();
  for (const p of list.places) {
    const cs = countryFor(p.countryCode, root);
    if (!cs.length) { missing.add(p.countryCode); continue; }
    const pt: [number, number] = [p.lng, p.lat];
    let ok = false;
    for (const c of cs) for (const poly of c.polys) {
      if (inRing(pt, poly[0]) || nearRing(pt, poly[0], tolDeg)) { ok = true; break; }
    }
    if (!ok) out.push(`${p.id}: (${p.lat}, ${p.lng}) is not in or near ${p.countryCode} (${cs.map((c) => c.name).join("/")})`);
  }
  return out;
}
