"use client";

import { useEffect, useRef } from "react";
import { createMeteorField } from "@/lib/meteors";
import { loadStars, preloadStars, type AmbientStar, type Star } from "@/lib/constellation";
export { preloadStars };

// The Me page backdrop: the world's continents as a living constellation.
// Real coastline vertices (from the bundled world atlas) become stars that
// twinkle softly; faint segments trace the coasts like constellation lines;
// a slow ripple of light breathes outward across the whole map; and the
// profile's own pins sit on it as tiny accent pins at the exact places
// they were dropped, flicking on and off. Nothing else is in colour: no
// accent stars, no threaded path between continents — the continents alone.
//
// Two compositions share the data:
//  · Desktop — the map cover-fills the viewport (the original look).
//  · Phones — cover-scaling only ever showed a smeared crop, so instead the
//    WHOLE world renders as a fitted constellation band in the upper middle,
//    floating in a sparse ambient starfield that fills the rest of the sky.

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

export interface BackdropPin {
  lng: number;
  lat: number;
}

export default function ConstellationBackdrop({ pins = [] }: { pins?: BackdropPin[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The pin list changes rarely; the draw loop reads it through a ref so the
  // canvas is never torn down and restarted for a new pin.
  const pinsRef = useRef<BackdropPin[]>(pins);
  pinsRef.current = pins;

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
    let accent = css().getPropertyValue("--color-accent").trim() || "#c65d3b";
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
      ambient = makeAmbient(Math.round((w * h) / 14000));
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

    // Frame-scoped projection state (set at the top of draw). Desktop is a
    // flat cover-fill; phones draw a turning globe (orthographic), because a
    // whole flat world at phone width is an equirectangular map — Greenland
    // and Siberia balloon and everything else squashes.
    let pScale = 1;
    let pCx = 0;
    let pCy = 0;
    let globe: { r: number; lam0: number; tilt: number } | null = null;
    const RAD = Math.PI / 180;
    /** [x, y, visible]. On the globe, `visible` is false on the far side. */
    const project = (lng: number, lat: number): [number, number, boolean] => {
      if (!globe) return [pCx + (lng - 12) * pScale, pCy - (lat - 18) * pScale, true];
      const phi = lat * RAD, dl = (lng - globe.lam0) * RAD, phi0 = globe.tilt * RAD;
      const cosc = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dl);
      const x = pCx + globe.r * Math.cos(phi) * Math.sin(dl);
      const y = pCy - globe.r * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dl));
      return [x, y, cosc > 0.02];
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Night mode: shooting stars cross the constellation now and then.
    const meteors = createMeteorField({ minGapS: 3, maxGapS: 8 });

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
      // Desktop covers the viewport; phones get a globe above the hero card,
      // turning once every two minutes, tilted a little towards the viewer.
      pScale = mobile ? (w / 360) * 1.06 : Math.max(w / 360, h / 150) * 1.08;
      const sz = mobile ? 1 : Math.min(1.5, Math.max(1, pScale / 4.5));
      if (mobile) {
        // A whole globe, snug above the profile card: the card starts 12 px
        // under its rim (ProfileView pads the top to match), so neither a gap
        // nor a globe cut in half.
        const r = Math.min(w * 0.31, 130);
        globe = { r, lam0: reduced ? 10 : 10 + (t * 3) % 360, tilt: 18 };
        pCx = w / 2;
        pCy = 30 + r;
      } else {
        globe = null;
        pCx = w / 2 + drift;
        pCy = h / 2;
      }

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

      // Phones: a whisper of ambient dust around the world band. Ink-only,
      // few, faint — anything more read as stray pixels.
      if (mobile) {
        for (const a of ambient) {
          const tw = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.7 + a.phase);
          ctx.globalAlpha = (dark ? 0.06 : 0.09) + 0.12 * tw;
          ctx.fillStyle = inkColor;
          ctx.beginPath();
          ctx.arc(a.x * w, a.y * h, a.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // The globe itself (phones): a faint rim and a soft inner glow so the
      // sphere reads even where no coast crosses it.
      if (globe) {
        const glow = ctx.createRadialGradient(pCx, pCy - globe.r * 0.2, globe.r * 0.2, pCx, pCy, globe.r);
        glow.addColorStop(0, dark ? "rgba(90, 120, 170, 0.10)" : "rgba(10, 132, 255, 0.10)");
        glow.addColorStop(1, dark ? "rgba(90, 120, 170, 0.02)" : "rgba(10, 132, 255, 0.02)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(pCx, pCy, globe.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = dark ? 0.16 : 0.2;
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pCx, pCy, globe.r, 0, Math.PI * 2);
        ctx.stroke();
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
        const [x1, y1, v1] = project(a.lng, a.lat);
        const [x2, y2, v2] = project(b.lng, b.lat);
        if (!v1 || !v2) continue;
        if ((x1 < -40 && x2 < -40) || (x1 > w + 40 && x2 > w + 40)) continue;
        if (Math.hypot(x2 - x1, y2 - y1) > (globe ? globe.r * 0.3 : pScale * 17)) continue;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // The pulse: a ring of light that breathes outward from the heart of
      // the map every few seconds, lifting each star as it passes, over a
      // slow whole-map breath. Distances are in projection units so the
      // ripple crosses the world at the same pace on every screen.
      const breath = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.45);
      const ripplePeriod = 6.5; // seconds from centre to the far coast
      const rippleR = reduced ? -1 : ((t % ripplePeriod) / ripplePeriod) * 1.15; // 0..1.15 of the half-diagonal
      const half = globe ? globe.r * 1.15 : Math.hypot(w, h) / 2;
      const pulseAt = (x: number, y: number): number => {
        if (rippleR < 0) return 0;
        const d = Math.hypot(x - pCx, y - pCy) / half;
        const dd = d - rippleR;
        // a soft band ~9 % of the half-diagonal wide, fading as it travels
        return Math.exp(-(dd * dd) / 0.004) * (1 - rippleR / 1.3);
      };

      // Stars — twinkling coastline points, all ink. The fitted phone band is
      // dense, so it keeps only every third point of the dust.
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (mobile && !s.bright && i % 3 !== 0) continue;
        const [x, y, vis] = project(s.lng, s.lat);
        if (!vis) continue;
        if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
        const tw = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.9 + s.phase);
        const pulse = pulseAt(x, y);
        const base = dark ? 0.16 + 0.22 * tw : mobile ? 0.26 + 0.24 * tw : 0.3 + 0.3 * tw;
        ctx.globalAlpha = Math.min(1, base * (0.85 + 0.3 * breath) + pulse * (dark ? 0.6 : 0.5));
        ctx.fillStyle = inkColor;
        const r = (mobile ? 0.95 : dark ? 1.15 : 1.35) * (s.bright ? 1.5 : 1) * sz * (1 + pulse * 1.2);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // The ring itself: a faint glowing band so the pulse reads even
      // between stars.
      if (rippleR > 0 && rippleR < 1.1) {
        const rr = rippleR * half;
        const band = ctx.createRadialGradient(pCx, pCy, Math.max(0, rr - half * 0.06), pCx, pCy, rr + half * 0.06);
        band.addColorStop(0, "transparent");
        band.addColorStop(0.5, accent);
        band.addColorStop(1, "transparent");
        ctx.globalAlpha = (dark ? 0.07 : 0.06) * (1 - rippleR / 1.2);
        ctx.fillStyle = band;
        ctx.beginPath();
        ctx.arc(pCx, pCy, rr + half * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }

      // Your pins: a tiny accent pin at each exact place you have been,
      // flicking on in orange — each on its own rhythm, brighter when the
      // ripple passes through it.
      const pinList = pinsRef.current;
      const pinSz = (mobile ? 0.85 : 1) * sz;
      for (let i = 0; i < pinList.length; i++) {
        const p = pinList[i];
        const [x, y, vis] = project(p.lng, p.lat);
        if (!vis) continue;
        if (x < -12 || x > w + 12 || y < -16 || y > h + 12) continue;
        const phase = ((p.lng * 1301 + p.lat * 7919) % 6.28318 + 6.28318) % 6.28318;
        // a sharp flick: mostly dim, then a quick bright flash
        const wave = reduced ? 1 : 0.5 + 0.5 * Math.sin(t * 1.7 + phase);
        const flick = reduced ? 1 : Math.pow(wave, 7);
        const lit = Math.min(1, 0.28 + 0.72 * flick + pulseAt(x, y) * 0.6);
        if (flick > 0.35) {
          const halo = ctx.createRadialGradient(x, y - 4 * pinSz, 0, x, y - 4 * pinSz, 11 * pinSz);
          halo.addColorStop(0, accent);
          halo.addColorStop(1, "transparent");
          ctx.globalAlpha = 0.35 * flick;
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(x, y - 4 * pinSz, 11 * pinSz, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = lit;
        ctx.fillStyle = accent;
        // teardrop: a round head with a short point down to the exact spot
        ctx.beginPath();
        ctx.arc(x, y - 4.2 * pinSz, 2.6 * pinSz, Math.PI * 0.85, Math.PI * 2.15);
        ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = lit * 0.9;
        ctx.fillStyle = dark ? "#0b1220" : "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y - 4.2 * pinSz, 0.9 * pinSz, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (dark && !reduced) meteors.draw(ctx, w, h, ms);
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
    // Sized to the LARGE viewport (lvh): the canvas already extends under the
    // browser bars, so their collapse during scroll never resizes it — that
    // resize was the visible mid-scroll glitch on phones.
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 h-[100lvh] w-full"
    />
  );
}
