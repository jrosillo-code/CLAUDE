import type maplibregl from "maplibre-gl";

// Journey flyover: tapping the Waypoint logo replays your travels — your
// avatar rides a little plane from pin to pin along a great-circle thread
// while the camera stays locked on the plane, so the globe itself glides
// underneath. Ends by framing the whole journey.
//
// The trail is drawn as ONE static line uploaded once; each frame only moves
// a gradient "reveal head" along it (setPaintProperty). No per-frame geometry
// re-uploads means the line can never lag or momentarily vanish behind the
// plane the way a growing LineString did.

export const TRAIL_SRC = "wp-flyover-src";
export const TRAIL_LYR = "wp-flyover-lyr";
export const TRAIL_GLOW = "wp-flyover-glow";
const SRC = TRAIL_SRC;
const LYR = TRAIL_LYR;
const LYR_GLOW = TRAIL_GLOW;
export const CRUISE_ZOOM = 3.4;
export const SPEED_DEG_PER_S = 26; // arc speed between stops
export const PAUSE_MS = 480; // hover at each pin
export const SAMPLES_PER_LEG = 72;
const TRANS = "rgba(0,0,0,0)";

export interface Stop {
  lng: number;
  lat: number;
}

export interface FlyoverFrame {
  lng: number;
  lat: number;
  heading: number;
  altitude: number; // 1..~1.22 mid-leg scale
}

export interface FlyoverOpts {
  /** Fires every animation frame with the plane's current state. */
  onFrame?: (f: FlyoverFrame) => void;
  /** Fires exactly once when the flyover ends; true if it ran to completion. */
  onEnd?: (completed: boolean) => void;
}

export function vec(lng: number, lat: number): [number, number, number] {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
}

export function arcDeg(a: Stop, b: Stop): number {
  const va = vec(a.lng, a.lat);
  const vb = vec(b.lng, b.lat);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  return (Math.acos(dot) * 180) / Math.PI;
}

// Spherical interpolation, then the longitude gets unwrapped near `nearLng`
// so antimeridian hops don't snap the thread across the whole map.
export function slerp(a: Stop, b: Stop, f: number, nearLng: number): [number, number] {
  const va = vec(a.lng, a.lat);
  const vb = vec(b.lng, b.lat);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const ω = Math.acos(dot);
  let x: number, y: number, z: number;
  if (ω < 1e-6) {
    [x, y, z] = va;
  } else {
    const s = Math.sin(ω);
    const ka = Math.sin((1 - f) * ω) / s;
    const kb = Math.sin(f * ω) / s;
    x = ka * va[0] + kb * vb[0];
    y = ka * va[1] + kb * vb[1];
    z = ka * va[2] + kb * vb[2];
  }
  const lat = (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI;
  let lng = (Math.atan2(y, x) * 180) / Math.PI;
  while (lng - nearLng > 180) lng -= 360;
  while (lng - nearLng < -180) lng += 360;
  return [lng, lat];
}

export const easeInOut = (f: number) => f * f * (3 - 2 * f);

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Mercator-projected Y — line-progress measures length in projected space,
 *  so the reveal head is weighted the same way the renderer weighs the line. */
export function mercY(lat: number): number {
  const φ = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + φ / 2));
}

/** Comet reveal: everything behind the head stays visible (dim → brighter near
 *  the head), everything ahead of it is transparent. Stops kept strictly
 *  ascending for the interpolate expression. */
export function revealGradient(
  head: number,
  base: string,
  near: string,
  headColor: string
): unknown[] {
  const e = 0.0015;
  const h = Math.max(0, Math.min(1 - 2 * e, head));
  if (h < 4 * e) {
    return ["interpolate", ["linear"], ["line-progress"], 0, TRANS, 1, TRANS];
  }
  const m = h - 0.25;
  const flat: unknown[] = [0, base];
  if (m > e && m < h - e) flat.push(m, near);
  flat.push(h, headColor, h + e, TRANS, 1, TRANS);
  return ["interpolate", ["linear"], ["line-progress"], ...flat];
}

/** The trail's gradient family for a given accent — shared by the live
 *  flyover and the offline film renderer so both look identical. */
export function trailGradients(accent: string) {
  return {
    core: (h: number) =>
      revealGradient(h, hexToRgba(accent, 0.3), hexToRgba(accent, 0.75), "#a5e0ff"),
    glow: (h: number) =>
      revealGradient(h, hexToRgba(accent, 0.1), hexToRgba(accent, 0.3), hexToRgba(accent, 0.8)),
    settledCore: [
      "interpolate", ["linear"], ["line-progress"],
      0, hexToRgba(accent, 0.55), 1, accent,
    ] as unknown[],
    settledGlow: [
      "interpolate", ["linear"], ["line-progress"],
      0, hexToRgba(accent, 0.15), 1, hexToRgba(accent, 0.45),
    ] as unknown[],
  };
}

/** The jet artwork — one source of truth for the DOM marker and the video
 *  recorder's canvas overlay. */
export function jetSvgMarkup(accent: string, gid: string, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8fd8ff"/>
        <stop offset="1" stop-color="${accent}"/>
      </linearGradient>
    </defs>
    <path d="M21 15.5v-2.2l-8-5V3.6a1.5 1.5 0 0 0-3 0v4.7l-8 5v2.2l8-2.4v4.9l-2.1 1.6v1.7l3.6-1.1 3.6 1.1v-1.7L13 18v-4.9z"
      fill="url(#${gid})" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`;
}

function planeEl(avatarUrl: string, accent: string) {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:46px;height:46px;pointer-events:none;z-index:5;";

  // Soft radar pulse under the jet — same keyframes as the you-are-here dot.
  const halo = document.createElement("div");
  halo.className = "wp-loc-pulse";
  halo.style.cssText = `position:absolute;left:50%;top:50%;width:42px;height:42px;border-radius:50%;background:${hexToRgba(accent, 0.3)};transform:translate(-50%,-50%);`;
  el.appendChild(halo);

  const plane = document.createElement("div");
  plane.style.cssText =
    "position:absolute;inset:0;display:grid;place-items:center;will-change:transform;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35));";
  plane.innerHTML = jetSvgMarkup(accent, `wpjet-${Math.random().toString(36).slice(2, 8)}`, 36);
  const avatar = document.createElement("img");
  avatar.src = avatarUrl;
  avatar.alt = "";
  avatar.decoding = "async";
  avatar.style.cssText =
    "position:absolute;top:-9px;right:-7px;width:21px;height:21px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);";
  el.appendChild(plane);
  el.appendChild(avatar);
  return { el, plane };
}

/**
 * Starts the flyover and returns a cancel function. Any user interaction with
 * the map cancels it too.
 */
export function startFlyover(
  map: maplibregl.Map,
  MarkerCtor: typeof maplibregl.Marker,
  LngLatBoundsCtor: typeof maplibregl.LngLatBounds,
  stops: Stop[],
  avatarUrl: string,
  accent: string,
  opts: FlyoverOpts = {}
): () => void {
  if (stops.length === 0) {
    opts.onEnd?.(false);
    return () => {};
  }

  let disposed = false;
  let completed = false;
  let raf = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => !disposed && fn(), ms);
    timers.push(t);
  };

  // Unwrap stop longitudes so each leg takes the short way around.
  const path: Stop[] = stops.map((s) => ({ ...s }));
  for (let i = 1; i < path.length; i++) {
    while (path[i].lng - path[i - 1].lng > 180) path[i].lng -= 360;
    while (path[i].lng - path[i - 1].lng < -180) path[i].lng += 360;
  }

  const { el, plane } = planeEl(avatarUrl, accent);
  const marker = new MarkerCtor({ element: el, anchor: "center" });
  let markerAdded = false;

  const cleanupMap = () => {
    try {
      if (map.getLayer(LYR)) map.removeLayer(LYR);
      if (map.getLayer(LYR_GLOW)) map.removeLayer(LYR_GLOW);
      if (map.getSource(SRC)) map.removeSource(SRC);
    } catch {
      /* style may have been swapped mid-flight */
    }
  };

  const interactionEvents = ["mousedown", "touchstart", "wheel", "dblclick"] as const;
  const onInteract = () => cancel();

  function cancel() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    interactionEvents.forEach((e) => map.off(e, onInteract));
    if (markerAdded) marker.remove();
    cleanupMap();
    opts.onEnd?.(completed);
  }

  interactionEvents.forEach((e) => map.on(e, onInteract));

  // A single pin still gets a moment: fly there, no journey to trace.
  if (path.length === 1) {
    map.flyTo({ center: [path[0].lng, path[0].lat], zoom: 5, duration: 1800, essential: true });
    later(cancel, 2200);
    return cancel;
  }

  // ── The whole route, sampled once ──
  const lineCoords: [number, number][] = [];
  {
    let prev = path[0].lng;
    for (let i = 0; i < path.length - 1; i++) {
      for (let s = i === 0 ? 0 : 1; s <= SAMPLES_PER_LEG; s++) {
        const [lng, lat] = slerp(path[i], path[i + 1], s / SAMPLES_PER_LEG, prev);
        lineCoords.push([lng, lat]);
        prev = lng;
      }
    }
  }
  // Cumulative fraction of projected line length at each sample — this is the
  // space line-progress lives in, so the reveal head sits exactly on the plane.
  const cumFrac: number[] = [0];
  {
    let total = 0;
    for (let i = 1; i < lineCoords.length; i++) {
      const dx = ((lineCoords[i][0] - lineCoords[i - 1][0]) * Math.PI) / 180;
      const dy = mercY(lineCoords[i][1]) - mercY(lineCoords[i - 1][1]);
      total += Math.hypot(dx, dy);
      cumFrac.push(total);
    }
    for (let i = 0; i < cumFrac.length; i++) cumFrac[i] = total > 0 ? cumFrac[i] / total : 0;
  }

  // Leg durations from arc length, clamped so short hops still read and long
  // hauls don't drag.
  const legMs = path
    .slice(1)
    .map((b, i) =>
      Math.min(3400, Math.max(1100, (arcDeg(path[i], b) / SPEED_DEG_PER_S) * 1000))
    );

  const { core: coreGradient, glow: glowGradient } = trailGradients(accent);

  const begin = () => {
    if (disposed) return;
    cleanupMap();
    try {
      map.addSource(SRC, {
        type: "geojson",
        lineMetrics: true, // enables line-progress for the reveal gradient
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: lineCoords },
        },
      });
      // Comet trail: a wide soft glow underlay plus a bright core; both are
      // revealed by moving the gradient head — geometry never changes.
      map.addLayer({
        id: LYR_GLOW,
        type: "line",
        source: SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": 8,
          "line-blur": 5,
          "line-gradient": glowGradient(0) as never,
        },
      });
      map.addLayer({
        id: LYR,
        type: "line",
        source: SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-width": 2.5, "line-gradient": coreGradient(0) as never },
      });
    } catch {
      cancel();
      return;
    }
    marker.setLngLat([path[0].lng, path[0].lat]).addTo(map);
    markerAdded = true;
    opts.onFrame?.({ lng: path[0].lng, lat: path[0].lat, heading: 0, altitude: 1 });

    let leg = 0;
    let phase: "fly" | "pause" = "pause";
    let phaseStart = performance.now();
    let headingDeg: number | null = null;
    let lastLng = path[0].lng;
    let lastFrac = -1;

    const frame = (now: number) => {
      if (disposed) return;
      if (phase === "pause") {
        if (now - phaseStart >= (leg === 0 ? 350 : PAUSE_MS)) {
          phase = "fly";
          phaseStart = now;
        }
        raf = requestAnimationFrame(frame);
        return;
      }
      const f = Math.min(1, (now - phaseStart) / legMs[leg]);
      const eased = easeInOut(f);
      const [lng, lat] = slerp(path[leg], path[leg + 1], eased, lastLng);
      lastLng = lng;
      try {
        marker.setLngLat([lng, lat]);

        // Reveal the trail up to the plane — interpolated in projected space.
        const fi = Math.min(lineCoords.length - 1.001, (leg + eased) * SAMPLES_PER_LEG);
        const i0 = Math.floor(fi);
        const frac = cumFrac[i0] + (cumFrac[i0 + 1] - cumFrac[i0]) * (fi - i0);
        if (Math.abs(frac - lastFrac) > 0.0006) {
          lastFrac = frac;
          map.setPaintProperty(LYR, "line-gradient", coreGradient(frac) as never);
          map.setPaintProperty(LYR_GLOW, "line-gradient", glowGradient(frac) as never);
        }

        // Point the plane along its actual on-screen motion — with the heading
        // low-pass filtered so projection jitter never twitches the nose — and
        // scale it up mid-leg for a hint of cruising altitude.
        const ahead = slerp(path[leg], path[leg + 1], Math.min(1, eased + 0.02), lng);
        const p1 = map.project([lng, lat]);
        const p2 = map.project(ahead);
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.5) {
          const target = (Math.atan2(p2.x - p1.x, -(p2.y - p1.y)) * 180) / Math.PI;
          if (headingDeg == null) {
            headingDeg = target;
          } else {
            let d = target - headingDeg;
            while (d > 180) d -= 360;
            while (d < -180) d += 360;
            headingDeg += d * 0.22;
          }
        }
        const altitude = 1 + 0.22 * Math.sin(f * Math.PI);
        plane.style.transform = `rotate(${headingDeg ?? 0}deg) scale(${altitude})`;
        opts.onFrame?.({ lng, lat, heading: headingDeg ?? 0, altitude });
        // The camera rides the plane — the globe does the moving — and eases
        // out a touch on long hauls, like gaining altitude.
        const zoomOut = legMs[leg] > 1800 ? 0.45 : 0.15;
        map.jumpTo({
          center: [lng, lat],
          zoom: CRUISE_ZOOM - zoomOut * Math.sin(f * Math.PI),
        });
      } catch {
        cancel();
        return;
      }
      if (f >= 1) {
        leg++;
        if (leg >= legMs.length) {
          finish();
          return;
        }
        phase = "pause";
        phaseStart = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  };

  const finish = () => {
    completed = true;
    // Land, settle the full route to a steady glow, then pull back to frame
    // the whole journey; the thread lingers a beat before the cleanup.
    try {
      const settledCore = [
        "interpolate", ["linear"], ["line-progress"],
        0, hexToRgba(accent, 0.55), 1, accent,
      ];
      const settledGlow = [
        "interpolate", ["linear"], ["line-progress"],
        0, hexToRgba(accent, 0.15), 1, hexToRgba(accent, 0.45),
      ];
      map.setPaintProperty(LYR, "line-gradient", settledCore as never);
      map.setPaintProperty(LYR_GLOW, "line-gradient", settledGlow as never);
    } catch {
      /* ignore */
    }
    later(() => {
      if (markerAdded) marker.remove();
      markerAdded = false;
      try {
        const b = new LngLatBoundsCtor();
        lineCoords.forEach(([lng, lat]) => b.extend([lng, lat]));
        map.fitBounds(b, { padding: 90, maxZoom: 5, duration: 2200, essential: true });
      } catch {
        /* ignore */
      }
      later(cancel, 3400);
    }, 650);
  };

  // Intro: glide to the first pin at cruise altitude, then take off.
  map.flyTo({
    center: [path[0].lng, path[0].lat],
    zoom: CRUISE_ZOOM,
    pitch: 0,
    bearing: 0,
    duration: 1500,
    essential: true,
  });
  later(begin, 1550);

  return cancel;
}
