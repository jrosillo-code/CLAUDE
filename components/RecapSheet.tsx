"use client";

import { useRouter } from "next/navigation";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { LANDMARKS } from "@/lib/landmarks";
import { coverUrl } from "@/lib/data";
import type { Pin } from "@/lib/types";

// Year in travel: a Wrapped-style recap computed from your own pins, with a
// downloadable share card. All client-side, all from data already loaded.
export default function RecapSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pins = useStore((s) => s.pins);
  const viewerId = useStore((s) => s.viewerId);
  const likeCounts = useStore((s) => s.likeCounts);
  const users = useStore((s) => s.users);
  const requestRecapFlight = useStore((s) => s.requestRecapFlight);

  const viewer = users.find((u) => u.id === viewerId);
  const year = new Date().getFullYear();
  const allMine = pins.filter((p) => p.userId === viewerId);
  const mine = allMine
    .filter((p) => new Date(p.startedOn ?? p.createdAt).getFullYear() === year)
    .sort(
      (a, b) =>
        new Date(a.startedOn ?? a.createdAt).getTime() - new Date(b.startedOn ?? b.createdAt).getTime()
    );

  const countries = new Set(mine.map((p) => p.countryCode).filter(Boolean));
  const km = Math.round(
    mine.slice(1).reduce((sum, p, i) => sum + dist(mine[i], p), 0)
  );
  const topRated = [...mine].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  const mostLiked = [...mine].sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0))[0];
  const landmarksVisited = LANDMARKS.filter((lm) =>
    mine.some((p) => distLL(p.lat, p.lng, lm.lat, lm.lng) < 40)
  );

  function downloadCards() {
    const accentRaw = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent")
      .trim();
    const accent = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accentRaw) ? accentRaw : "#ef8322";
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const season =
      mine.length > 0
        ? `${MONTHS[new Date(mine[0].startedOn ?? mine[0].createdAt).getMonth()]}–${MONTHS[new Date(mine[mine.length - 1].startedOn ?? mine[mine.length - 1].createdAt).getMonth()]}`
        : "—";
    const data: CardData = {
      year,
      name: viewer?.displayName ?? "A traveler",
      handle: viewer?.handle ?? "",
      stops: mine.map((p) => ({ lat: p.lat, lng: p.lng, name: p.placeName })),
      places: mine.length,
      countries: countries.size,
      km,
      landmarks: landmarksVisited.length,
      topRated: topRated?.placeName ?? "—",
      season,
      accent,
    };
    downloadCanvas(drawNightfallCard(data), `waypoint-${year}-nightfall.png`);
    // Stagger the second: some browsers drop back-to-back programmatic saves.
    window.setTimeout(
      () => downloadCanvas(drawPassCard(data), `waypoint-${year}-boarding-pass.png`),
      700
    );
  }

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{year} in travel</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-5 py-5">
        {mine.length === 0 ? (
          <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
            <div className="text-2xl">🗺️</div>
            <p className="mt-2 font-display text-lg">No pins yet this year</p>
            <p className="mt-1 text-sm text-ink-3">Drop your first {year} pin and come back.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Big n={mine.length} label={mine.length === 1 ? "place pinned" : "places pinned"} />
              <Big n={countries.size} label={countries.size === 1 ? "country" : "countries"} />
              <Big n={km} label="km between pins" format />
              <Big n={landmarksVisited.length} label="world landmarks" />
            </div>

            {topRated && topRated.rating != null && (
              <Highlight
                title="Place of the year"
                sub={`${topRated.placeName} — you rated it ${topRated.rating}/10`}
                img={coverUrl(topRated)}
              />
            )}
            {mostLiked && (likeCounts[mostLiked.id] ?? 0) > 0 && (
              <Highlight
                title="Friends' favorite"
                sub={`${mostLiked.title} · ${(likeCounts[mostLiked.id] ?? 0).toLocaleString()} likes`}
                img={coverUrl(mostLiked)}
              />
            )}
            {landmarksVisited.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                  Landmarks you passed
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {landmarksVisited.slice(0, 8).map((lm) => (
                    <span key={lm.id} className="rounded-full bg-paper-2 px-2.5 py-1 text-xs text-ink-2">
                      {lm.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={downloadCards}
              className="mt-6 w-full rounded-full bg-accent py-3 text-sm font-semibold text-paper"
            >
              Download share cards ↓
            </button>
            <p className="mt-1.5 text-center text-xs text-ink-3">
              Two designs — a night-globe route card and a boarding pass.
            </p>
          </>
        )}

        {/* The flight film: replays the journey on the map while recording it,
            then downloads the video. With no pins this year it flies the whole
            journey instead, so the button works year-round. */}
        {allMine.length >= 2 && (
          <>
            <button
              onClick={() => {
                requestRecapFlight();
                onClose();
                router.push("/");
              }}
              className="mt-2 w-full rounded-full bg-ink py-3 text-sm font-semibold text-paper"
            >
              🎬 Save your flight film
            </button>
            <p className="mt-1.5 text-center text-xs text-ink-3">
              {mine.length
                ? `Flies from your home base through every ${year} pin and downloads the video.`
                : "Flies your whole journey pin to pin and downloads the video."}
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ── Share cards ────────────────────────────────────────────────────────────
// Two downloadable 1080×1350 PNGs, drawn entirely in canvas so they work from
// the recap sheet (no live map needed) and render identically on every device.

interface CardData {
  year: number;
  name: string;
  handle: string;
  stops: { lat: number; lng: number; name: string }[];
  places: number;
  countries: number;
  km: number;
  landmarks: number;
  topRated: string;
  season: string;
  accent: string;
}

const TO_RAD = Math.PI / 180;
const CARD_SERIF = "Georgia, 'Times New Roman', serif";
const CARD_MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  const r = mix(parseInt(n.slice(0, 2), 16));
  const g = mix(parseInt(n.slice(2, 4), 16));
  const b = mix(parseInt(n.slice(4, 6), 16));
  return `rgb(${r},${g},${b})`;
}
// Orthographic globe projection: lat/lng → screen, with front-hemisphere test.
function ortho(lat: number, lon: number, lat0: number, lon0: number, R: number, cx: number, cy: number) {
  const φ = lat * TO_RAD, λ = lon * TO_RAD, φ0 = lat0 * TO_RAD, λ0 = lon0 * TO_RAD;
  const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0);
  const x = R * Math.cos(φ) * Math.sin(λ - λ0);
  const y = R * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0));
  return { x: cx + x, y: cy - y, vis: cosc >= -0.02 };
}
// Great-circle interpolation between two [lat,lon] points.
function slerpLL(a: [number, number], b: [number, number], t: number): [number, number] {
  const φ1 = a[0] * TO_RAD, λ1 = a[1] * TO_RAD, φ2 = b[0] * TO_RAD, λ2 = b[1] * TO_RAD;
  const d = 2 * Math.asin(
    Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2)
  );
  if (d === 0) return a;
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return [Math.atan2(z, Math.sqrt(x * x + y * y)) / TO_RAD, Math.atan2(y, x) / TO_RAD];
}
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function code3(name: string): string {
  const s = (name || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
  return (s.slice(0, 3) || "···").padEnd(3, "·");
}
function kmShort(km: number): string {
  return km >= 1000 ? `${Math.round(km / 1000)}k` : String(km);
}
function downloadCanvas(c: HTMLCanvasElement, filename: string) {
  const a = document.createElement("a");
  a.download = filename;
  a.href = c.toDataURL("image/png");
  a.click();
}

// ── 1 · Nightfall — the globe with your route glowing across a night Earth ──
function drawNightfallCard(d: CardData): HTMLCanvasElement {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const accent = d.accent;

  // Deep-space ground.
  const bg = ctx.createRadialGradient(540, 420, 80, 540, 620, 920);
  bg.addColorStop(0, "#14213b");
  bg.addColorStop(0.46, "#0a1122");
  bg.addColorStop(1, "#060a14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Deterministic star dust.
  for (let i = 0; i < 170; i++) {
    const x = (i * 127.1) % W, y = (i * 313.7) % H, r = ((i * 13) % 10) / 10 * 1.4 + 0.2;
    ctx.globalAlpha = 0.04 + ((i * 7) % 10) / 60;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = "#cdd9ff"; ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Centre the globe on the route.
  const cx = 540, cy = 662, R = 366;
  let lat0 = 20, lon0 = 0;
  if (d.stops.length) {
    const lons = d.stops.map((s) => s.lng);
    for (let i = 1; i < lons.length; i++) {
      while (lons[i] - lons[i - 1] > 180) lons[i] -= 360;
      while (lons[i] - lons[i - 1] < -180) lons[i] += 360;
    }
    lon0 = lons.reduce((a, b) => a + b, 0) / lons.length;
    lat0 = Math.max(-55, Math.min(62, d.stops.reduce((a, s) => a + s.lat, 0) / d.stops.length));
  }

  // Ocean + atmosphere.
  const oc = ctx.createRadialGradient(cx - 90, cy - 110, 60, cx, cy, R);
  oc.addColorStop(0, "#183256"); oc.addColorStop(0.7, "#0f2340"); oc.addColorStop(1, "#0a1a30");
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fillStyle = oc; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, R + 26, 0, 7);
  const at = ctx.createRadialGradient(cx, cy, R - 6, cx, cy, R + 30);
  at.addColorStop(0, "rgba(120,170,255,0)");
  at.addColorStop(0.7, "rgba(120,170,255,.18)");
  at.addColorStop(1, "rgba(120,170,255,0)");
  ctx.fillStyle = at; ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
  // Graticule.
  ctx.strokeStyle = "rgba(130,165,210,.14)"; ctx.lineWidth = 1.4;
  for (let lon = -180; lon < 180; lon += 30) {
    ctx.beginPath(); let m = false;
    for (let lat = -80; lat <= 80; lat += 3) {
      const p = ortho(lat, lon, lat0, lon0, R, cx, cy);
      if (!p.vis) { m = false; continue; }
      m ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); m = true;
    }
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath(); let m = false;
    for (let lon = -180; lon <= 180; lon += 3) {
      const p = ortho(lat, lon, lat0, lon0, R, cx, cy);
      if (!p.vis) { m = false; continue; }
      m ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); m = true;
    }
    ctx.stroke();
  }
  // Route as a glowing comet line.
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const core = lighten(accent, 0.62);
  for (let seg = 0; seg < d.stops.length - 1; seg++) {
    const a: [number, number] = [d.stops[seg].lat, d.stops[seg].lng];
    const b: [number, number] = [d.stops[seg + 1].lat, d.stops[seg + 1].lng];
    const pts: { x: number; y: number; vis: boolean }[] = [];
    for (let t = 0; t <= 1; t += 1 / 44) { const s = slerpLL(a, b, t); pts.push(ortho(s[0], s[1], lat0, lon0, R, cx, cy)); }
    ([[hexA(accent, 0.16), 13], [hexA(accent, 0.5), 6], [core, 2.6]] as [string, number][]).forEach(([col, w]) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); let m = false;
      pts.forEach((p) => { if (!p.vis) { m = false; return; } m ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); m = true; });
      ctx.stroke();
    });
  }
  // Pins as embers.
  d.stops.forEach((s) => {
    const p = ortho(s.lat, s.lng, lat0, lon0, R, cx, cy);
    if (!p.vis) return;
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 7); ctx.fillStyle = hexA(accent, 0.25); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, 7); ctx.fillStyle = core; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = accent; ctx.stroke();
  });
  ctx.restore();

  // Type.
  ctx.textAlign = "center";
  ctx.fillStyle = "#8ea6c8";
  ctx.font = `600 30px ${CARD_MONO}`; ctx.letterSpacing = "10px";
  ctx.fillText("WAYPOINT", W / 2 + 5, 118);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#fdf4e6"; ctx.font = `700 152px ${CARD_SERIF}`;
  ctx.shadowColor = hexA(accent, 0.34); ctx.shadowBlur = 44;
  ctx.fillText(String(d.year), W / 2, 302);
  ctx.shadowBlur = 0;
  ctx.fillStyle = accent; ctx.font = `600 24px ${CARD_MONO}`; ctx.letterSpacing = "16px";
  ctx.fillText("A YEAR IN TRAVEL", W / 2 + 8, 352);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#fbf6ee"; ctx.font = `500 60px ${CARD_SERIF}`;
  ctx.fillText(d.name, W / 2, 1128);
  const rule = ctx.createLinearGradient(110, 0, 970, 0);
  rule.addColorStop(0, "rgba(142,166,200,0)");
  rule.addColorStop(0.5, "rgba(142,166,200,.45)");
  rule.addColorStop(1, "rgba(142,166,200,0)");
  ctx.strokeStyle = rule; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(110, 1172); ctx.lineTo(970, 1172); ctx.stroke();

  const cxs = [233, 540, 847];
  const stats: [string, string][] = [
    [String(d.places), "PLACES"],
    [String(d.countries), "COUNTRIES"],
    [kmShort(d.km), "KM"],
  ];
  stats.forEach((s, i) => {
    ctx.fillStyle = "#fdf4e6"; ctx.font = `700 66px ${CARD_SERIF}`;
    ctx.fillText(s[0], cxs[i], 1258);
    ctx.fillStyle = "#8ea6c8"; ctx.font = `600 20px ${CARD_MONO}`; ctx.letterSpacing = "4px";
    ctx.fillText(s[1], cxs[i] + 2, 1298); ctx.letterSpacing = "0px";
  });
  return c;
}

// ── 2 · Boarding Pass — your year as one travel document ──
function drawPassCard(d: CardData): HTMLCanvasElement {
  const W = 1080, H = 1350;
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
  roundRectPath(ctx, 60, 70, 960, 1210, 34); ctx.fillStyle = card; ctx.fill();
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
  ctx.letterSpacing = "0px";
  return c;
}

function Big({ n, label, format }: { n: number; label: string; format?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-2/50 p-4 text-center">
      <div className="tnum font-display text-3xl">{format ? n.toLocaleString() : n}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-3">{label}</div>
    </div>
  );
}

function Highlight({ title, sub, img }: { title: string; sub: string; img?: string | null }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-paper-2/50 p-3.5">
      {img ? (
        <img src={img} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-paper text-xl">⭐</span>
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{title}</div>
        <div className="mt-0.5 truncate text-sm font-medium">{sub}</div>
      </div>
    </div>
  );
}

function dist(a: Pin, b: Pin): number {
  return distLL(a.lat, a.lng, b.lat, b.lng);
}
function distLL(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
