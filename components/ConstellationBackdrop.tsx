"use client";

import { useEffect, useRef } from "react";

// The Me page backdrop: the world's continents as a living constellation.
// Real coastline vertices (from the bundled world atlas) become stars that
// twinkle softly; faint segments trace the coasts like constellation lines;
// and one golden thread arcs from continent to continent with a slow pulse
// traveling along it. Everything drifts gently, like the map is breathing.
//
// Two compositions share the data:
//  · Desktop — the map cover-fills the viewport (the original look).
//  · Phones — cover-scaling only ever showed a smeared crop, so instead the
//    WHOLE world renders as a fitted constellation band in the upper middle,
//    floating in a sparse ambient starfield that fills the rest of the sky.

interface Star {
  lng: number;
  lat: number;
  phase: number;
  bright: boolean;
  ring: number; // ring id — segments only connect within a ring
  idx: number;
}

interface AmbientStar {
  x: number; // 0..1 of canvas
  y: number;
  phase: number;
  r: number;
}

// The thread's waypoints: continent hearts, in travel order.
const THREAD: [number, number][] = [
  [-100, 42], // North America
  [-60, -12], // South America
  [18, 8], // Africa
  [12, 49], // Europe
  [80, 35], // Asia
  [134, -24], // Oceania
];

let starCache: Star[] | null = null;

/** Warm the geo fetch + star sampling ahead of time (called from the map page
 *  during idle) so the Me page paints its backdrop instantly. */
export function preloadStars(): void {
  void loadStars().catch(() => {});
}

async function loadStars(): Promise<Star[]> {
  if (starCache) return starCache;
  const res = await fetch("/geo/countries-110m.json");
  const geo = await res.json();
  const stars: Star[] = [];
  let ring = 0;
  for (const f of geo.features ?? []) {
    const polys =
      f.geometry?.type === "MultiPolygon"
        ? f.geometry.coordinates
        : f.geometry?.type === "Polygon"
          ? [f.geometry.coordinates]
          : [];
    for (const poly of polys) {
      const outer: [number, number][] = poly[0] ?? [];
      ring++;
      // Sample density tuned for ~1400 stars worldwide.
      const step = Math.max(1, Math.round(outer.length / Math.max(6, outer.length / 7)));
      let idx = 0;
      for (let i = 0; i < outer.length; i += step) {
        const [lng, lat] = outer[i];
        stars.push({
          lng,
          lat,
          phase: ((lng * 7919 + lat * 104729) % 6.28318 + 6.28318) % 6.28318,
          bright: stars.length % 23 === 0,
          ring,
          idx: idx++,
        });
      }
    }
  }
  starCache = stars;
  return stars;
}

const fract = (x: number) => x - Math.floor(x);

/** Deterministic scatter for the phone sky — no Math.random so it never pops
 *  between frames or renders. */
function makeAmbient(count: number): AmbientStar[] {
  const out: AmbientStar[] = [];
  for (let i = 1; i <= count; i++) {
    out.push({
      x: fract(Math.sin(i * 12.9898) * 43758.5453),
      y: fract(Math.sin(i * 78.233) * 12543.217),
      phase: fract(Math.sin(i * 3.7) * 9871.3) * 6.28318,
      r: 0.7 + fract(Math.sin(i * 41.17) * 7919.77) * 1.0,
    });
  }
  return out;
}

export default function ConstellationBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    let ambient: AmbientStar[] = [];
    let raf = 0;
    let disposed = false;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const css = () => getComputedStyle(document.documentElement);
    let inkColor = css().getPropertyValue("--color-ink").trim() || "#0b1220";
    let accent = css().getPropertyValue("--color-accent").trim() || "#0a84ff";
    // Light mode needs more presence: on near-white paper the same alphas that
    // shimmer on Midnight read as almost blank, so daylight gets a sky wash,
    // stronger lines/stars, and halos on the bright ones. Midnight is untouched.
    let dark = document.documentElement.getAttribute("data-theme") === "dark";
    const themeObserver = new MutationObserver(() => {
      inkColor = css().getPropertyValue("--color-ink").trim() || inkColor;
      accent = css().getPropertyValue("--color-accent").trim() || accent;
      dark = document.documentElement.getAttribute("data-theme") === "dark";
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ambient = makeAmbient(Math.round((w * h) / 8000));
    };
    resize();
    // Debounced: mobile browsers fire a resize storm while the URL bar
    // collapses, and re-projecting every event made the sky visibly glitch.
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 180);
    };
    window.addEventListener("resize", onResize);

    // Frame-scoped projection state (set at the top of draw).
    let pScale = 1;
    let pCx = 0;
    let pCy = 0;
    const project = (lng: number, lat: number): [number, number] => [
      pCx + (lng - 12) * pScale,
      pCy - (lat - 18) * pScale,
    ];

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The twinkle is slow — 30fps is indistinguishable and halves the canvas
    // cost, which keeps profile scrolling smooth on phones.
    let lastFrame = 0;
    const draw = (ms: number) => {
      if (!reduced && ms - lastFrame < 31) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastFrame = ms;
      const t = ms / 1000;
      const drift = reduced ? 0 : Math.sin(t * 0.07) * 10;

      const mobile = w < 640;
      // Desktop covers the viewport; phones fit the world by width and let it
      // float as a band — measured elements scale with the projection.
      pScale = mobile ? (w / 360) * 1.06 : Math.max(w / 360, h / 150) * 1.08;
      const sz = mobile ? 1 : Math.min(1.5, Math.max(1, pScale / 4.5));
      pCx = w / 2 + (mobile ? drift * 0.4 : drift);
      pCy = mobile ? h * 0.4 : h / 2;

      ctx.clearRect(0, 0, w, h);

      // Daylight only: a cool sky wash from the top so the constellation sits
      // in atmosphere instead of on flat paper — the glass cards pop against it.
      if (!dark) {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, "rgba(10, 132, 255, 0.11)");
        sky.addColorStop(0.5, "rgba(48, 176, 199, 0.05)");
        sky.addColorStop(1, "rgba(10, 132, 255, 0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);
      }

      // Phones: a sparse ambient starfield fills the sky around the world band.
      // Ink-only dust — colored dots out in the void read as stray pixels.
      if (mobile) {
        for (const a of ambient) {
          const tw = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.7 + a.phase);
          ctx.globalAlpha = (dark ? 0.08 : 0.12) + 0.16 * tw;
          ctx.fillStyle = inkColor;
          ctx.beginPath();
          ctx.arc(a.x * w, a.y * h, a.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Constellation lines — consecutive coastline stars, faint.
      ctx.lineWidth = 1;
      ctx.strokeStyle = inkColor;
      ctx.globalAlpha = dark ? 0.07 : mobile ? 0.12 : 0.15;
      ctx.beginPath();
      for (let i = 1; i < stars.length; i++) {
        const a = stars[i - 1];
        const b = stars[i];
        if (a.ring !== b.ring || b.idx !== a.idx + 1) continue;
        const [x1, y1] = project(a.lng, a.lat);
        const [x2, y2] = project(b.lng, b.lat);
        if ((x1 < -40 && x2 < -40) || (x1 > w + 40 && x2 > w + 40)) continue;
        if (Math.hypot(x2 - x1, y2 - y1) > pScale * 17) continue;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Stars — twinkling coastline points. The fitted phone band is dense, so
      // it keeps every accent star but only every third of the dust.
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (mobile && !s.bright && i % 3 !== 0) continue;
        const [x, y] = project(s.lng, s.lat);
        if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
        const tw = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.9 + s.phase);
        if (s.bright) {
          if (!dark) {
            // A soft halo lifts the accent stars off the light paper.
            const halo = ctx.createRadialGradient(x, y, 0, x, y, 7 * sz);
            halo.addColorStop(0, accent);
            halo.addColorStop(1, "transparent");
            ctx.globalAlpha = 0.14 + 0.14 * tw;
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(x, y, 7 * sz, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = dark ? 0.35 + 0.4 * tw : 0.55 + 0.4 * tw;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(x, y, (mobile ? 1.7 : dark ? 1.9 : 2.2) * sz, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = dark ? 0.16 + 0.22 * tw : mobile ? 0.26 + 0.24 * tw : 0.3 + 0.3 * tw;
          ctx.fillStyle = inkColor;
          ctx.beginPath();
          ctx.arc(x, y, (mobile ? 0.95 : dark ? 1.15 : 1.35) * sz, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // The thread — a soft curve stitched continent to continent…
      const pts = THREAD.map(([lng, lat]) => project(lng, lat));
      ctx.globalAlpha = dark ? 0.28 : 0.5;
      ctx.strokeStyle = accent;
      ctx.lineWidth = (dark ? 1.4 : 1.6) * sz;
      ctx.setLineDash([1 * sz, 7 * sz]);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      const lift = mobile ? Math.max(24, pScale * 14) : pScale * 14;
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1];
        const [x, y] = pts[i];
        ctx.quadraticCurveTo(px, py - lift, (px + x) / 2, (py + y) / 2 - lift / 2);
        ctx.quadraticCurveTo(x, y - lift / 2, x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // …with a pulse traveling along it.
      if (!reduced) {
        const seg = (t * 0.18) % (THREAD.length - 1);
        const i = Math.floor(seg);
        const f = seg - i;
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const arcLift = mobile ? Math.max(18, pScale * 10) : pScale * 10;
        const px = x1 + (x2 - x1) * f;
        const py = y1 + (y2 - y1) * f - Math.sin(f * Math.PI) * arcLift;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 14 * sz);
        glow.addColorStop(0, accent);
        glow.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 14 * sz, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(px, py, 2.4 * sz, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (!disposed && !reduced) raf = requestAnimationFrame(draw);
    };

    void loadStars().then((s) => {
      if (disposed) return;
      stars = s;
      raf = requestAnimationFrame(draw);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
    />
  );
}
