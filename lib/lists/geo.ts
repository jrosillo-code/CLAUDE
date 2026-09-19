// Geometry sanity for list places, node-only (reads the bundled atlas).
// A place must sit inside its country's 110m outline, within ~6° of a vertex
// of it (coastlines and islands are generalised or missing at this scale),
// or inside one of the island boxes below for territories the atlas drops
// (Canaries, Azores, Galápagos, Easter Island…). The check exists to catch
// the wrong continent or a swapped lat/lng, not to argue about a beach.
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

// Island groups the 110m atlas leaves out, as [west, south, east, north].
const ISLAND_BOXES: Record<string, [number, number, number, number][]> = {
  ES: [[-18.5, 27.4, -13.2, 29.6]], // Canary Islands
  PT: [[-31.5, 36.7, -24.8, 39.9], [-17.4, 32.3, -16.1, 33.2]], // Azores, Madeira
  EC: [[-92.2, -1.6, -89.0, 0.9]], // Galápagos
  CL: [[-109.6, -27.3, -109.1, -27.0], [-80.9, -33.9, -78.6, -33.5]], // Easter Island, Juan Fernández
  AU: [[96.7, -12.3, 97.0, -11.7], [105.5, -10.7, 105.8, -10.3], [158.9, -31.9, 159.2, -31.4], [167.8, -29.2, 168.1, -28.9]], // Cocos, Christmas, Lord Howe, Norfolk
  IN: [[92.0, 6.5, 94.3, 14.0], [71.5, 8.0, 74.0, 12.5]], // Andaman & Nicobar, Lakshadweep
  YE: [[53.2, 12.2, 54.6, 12.8]], // Socotra
  NO: [[9.0, 76.0, 34.0, 81.0], [-9.5, 70.7, -7.8, 71.3]], // Svalbard, Jan Mayen
  US: [[-179.9, 18.5, -154.5, 29.0], [-171.0, 51.0, -129.0, 72.0], [144.5, 13.1, 145.1, 13.8], [-171.2, -14.5, -169.3, -13.9]], // Hawaii, Alaska, Guam, American Samoa
  BR: [[-32.6, -4.0, -32.3, -3.7], [-29.5, -21.0, -28.7, -20.3]], // Fernando de Noronha, Trindade
  MX: [[-111.1, 18.2, -110.7, 19.4], [-115.0, 28.0, -114.0, 29.5]], // Socorro / Revillagigedo, Guadalupe
  CR: [[-87.2, 5.4, -86.9, 5.7]], // Cocos Island
  CO: [[-81.7, 3.9, -81.5, 4.1]], // Malpelo
  JP: [[122.9, 24.0, 131.5, 27.5], [140.0, 24.0, 142.5, 27.8]], // Ryukyu / Yaeyama, Ogasawara
  KR: [[126.1, 33.1, 126.98, 33.6]], // Jeju
  TH: [[97.5, 6.5, 100.0, 9.0]], // Andaman coast islands
  ID: [[95.0, -11.0, 141.0, 6.0]], // the whole archipelago
  PH: [[116.9, 4.5, 126.6, 21.2]],
  GR: [[19.3, 34.7, 29.7, 41.8]],
  IT: [[8.1, 38.8, 9.9, 41.3], [12.0, 36.6, 15.7, 38.4], [10.2, 42.3, 10.5, 42.9]], // Sardinia, Sicily, Elba
  FR: [[8.5, 41.3, 9.6, 43.1]], // Corsica
  HR: [[13.4, 42.3, 18.6, 45.6]],
  TZ: [[39.0, -6.6, 39.9, -4.8]], // Zanzibar, Pemba
  MZ: [[40.3, -12.5, 41.0, -10.4]], // Quirimbas
  ZA: [[37.5, -47.0, 38.0, -46.5]], // Marion Island
  NZ: [[-176.9, -44.2, -176.1, -43.6], [166.0, -52.7, 167.0, -50.4]], // Chatham, subantarctic
  CA: [[-141.0, 60.0, -52.0, 83.2]], // the Arctic archipelago
  DK: [[-73.0, 59.7, -11.0, 83.7], [-7.8, 61.3, -6.2, 62.5]], // Greenland, Faroes (when filed under DK)
  RU: [[131.0, 42.5, 180.0, 71.7]], // the Far East (Kamchatka, Kurils)
  KE: [[39.5, -2.7, 41.6, -1.4]], // Lamu / Watamu coast
  SC: [[46.0, -10.5, 56.5, -3.5]],
  MU: [[56.0, -21.0, 64.0, -19.3]], // incl. Rodrigues
  MV: [[72.6, -0.8, 73.8, 7.2]],
  FJ: [[176.5, -19.5, -178.0, -16.0]],
  PF: [[-155.0, -28.0, -134.0, -7.0]],
  CV: [[-25.5, 14.7, -22.5, 17.3]],
};

function inBox(cc: string, lat: number, lng: number): boolean {
  for (const [w, s, e, n] of ISLAND_BOXES[cc] ?? []) {
    const inLng = w <= e ? lng >= w && lng <= e : lng >= w || lng <= e; // antimeridian boxes
    if (inLng && lat >= s && lat <= n) return true;
  }
  return false;
}

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

export function geoProblems(list: WorldList, root: string, tolDeg = 6): string[] {
  const out: string[] = [];
  const missing = new Set<string>();
  for (const p of list.places) {
    if (inBox(p.countryCode, p.lat, p.lng)) continue;
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
