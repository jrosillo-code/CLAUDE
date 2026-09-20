// Share cards for the year recap, drawn entirely in canvas so they render
// the same on every device: the Boarding Pass (your year as one travel
// document) as a PNG, and the Constellation (the profile's turning globe with
// your pins flicking on) as a short looping video — with a PNG still where
// the browser cannot encode video.

import { siteHost } from "./site";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { starsFromGeo, type Star } from "./constellation";
import { computePassport, type PassportStats } from "./passport";
import { findCountryAt } from "./focus";
import { createMeteorField } from "./meteors";

export const CARD_W = 1080;
export const CARD_H = 1350;
const CARD_SERIF = "Georgia, 'Times New Roman', serif";
const CARD_MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
const CARD_SANS = "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif";
const TO_RAD = Math.PI / 180;

export interface CardPin {
  lat: number;
  lng: number;
}

interface GeoFeature {
  properties?: { name?: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

export interface ShareData {
  year: number;
  name: string;
  handle: string;
  pins: CardPin[];
  places: number;
  countries: number;
  km: number;
  accent: string;
  passport: PassportStats;
  visitedNames: Set<string>;
  features: GeoFeature[];
  stars: Star[];
  /** The year's route in order, for the boarding pass. */
  stops: { lat: number; lng: number; name: string }[];
  landmarks: number;
  topRated: string;
  season: string;
}

let geoCache: { features: GeoFeature[] } | null = null;
async function loadGeo(): Promise<{ features: GeoFeature[] }> {
  if (geoCache) return geoCache;
  const res = await fetch("/geo/countries-110m.json");
  geoCache = (await res.json()) as { features: GeoFeature[] };
  return geoCache;
}

/** Everything both cards need, resolved once (geometry, visited countries, stars). */
export async function buildShareData(input: {
  year: number;
  name: string;
  handle: string;
  pins: { lat: number; lng: number; countryCode?: string; region?: string; placeName?: string; startedOn?: string; createdAt: string }[];
  yearPins: { lat: number; lng: number; placeName?: string }[];
  km: number;
  accent: string;
  landmarks: number;
  topRated: string;
  season: string;
}): Promise<ShareData> {
  const geo = await loadGeo();
  // one representative pin per country keeps the polygon lookups cheap
  const seen = new Set<string>();
  const reps = input.pins.filter((p) => {
    const cc = (p.countryCode || `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`).toUpperCase();
    if (seen.has(cc)) return false;
    seen.add(cc);
    return true;
  });
  const names = await Promise.all(reps.map(async (p) => (await findCountryAt(p.lng, p.lat))?.name ?? null));
  return {
    year: input.year,
    name: input.name,
    handle: input.handle,
    pins: input.pins.map((p) => ({ lat: p.lat, lng: p.lng })),
    places: input.yearPins.length,
    countries: new Set(input.pins.map((p) => p.countryCode).filter(Boolean)).size,
    km: input.km,
    accent: input.accent,
    passport: computePassport(input.pins as Parameters<typeof computePassport>[0]),
    visitedNames: new Set(names.filter((n): n is string => !!n)),
    features: geo.features,
    stars: starsFromGeo(geo),
    stops: input.yearPins.map((p) => ({ lat: p.lat, lng: p.lng, name: p.placeName ?? "" })),
    landmarks: input.landmarks,
    topRated: input.topRated,
    season: input.season,
  };
}

function code3(name: string): string {
  const s = (name || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
  return (s.slice(0, 3) || "···").padEnd(3, "·");
}

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function downloadCanvas(c: HTMLCanvasElement, filename: string): void {
  const a = document.createElement("a");
  a.download = filename;
  a.href = c.toDataURL("image/png");
  a.click();
}

// ── 1 · Boarding Pass — your year as one travel document ──
export function drawPassCard(d: ShareData): HTMLCanvasElement {
  const W = CARD_W, H = CARD_H;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const accent = d.accent;
  const ink = "#17202e", faint = "#a99c82", paper = "#e9e2d3", card = "#f7f2e8";
  const origin = d.stops[0]?.name ?? "";
  const dest = d.stops[d.stops.length - 1]?.name ?? origin;

  ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
  // Ticket.
  ctx.save();
  ctx.shadowColor = "rgba(40,30,10,.35)"; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  roundRect(ctx, 60, 70, 960, 1210, 34); ctx.fillStyle = card; ctx.fill();
  ctx.restore();

  ctx.textAlign = "left";
  ctx.fillStyle = ink; ctx.font = `600 40px ${CARD_SERIF}`;
  ctx.fillText("Waypoint", 126, 190);
  ctx.textAlign = "right";
  ctx.fillStyle = accent; ctx.font = `500 22px ${CARD_MONO}`; ctx.letterSpacing = "3px";
  ctx.fillText(`${d.year} · YEAR PASS`, 954, 188); ctx.letterSpacing = "0px";

  // Route: origin ✈ destination.
  ctx.textAlign = "left";
  ctx.fillStyle = ink; ctx.font = `700 116px ${CARD_SERIF}`;
  ctx.fillText(code3(origin), 126, 410);
  ctx.font = `400 22px ${CARD_MONO}`; ctx.fillStyle = faint;
  ctx.fillText(origin, 128, 456);
  ctx.textAlign = "right";
  ctx.fillStyle = ink; ctx.font = `700 116px ${CARD_SERIF}`;
  ctx.fillText(code3(dest), 954, 410);
  ctx.font = `400 22px ${CARD_MONO}`; ctx.fillStyle = faint;
  ctx.fillText(dest, 952, 456);
  ctx.textAlign = "center";
  ctx.fillStyle = accent; ctx.font = "64px serif";
  ctx.fillText("✈", 540, 392);

  // Field grid.
  const field = (label: string, value: string, x: number, y: number) => {
    ctx.textAlign = "left";
    ctx.fillStyle = faint; ctx.font = `400 19px ${CARD_MONO}`; ctx.letterSpacing = "2px";
    ctx.fillText(label, x, y); ctx.letterSpacing = "0px";
    ctx.fillStyle = ink; ctx.font = `600 42px ${CARD_SERIF}`;
    ctx.fillText(value, x, y + 56);
  };
  field("PLACES", String(d.places), 126, 588);
  field("COUNTRIES", String(d.countries).padStart(2, "0"), 470, 588);
  field("DISTANCE", d.km.toLocaleString(), 814, 588);
  field("LANDMARKS", String(d.landmarks), 126, 728);
  field("TOP RATED", d.topRated, 470, 728);
  field("SEASON", d.season, 814, 728);

  // Traveler.
  ctx.textAlign = "left";
  ctx.fillStyle = faint; ctx.font = `400 19px ${CARD_MONO}`; ctx.letterSpacing = "2px";
  ctx.fillText("TRAVELER", 126, 862); ctx.letterSpacing = "0px";
  ctx.fillStyle = ink; ctx.font = `500 56px ${CARD_SERIF}`;
  ctx.fillText(d.name, 126, 922);

  // Perforated stub edge.
  ctx.strokeStyle = "#cdbfa4"; ctx.lineWidth = 3; ctx.setLineDash([16, 14]);
  ctx.beginPath(); ctx.moveTo(90, 1000); ctx.lineTo(990, 1000); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = paper;
  ctx.beginPath(); ctx.arc(60, 1000, 28, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(1020, 1000, 28, 0, 7); ctx.fill();

  // Barcode.
  let bx = 126;
  const widths = [4, 3, 6, 2, 5, 3, 4, 2, 6, 3, 5, 2, 4, 3, 5, 6, 2, 4];
  let wi = 0;
  while (bx < 954) {
    const w = widths[wi % widths.length];
    ctx.fillStyle = ink;
    ctx.fillRect(bx, 1050, w, 120);
    bx += w + (widths[(wi + 3) % widths.length]);
    wi++;
  }

  // Segment list.
  ctx.textAlign = "center";
  ctx.fillStyle = faint; ctx.font = `400 22px ${CARD_MONO}`; ctx.letterSpacing = "3px";
  const segs = d.stops.map((s) => code3(s.name)).join(" · ");
  ctx.fillText(segs.length > 46 ? segs.slice(0, 44) + "…" : segs, 540, 1236);
  // Where to find the app — the card travels further than the person who made it.
  ctx.textAlign = "center"; ctx.fillStyle = "#8a8378"; ctx.font = `600 18px ${CARD_MONO}`; ctx.letterSpacing = "3px";
  ctx.fillText(siteHost().toUpperCase(), 540, 1290); ctx.letterSpacing = "0px";
  ctx.letterSpacing = "0px";
  return c;
}


// ── 2 · Constellation ──────────────────────────────────────────────────────
// The profile's globe, as it turns: coast stars in white on deep space,
// lines on the visible face, a ripple of light every few seconds, your pins
// flicking on in accent, and a shooting star now and then.
export interface ConstellationScene {
  draw: (ctx: CanvasRenderingContext2D, tSeconds: number) => void;
}

export function constellationScene(d: ShareData): ConstellationScene {
  const W = CARD_W, H = CARD_H;
  const accent = d.accent;
  const cx = W / 2, cy = 590, R = 392;
  const meteors = createMeteorField({ minGapS: 2.2, maxGapS: 5 });
  const RAD = TO_RAD;
  const tilt = 18 * RAD;
  // ambient dust, fixed
  const dust: [number, number, number, number][] = [];
  for (let i = 1; i <= 160; i++) {
    const fr = (x: number) => x - Math.floor(x);
    dust.push([fr(Math.sin(i * 12.9898) * 43758.5453) * W, fr(Math.sin(i * 78.233) * 12543.217) * H, 0.6 + fr(Math.sin(i * 41.17) * 7919.77) * 1.4, fr(Math.sin(i * 3.7) * 9871.3) * 6.28]);
  }
  const project = (lng: number, lat: number, lam0: number): [number, number, boolean] => {
    const phi = lat * RAD, dl = (lng - lam0) * RAD;
    const cosc = Math.sin(tilt) * Math.sin(phi) + Math.cos(tilt) * Math.cos(phi) * Math.cos(dl);
    return [cx + R * Math.cos(phi) * Math.sin(dl), cy - R * (Math.cos(tilt) * Math.sin(phi) - Math.sin(tilt) * Math.cos(phi) * Math.cos(dl)), cosc > 0.02];
  };
  // Start the globe facing the pins' mean longitude, then turn slowly.
  const lngs = d.pins.map((p) => p.lng);
  const lam0Base = lngs.length ? Math.atan2(lngs.reduce((a, l) => a + Math.sin(l * RAD), 0), lngs.reduce((a, l) => a + Math.cos(l * RAD), 0)) / RAD : 10;

  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    const lam0 = lam0Base - 20 + t * 5;
    // space
    const bg = ctx.createRadialGradient(cx, cy - 120, 80, cx, cy + 40, 980);
    bg.addColorStop(0, "#152238"); bg.addColorStop(0.5, "#0b1222"); bg.addColorStop(1, "#05080f");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (const [x, y, r, ph] of dust) {
      ctx.globalAlpha = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(t * 0.8 + ph));
      ctx.fillStyle = "#cdd9ff"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // globe glow + rim
    const glow = ctx.createRadialGradient(cx, cy - R * 0.2, R * 0.2, cx, cy, R);
    glow.addColorStop(0, "rgba(90,120,170,0.16)"); glow.addColorStop(1, "rgba(90,120,170,0.03)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    const atm = ctx.createRadialGradient(cx, cy, R - 4, cx, cy, R + 34);
    atm.addColorStop(0, "rgba(120,170,255,0)"); atm.addColorStop(0.6, "rgba(120,170,255,.16)"); atm.addColorStop(1, "rgba(120,170,255,0)");
    ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, R + 34, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.22; ctx.strokeStyle = "#dfe8ff"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

    // the ripple
    const period = 6.5;
    const rippleR = ((t % period) / period) * 1.15;
    const half = R * 1.15;
    const pulseAt = (x: number, y: number) => {
      const dd = Math.hypot(x - cx, y - cy) / half - rippleR;
      return Math.exp(-(dd * dd) / 0.004) * (1 - rippleR / 1.3);
    };
    // lines
    ctx.globalAlpha = 0.16; ctx.strokeStyle = "#dfe8ff"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    const stars = d.stars;
    for (let i = 1; i < stars.length; i++) {
      const a = stars[i - 1], b = stars[i];
      if (a.ring !== b.ring || b.idx !== a.idx + 1) continue;
      const [x1, y1, v1] = project(a.lng, a.lat, lam0);
      const [x2, y2, v2] = project(b.lng, b.lat, lam0);
      if (!v1 || !v2 || Math.hypot(x2 - x1, y2 - y1) > R * 0.3) continue;
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    // stars
    for (const s of stars) {
      const [x, y, vis] = project(s.lng, s.lat, lam0);
      if (!vis) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * 0.9 + s.phase);
      const pulse = pulseAt(x, y);
      ctx.globalAlpha = Math.min(1, 0.35 + 0.4 * tw + pulse * 0.6);
      ctx.fillStyle = "#eef3ff";
      ctx.beginPath(); ctx.arc(x, y, (s.bright ? 3.4 : 2.2) * (1 + pulse * 1.2), 0, Math.PI * 2); ctx.fill();
    }
    // ring band
    if (rippleR > 0 && rippleR < 1.1) {
      const rr = rippleR * half;
      const band = ctx.createRadialGradient(cx, cy, Math.max(0, rr - half * 0.06), cx, cy, rr + half * 0.06);
      band.addColorStop(0, "transparent"); band.addColorStop(0.5, accent); band.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.09 * (1 - rippleR / 1.2); ctx.fillStyle = band;
      ctx.beginPath(); ctx.arc(cx, cy, rr + half * 0.06, 0, Math.PI * 2); ctx.fill();
    }
    // pins
    for (const p of d.pins) {
      const [x, y, vis] = project(p.lng, p.lat, lam0);
      if (!vis) continue;
      const phase = ((p.lng * 1301 + p.lat * 7919) % 6.28318 + 6.28318) % 6.28318;
      const flick = Math.pow(0.5 + 0.5 * Math.sin(t * 1.7 + phase), 7);
      const lit = Math.min(1, 0.32 + 0.68 * flick + pulseAt(x, y) * 0.6);
      const ps = 2.6;
      if (flick > 0.3) {
        const halo = ctx.createRadialGradient(x, y - 4 * ps, 0, x, y - 4 * ps, 14 * ps);
        halo.addColorStop(0, accent); halo.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.4 * flick; ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(x, y - 4 * ps, 14 * ps, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = lit; ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(x, y - 4.2 * ps, 2.6 * ps, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = lit * 0.9; ctx.fillStyle = "#0b1220";
      ctx.beginPath(); ctx.arc(x, y - 4.2 * ps, 0.95 * ps, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    meteors.draw(ctx, W, H, t * 1000, { cx, cy, r: R });

    // type
    ctx.textAlign = "center";
    ctx.fillStyle = "#8ea6c8"; ctx.font = `600 26px ${CARD_MONO}`; ctx.letterSpacing = "10px";
    ctx.fillText("WAYPOINT", W / 2 + 5, 112); ctx.letterSpacing = "0px";
    ctx.fillStyle = "#fdf4e6"; ctx.font = `700 88px ${CARD_SERIF}`;
    ctx.shadowColor = hexA(accent, 0.3); ctx.shadowBlur = 30;
    ctx.fillText(String(d.year), W / 2, 200);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fbf6ee"; ctx.font = `500 52px ${CARD_SERIF}`;
    ctx.fillText(d.name, W / 2, 1090);
    if (d.handle) { ctx.fillStyle = "#8ea6c8"; ctx.font = `400 24px ${CARD_MONO}`; ctx.fillText(`@${d.handle}`, W / 2, 1130); }
    ctx.fillStyle = "#5f7595"; ctx.font = `600 18px ${CARD_MONO}`; ctx.letterSpacing = "3px"; ctx.fillText(siteHost().toUpperCase(), W / 2 + 2, H - 44); ctx.letterSpacing = "0px";
    const cells: [string, string][] = [[String(d.places), "PLACES"], [String(d.countries), "COUNTRIES"], [d.km >= 1000 ? `${Math.round(d.km / 1000)}k` : String(d.km), "KM"]];
    const cxs = [233, 540, 847];
    cells.forEach((cell, i) => {
      ctx.fillStyle = "#fdf4e6"; ctx.font = `700 60px ${CARD_SERIF}`; ctx.fillText(cell[0], cxs[i], 1236);
      ctx.fillStyle = "#8ea6c8"; ctx.font = `600 18px ${CARD_MONO}`; ctx.letterSpacing = "4px"; ctx.fillText(cell[1], cxs[i] + 2, 1272); ctx.letterSpacing = "0px";
    });
  };
  return { draw };
}

export function drawConstellationStill(d: ShareData, tSeconds = 2.4): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = CARD_W; c.height = CARD_H;
  constellationScene(d).draw(c.getContext("2d")!, tSeconds);
  return c;
}

/** An 8-second H.264 mp4 of the turning globe, or null where WebCodecs is
 *  missing (the caller downloads the still instead). */
let videoCancelled = false;
/** Stop a constellation render in progress; the promise resolves null. */
export function cancelConstellationVideo(): void {
  videoCancelled = true;
}

export async function renderConstellationVideo(d: ShareData, onProgress: (f: number) => void, seconds = 8): Promise<Blob | null> {
  if (typeof VideoEncoder === "undefined") return null;
  videoCancelled = false;
  const FPS = 30;
  const W = CARD_W, H = CARD_H;
  const codecs = ["avc1.640028", "avc1.4d0028", "avc1.42E01E"];
  let codec: string | null = null;
  for (const c of codecs) {
    try {
      if ((await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 8_000_000, framerate: FPS })).supported) { codec = c; break; }
    } catch { /* next */ }
  }
  if (!codec) return null;
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width: W, height: H }, fastStart: "in-memory", firstTimestampBehavior: "offset" });
  let failed = false;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: () => (failed = true) });
  encoder.configure({ codec, width: W, height: H, bitrate: 8_000_000, framerate: FPS });
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const scene = constellationScene(d);
  const frames = seconds * FPS;
  for (let i = 0; i < frames && !failed; i++) {
    scene.draw(ctx, i / FPS);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1_000_000) / FPS), duration: Math.round(1_000_000 / FPS) });
    encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    if (encoder.encodeQueueSize > 6) await new Promise<void>((r) => encoder.addEventListener("dequeue", () => r(), { once: true }));
    if (i % 6 === 0) { onProgress(i / frames); await new Promise((r) => setTimeout(r, 0)); }
    if (videoCancelled) failed = true;
  }
  if (failed) { try { encoder.close(); } catch { /* ignore */ } return null; }
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  onProgress(1);
  return new Blob([(muxer.target as ArrayBufferTarget).buffer], { type: "video/mp4" });
}
