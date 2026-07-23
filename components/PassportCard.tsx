"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Pin } from "@/lib/types";
import { computePassport, flagEmoji } from "@/lib/passport";
import { findCountryAt } from "@/lib/focus";

// The Passport: a traveler's world at a glance — visited countries lit up on a
// flat world map, coverage stats, first/latest trips, and per-continent bars.
// Purely derived from the profile's visible pins, so it works on any profile.

interface GeoFeature {
  properties?: { name?: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

let geoCache: GeoFeature[] | null = null;
async function loadGeo(): Promise<GeoFeature[]> {
  if (geoCache) return geoCache;
  const res = await fetch("/geo/countries-110m.json");
  const fc = (await res.json()) as { features: GeoFeature[] };
  geoCache = fc.features ?? [];
  return geoCache;
}

// Resolved pin→country-polygon names are cached across renders and profiles.
const visitedNameCache = new Map<string, string | null>();

export default function PassportCard({ pins }: { pins: Pin[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stats = useMemo(() => computePassport(pins), [pins]);

  // One representative pin per country keeps the geometric resolution cheap.
  const reps = useMemo(() => {
    const seen = new Set<string>();
    const out: Pin[] = [];
    for (const p of pins) {
      const cc = (p.countryCode || "??").toUpperCase();
      if (seen.has(cc)) continue;
      seen.add(cc);
      out.push(p);
    }
    return out;
  }, [pins]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let disposed = false;

    const draw = (features: GeoFeature[], visited: Set<string>) => {
      if (disposed) return;
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue("--color-accent").trim() || "#0a84ff";
      const ink = css.getPropertyValue("--color-ink").trim() || "#0b1220";
      const paper = css.getPropertyValue("--color-paper").trim() || "#f3f5f8";

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      // Equirectangular, poles cropped (85°N..57°S) — Antarctica is skipped.
      const h = Math.round((w * 142) / 360);
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const px = (lng: number) => ((lng + 180) / 360) * w;
      const py = (lat: number) => ((85 - lat) / 142) * h;

      for (const f of features) {
        const name = f.properties?.name ?? "";
        if (name === "Antarctica") continue;
        const polys =
          f.geometry.type === "Polygon"
            ? [f.geometry.coordinates as number[][][]]
            : (f.geometry.coordinates as number[][][][]);
        const hit = visited.has(name);
        ctx.beginPath();
        for (const poly of polys) {
          const ring = poly[0] ?? [];
          if (!ring.length) continue;
          // Unwrap longitudes so antimeridian-crossing rings (Russia, Fiji)
          // don't smear a line across the whole map; anything pushed past the
          // edge gets drawn again shifted a full turn so both sides fill.
          const lngs: number[] = [ring[0][0]];
          for (let i = 1; i < ring.length; i++) {
            let l = ring[i][0];
            while (l - lngs[i - 1] > 180) l -= 360;
            while (l - lngs[i - 1] < -180) l += 360;
            lngs.push(l);
          }
          const offsets = [0];
          if (Math.max(...lngs) > 180) offsets.push(-360);
          if (Math.min(...lngs) < -180) offsets.push(360);
          for (const off of offsets) {
            for (let i = 0; i < ring.length; i++) {
              const x = px(lngs[i] + off);
              const y = py(ring[i][1]);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
          }
        }
        ctx.fillStyle = hit ? accent : ink;
        ctx.globalAlpha = hit ? 0.92 : 0.14;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = paper;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    };

    let features: GeoFeature[] = [];
    let visited = new Set<string>();

    const run = async () => {
      features = await loadGeo();
      // Resolve each represented country to the polygon it actually contains —
      // no fragile name↔code mapping, the same geometry Focus uses.
      const names = await Promise.all(
        reps.map(async (p) => {
          const key = `${p.lng.toFixed(3)},${p.lat.toFixed(3)}`;
          if (visitedNameCache.has(key)) return visitedNameCache.get(key)!;
          const c = await findCountryAt(p.lng, p.lat);
          visitedNameCache.set(key, c?.name ?? null);
          return c?.name ?? null;
        })
      );
      visited = new Set(names.filter((n): n is string => !!n));
      draw(features, visited);
    };
    void run();

    const redraw = () => draw(features, visited);
    const themeObserver = new MutationObserver(redraw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener("resize", redraw);
    return () => {
      disposed = true;
      themeObserver.disconnect();
      window.removeEventListener("resize", redraw);
    };
  }, [reps]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  const pct = Math.round(stats.coveragePct * 1000) / 10;
  const ring = 2 * Math.PI * 26;

  return (
    <div className="mt-4 rounded-3xl bg-paper/85 p-5 shadow-float backdrop-blur">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl">Passport</h2>
        <span className="text-xs text-ink-3">where you&apos;ve stamped the world</span>
      </div>

      <canvas ref={canvasRef} aria-hidden className="mt-3 w-full" />

      {/* Tally strip */}
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="tnum font-display text-xl">
            {stats.continentsVisited}
            <span className="text-sm text-ink-3">/{stats.continentsTotal}</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-ink-3">continents</div>
        </div>
        <div>
          <div className="tnum font-display text-xl">
            {stats.codes.length}
            <span className="text-sm text-ink-3">/{stats.countriesTotal}</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-ink-3">countries</div>
        </div>
        <div>
          <div className="tnum font-display text-xl">{stats.cities}</div>
          <div className="text-[11px] uppercase tracking-wide text-ink-3">places</div>
        </div>
      </div>

      {/* World coverage */}
      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-paper-2/60 p-3.5 ring-1 ring-line/60">
        <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90">
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-line)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${stats.coveragePct * ring} ${ring}`}
          />
          <text
            x="32"
            y="32"
            transform="rotate(90 32 32)"
            textAnchor="middle"
            dominantBaseline="central"
            className="tnum fill-ink"
            fontSize="13"
            fontWeight="700"
          >
            {pct}%
          </text>
        </svg>
        <div className="min-w-0">
          <div className="font-display text-base">World coverage</div>
          <div className="text-sm text-ink-2">
            {stats.codes.length} of {stats.countriesTotal} countries
          </div>
        </div>
      </div>

      {/* First / latest stamp */}
      {stats.first && (
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-paper-2/60 px-3.5 py-3 ring-1 ring-line/60">
            <div className="text-[11px] uppercase tracking-wide text-ink-3">
              ✈ First trip {stats.first.code ? flagEmoji(stats.first.code) : ""}
            </div>
            <div className="tnum mt-0.5 text-sm font-semibold">{fmt(stats.first.date)}</div>
          </div>
          <div className="rounded-2xl bg-paper-2/60 px-3.5 py-3 ring-1 ring-line/60">
            <div className="text-[11px] uppercase tracking-wide text-ink-3">
              🛬 Most recent {stats.latest?.code ? flagEmoji(stats.latest.code) : ""}
            </div>
            <div className="tnum mt-0.5 text-sm font-semibold">
              {stats.latest ? fmt(stats.latest.date) : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Continent coverage bars — only the ones with a stamp lead the list */}
      <ul className="mt-4 space-y-2.5">
        {stats.perContinent.map((c) => (
          <li key={c.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className={c.visited ? "font-medium" : "text-ink-3"}>{c.label}</span>
              <span className="tnum text-xs text-ink-3">
                {c.visited}/{c.total}
                {c.visited > 0 && (
                  <span className="ml-1 text-accent">({Math.round(c.pct * 100)}%)</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/70">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-700"
                style={{ width: `${Math.max(c.visited > 0 ? 2 : 0, c.pct * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
