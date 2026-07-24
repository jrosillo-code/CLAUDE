"use client";

import { useEffect, useRef } from "react";

// The Me page backdrop: the world's continents as a living constellation.
// Real coastline vertices (from the bundled world atlas) become stars that
// twinkle softly; faint segments trace the coasts like constellation lines;
// and one golden thread arcs from continent to continent with a slow pulse
// traveling along it. Everything drifts gently, like the map is breathing.

interface Star {
  lng: number;
  lat: number;
  phase: number;
  bright: boolean;
  ring: number; // ring id — segments only connect within a ring
  idx: number;
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

export default function ConstellationBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
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

    // Equirectangular, scaled to cover, nudged toward the inhabited world.
    const project = (lng: number, lat: number, drift: number): [number, number] => {
      const scale = Math.max(w / 360, h / 150) * 1.08;
      const cx = w / 2 + drift;
      const cy = h / 2;
      return [cx + (lng - 12) * scale, cy - (lat - 18) * scale];
    };

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
      // Cover-scaling zooms hard on tall narrow screens; everything measured
      // in pixels (segment reach, star size, thread arc) scales with it so a
      // phone shows the same constellation, just closer — not shredded dots.
      const scale = Math.max(w / 360, h / 150) * 1.08;
      const sz = Math.min(1.5, Math.max(1, scale / 4.5));
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

      // Constellation lines — consecutive coastline stars, faint.
      ctx.lineWidth = 1;
      ctx.strokeStyle = inkColor;
      ctx.globalAlpha = dark ? 0.07 : 0.15;
      ctx.beginPath();
      for (let i = 1; i < stars.length; i++) {
        const a = stars[i - 1];
        const b = stars[i];
        if (a.ring !== b.ring || b.idx !== a.idx + 1) continue;
        const [x1, y1] = project(a.lng, a.lat, drift);
        const [x2, y2] = project(b.lng, b.lat, drift);
        if ((x1 < -40 && x2 < -40) || (x1 > w + 40 && x2 > w + 40)) continue;
        if (Math.hypot(x2 - x1, y2 - y1) > scale * 17) continue;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // Stars — twinkling coastline points.
      for (const s of stars) {
        const [x, y] = project(s.lng, s.lat, drift);
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
          ctx.arc(x, y, (dark ? 1.9 : 2.2) * sz, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = dark ? 0.16 + 0.22 * tw : 0.3 + 0.3 * tw;
          ctx.fillStyle = inkColor;
          ctx.beginPath();
          ctx.arc(x, y, (dark ? 1.15 : 1.35) * sz, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // The thread — a soft curve stitched continent to continent…
      const pts = THREAD.map(([lng, lat]) => project(lng, lat, drift));
      ctx.globalAlpha = dark ? 0.28 : 0.5;
      ctx.strokeStyle = accent;
      ctx.lineWidth = (dark ? 1.4 : 1.6) * sz;
      ctx.setLineDash([1 * sz, 7 * sz]);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1];
        const [x, y] = pts[i];
        const lift = scale * 14;
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
        const px = x1 + (x2 - x1) * f;
        const py = y1 + (y2 - y1) * f - Math.sin(f * Math.PI) * scale * 10;
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
