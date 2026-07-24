import {
  CRUISE_ZOOM,
  PAUSE_MS,
  SAMPLES_PER_LEG,
  SPEED_DEG_PER_S,
  type Stop,
  arcDeg,
  easeInOut,
  mercY,
  slerp,
} from "./flyover";

// The flight as a pure function of time. The live flyover animates with
// requestAnimationFrame; the film renderer instead asks "where is everything
// at t = 4.833s?" and renders that exact frame — device speed can't influence
// the result, which is what makes the exported video perfectly smooth.

export interface FlightState {
  lng: number;
  lat: number;
  zoom: number;
  heading: number;
  altitude: number;
  /** Trail reveal head, 0..1 in projected-length space. */
  frac: number;
  phase: "hold" | "fly" | "pause" | "settle";
}

export interface FlightPlan {
  path: Stop[];
  lineCoords: [number, number][];
  /** Trail fraction at which each stop is reached — drives stop markers. */
  stopFracs: number[];
  /** Duration through landing + settle (pull-back is the renderer's coda). */
  totalMs: number;
  stateAt(t: number): FlightState;
}

const HOLD0_MS = 600;
const SETTLE_MS = 900;

function bearing(a: [number, number], b: [number, number]): number {
  const dx = ((b[0] - a[0]) * Math.PI) / 180;
  const dy = mercY(b[1]) - mercY(a[1]);
  if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return 0;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

export function buildFlightPlan(stops: Stop[]): FlightPlan {
  // Unwrap longitudes so each leg takes the short way around.
  const path: Stop[] = stops.map((s) => ({ ...s }));
  for (let i = 1; i < path.length; i++) {
    while (path[i].lng - path[i - 1].lng > 180) path[i].lng -= 360;
    while (path[i].lng - path[i - 1].lng < -180) path[i].lng += 360;
  }

  // Sampled route (identical construction to the live flyover's trail).
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
  const fracAt = (leg: number, eased: number): number => {
    const fi = Math.min(lineCoords.length - 1.001, (leg + eased) * SAMPLES_PER_LEG);
    const i0 = Math.floor(fi);
    return cumFrac[i0] + (cumFrac[i0 + 1] - cumFrac[i0]) * (fi - i0);
  };
  const stopFracs = path.map((_, i) =>
    cumFrac[Math.min(cumFrac.length - 1, i * SAMPLES_PER_LEG)]
  );

  const legMs = path
    .slice(1)
    .map((b, i) => Math.min(3400, Math.max(1100, (arcDeg(path[i], b) / SPEED_DEG_PER_S) * 1000)));

  // Absolute start time of each leg (pauses between, none after the last).
  const legStart: number[] = [];
  {
    let t = HOLD0_MS;
    for (let i = 0; i < legMs.length; i++) {
      legStart.push(t);
      t += legMs[i] + (i < legMs.length - 1 ? PAUSE_MS : 0);
    }
  }
  const landMs = legStart[legStart.length - 1] + legMs[legMs.length - 1];
  const totalMs = landMs + SETTLE_MS;

  const posAt = (leg: number, eased: number): [number, number] =>
    slerp(path[leg], path[leg + 1], eased, path[leg].lng);

  const stateAt = (t: number): FlightState => {
    if (t <= HOLD0_MS) {
      const head = bearing(posAt(0, 0), posAt(0, 0.02));
      return {
        lng: path[0].lng,
        lat: path[0].lat,
        zoom: CRUISE_ZOOM,
        heading: head,
        altitude: 1,
        frac: 0,
        phase: "hold",
      };
    }
    for (let i = 0; i < legMs.length; i++) {
      const start = legStart[i];
      const end = start + legMs[i];
      if (t < end) {
        if (t < start) {
          // pause before this leg (plane sits at the leg's start stop)
          const head = bearing(posAt(i, 0), posAt(i, 0.02));
          return {
            lng: path[i].lng,
            lat: path[i].lat,
            zoom: CRUISE_ZOOM,
            heading: head,
            altitude: 1,
            frac: fracAt(i, 0),
            phase: "pause",
          };
        }
        const f = (t - start) / legMs[i];
        const eased = easeInOut(f);
        const [lng, lat] = posAt(i, eased);
        const ahead = posAt(i, Math.min(1, eased + 0.015));
        const zoomOut = legMs[i] > 1800 ? 0.45 : 0.15;
        return {
          lng,
          lat,
          zoom: CRUISE_ZOOM - zoomOut * Math.sin(f * Math.PI),
          heading: bearing([lng, lat], ahead),
          altitude: 1 + 0.22 * Math.sin(f * Math.PI),
          frac: fracAt(i, eased),
          phase: "fly",
        };
      }
    }
    // Landed: settle at the final stop.
    const last = path[path.length - 1];
    return {
      lng: last.lng,
      lat: last.lat,
      zoom: CRUISE_ZOOM,
      heading: bearing(posAt(legMs.length - 1, 0.985), posAt(legMs.length - 1, 1)),
      altitude: 1,
      frac: 1,
      phase: "settle",
    };
  };

  return { path, lineCoords, stopFracs, totalMs, stateAt };
}
