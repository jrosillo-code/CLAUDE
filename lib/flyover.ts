import type maplibregl from "maplibre-gl";

// Journey flyover: tapping the Waypoint logo replays your travels — your
// avatar rides a little plane from pin to pin along a great-circle thread
// while the camera stays locked on the plane, so the globe itself glides
// underneath. Ends by framing the whole journey.

const SRC = "wp-flyover-src";
const LYR = "wp-flyover-lyr";
const CRUISE_ZOOM = 3.4;
const SPEED_DEG_PER_S = 26; // arc speed between stops
const PAUSE_MS = 480; // hover at each pin

interface Stop {
  lng: number;
  lat: number;
}

function vec(lng: number, lat: number): [number, number, number] {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
}

function arcDeg(a: Stop, b: Stop): number {
  const va = vec(a.lng, a.lat);
  const vb = vec(b.lng, b.lat);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  return (Math.acos(dot) * 180) / Math.PI;
}

// Spherical interpolation, then the longitude gets unwrapped near `nearLng`
// so antimeridian hops don't snap the thread across the whole map.
function slerp(a: Stop, b: Stop, f: number, nearLng: number): [number, number] {
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

const easeInOut = (f: number) => f * f * (3 - 2 * f);

function planeEl(avatarUrl: string, accent: string) {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:46px;height:46px;pointer-events:none;z-index:5;";
  const plane = document.createElement("div");
  plane.style.cssText =
    "position:absolute;inset:0;display:grid;place-items:center;will-change:transform;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35));";
  plane.innerHTML = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none">
    <path d="M21 15.5v-2.2l-8-5V3.6a1.5 1.5 0 0 0-3 0v4.7l-8 5v2.2l8-2.4v4.9l-2.1 1.6v1.7l3.6-1.1 3.6 1.1v-1.7L13 18v-4.9z"
      fill="${accent}" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round"/>
  </svg>`;
  const avatar = document.createElement("img");
  avatar.src = avatarUrl;
  avatar.alt = "";
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
  accent: string
): () => void {
  if (stops.length === 0) return () => {};

  let disposed = false;
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
  const trail: [number, number][] = [];

  const cleanupMap = () => {
    try {
      if (map.getLayer(LYR)) map.removeLayer(LYR);
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
  }

  interactionEvents.forEach((e) => map.on(e, onInteract));

  // A single pin still gets a moment: fly there, no journey to trace.
  if (path.length === 1) {
    map.flyTo({ center: [path[0].lng, path[0].lat], zoom: 5, duration: 1800, essential: true });
    later(cancel, 2200);
    return cancel;
  }

  // Leg durations from arc length, clamped so short hops still read and long
  // hauls don't drag.
  const legMs = path
    .slice(1)
    .map((b, i) =>
      Math.min(3400, Math.max(1100, (arcDeg(path[i], b) / SPEED_DEG_PER_S) * 1000))
    );

  const begin = () => {
    if (disposed) return;
    cleanupMap();
    try {
      map.addSource(SRC, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
      });
      map.addLayer({
        id: LYR,
        type: "line",
        source: SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": accent, "line-width": 2.5, "line-opacity": 0.9 },
      });
    } catch {
      cancel();
      return;
    }
    marker.setLngLat([path[0].lng, path[0].lat]).addTo(map);
    markerAdded = true;
    trail.push([path[0].lng, path[0].lat]);

    let leg = 0;
    let phase: "fly" | "pause" = "pause";
    let phaseStart = performance.now();

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
      const prevLng = trail[trail.length - 1][0];
      const [lng, lat] = slerp(path[leg], path[leg + 1], easeInOut(f), prevLng);
      trail.push([lng, lat]);
      try {
        (map.getSource(SRC) as maplibregl.GeoJSONSource | undefined)?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: trail },
        });
        marker.setLngLat([lng, lat]);
        // Point the plane along its actual on-screen motion.
        const ahead = slerp(path[leg], path[leg + 1], Math.min(1, easeInOut(f) + 0.02), lng);
        const p1 = map.project([lng, lat]);
        const p2 = map.project(ahead);
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.5) {
          const deg = (Math.atan2(p2.x - p1.x, -(p2.y - p1.y)) * 180) / Math.PI;
          plane.style.transform = `rotate(${deg}deg)`;
        }
        // The camera rides the plane — the globe does the moving.
        map.jumpTo({ center: [lng, lat] });
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
    // Land, breathe, then pull back to frame the whole journey; the thread
    // lingers a beat before fading out with the cleanup.
    later(() => {
      if (markerAdded) marker.remove();
      markerAdded = false;
      try {
        const b = new LngLatBoundsCtor();
        trail.forEach(([lng, lat]) => b.extend([lng, lat]));
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
