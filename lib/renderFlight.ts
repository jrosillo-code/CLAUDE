import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import {
  ArrayBufferTarget as WebMTarget,
  Muxer as WebMMuxer,
} from "webm-muxer";
import type maplibregl from "maplibre-gl";
import { HOLD0_MS, buildFlightPlan } from "./flightPlan";
import { CRUISE_ZOOM, arcDeg, type Stop } from "./flyover";
import {
  downloadBlob,
  drawFlightOverlay,
  drawWatermark,
  loadFlightAssets,
} from "./recordFlight";

// The flight film, rendered like a film: frame by frame on a deterministic
// clock. For every output frame the camera is placed exactly, THEN we wait
// for the map's tiles for that view, THEN the frame is composited and encoded
// with an explicit timestamp (WebCodecs → mp4/webm muxer).
//
// The map contributes ONLY the basemap. Trail, stops, plane, title and end
// cards are all drawn straight into the composite — no GL layers, no GeoJSON
// worker round-trips, nothing that can race a fast GPU and produce trail-less
// frames (which is exactly what happened on real phones). What the composite
// draws is what every device gets.

export type RenderResult = "saved" | "cancelled" | "unsupported" | "failed";

const FPS = 30;
const PULLBACK_MS = 1800;
const HOLD_END_MS = 2200;
const CANCEL_EVENT = "wp-flight-render-cancel";

/** Fire this event (the progress overlay's Cancel button does) to abort. */
export function cancelFlightRender(): void {
  window.dispatchEvent(new Event(CANCEL_EVENT));
}

/** Resolves once the current camera's tiles are loaded and drawn at least
 *  once. One render tick when the cache is warm; idle-wait only on misses. */
function settleFrame(map: maplibregl.Map, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(to);
      map.off("idle", finish);
      resolve();
    };
    const to = setTimeout(finish, timeoutMs);
    map.once("render", () => {
      let ready = false;
      try {
        ready = map.areTilesLoaded();
      } catch {
        ready = false;
      }
      if (ready) finish();
      else map.once("idle", finish);
    });
    map.triggerRepaint();
  });
}

interface CodecChoice {
  codec: string;
  container: "mp4" | "webm";
  webmCodecId?: "V_VP9" | "V_VP8";
}

// H.264/mp4 first (plays everywhere, iOS-friendly); VP9/VP8 webm as the
// fallback for browsers that encode VP but not H.264 (e.g. Firefox).
async function pickCodec(width: number, height: number): Promise<CodecChoice | null> {
  if (typeof VideoEncoder === "undefined") return null;
  const candidates: CodecChoice[] = [
    { codec: "avc1.640028", container: "mp4" },
    { codec: "avc1.4d0028", container: "mp4" },
    { codec: "avc1.42002a", container: "mp4" },
    { codec: "avc1.42E01E", container: "mp4" },
    { codec: "vp09.00.10.08", container: "webm", webmCodecId: "V_VP9" },
    { codec: "vp8", container: "webm", webmCodecId: "V_VP8" },
  ];
  for (const c of candidates) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec: c.codec,
        width,
        height,
        bitrate: 10_000_000,
        framerate: FPS,
      });
      if (supported) return c;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 before a, 1 after b, smooth in between. */
const ramp = (t: number, a: number, b: number) => {
  const f = clamp01((t - a) / (b - a));
  return f * f * (3 - 2 * f);
};

export async function renderFlightFilm(
  map: maplibregl.Map,
  // The maplibre module itself — its setNow/restoreNow drive the library's
  // internal clock, so time-based transitions (the globe↔mercator projection
  // morph) advance with OUR frame clock instead of wall time. Without this the
  // zoom-out frames capture mid-morph states that look like the map bulging.
  ml: { setNow: (n: number) => void; restoreNow: () => void },
  stops: Stop[],
  avatarUrl: string,
  accent: string,
  year: number,
  stats: { places: number; countries: number },
  onProgress: (fraction: number) => void
): Promise<RenderResult> {
  if (stops.length < 2) return "failed";

  const mapCanvas = map.getCanvas();
  // Target dimensions: cap the long edge at 1280, keep aspect, force even.
  const srcW = mapCanvas.width;
  const srcH = mapCanvas.height;
  const scale = Math.min(1, 1280 / Math.max(srcW, srcH));
  const W = Math.round((srcW * scale) / 2) * 2;
  const H = Math.round((srcH * scale) / 2) * 2;

  const choice = await pickCodec(W, H);
  if (!choice) return "unsupported";

  const plan = buildFlightPlan(stops);
  const assets = loadFlightAssets(accent, avatarUrl);

  // When each stop is reached, in film time — drives dot pop-ins and pulses.
  const frameMs = 1000 / FPS;
  const stopArriveMs = plan.stopFracs.map((f, si) => {
    if (si === 0) return 0;
    for (let t = 0; t <= plan.totalMs; t += frameMs) {
      if (plan.stateAt(t).frac >= f - 1e-6) return t;
    }
    return plan.totalMs;
  });

  // Where the pull-back lands: the whole journey in frame.
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [lng, lat] of plan.lineCoords) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  const endCam = map.cameraForBounds(
    [[west, south], [east, north]],
    { padding: 90, maxZoom: 5 }
  );
  const endCenter = endCam?.center
    ? (endCam.center as maplibregl.LngLat)
    : ({ lng: plan.path[plan.path.length - 1].lng, lat: plan.path[plan.path.length - 1].lat } as maplibregl.LngLat);
  const endZoom = endCam?.zoom ?? 3;

  const totalMs = plan.totalMs + PULLBACK_MS + HOLD_END_MS;
  const frames = Math.ceil((totalMs / 1000) * FPS);

  const saved = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };

  let cancelled = false;
  const onCancel = () => (cancelled = true);
  window.addEventListener(CANCEL_EVENT, onCancel);

  const work = document.createElement("canvas");
  work.width = W;
  work.height = H;
  const ctx = work.getContext("2d");
  if (!ctx) {
    window.removeEventListener(CANCEL_EVENT, onCancel);
    return "failed";
  }

  let encodeFailed = false;
  const mp4Muxer =
    choice.container === "mp4"
      ? new Muxer({
          target: new ArrayBufferTarget(),
          video: { codec: "avc", width: W, height: H },
          fastStart: "in-memory",
          firstTimestampBehavior: "offset",
        })
      : null;
  const webmMuxer =
    choice.container === "webm"
      ? new WebMMuxer({
          target: new WebMTarget(),
          video: { codec: choice.webmCodecId!, width: W, height: H, frameRate: FPS },
          firstTimestampBehavior: "offset",
        })
      : null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) =>
      mp4Muxer ? mp4Muxer.addVideoChunk(chunk, meta) : webmMuxer!.addVideoChunk(chunk, meta),
    error: () => (encodeFailed = true),
  });
  const encCfg = { codec: choice.codec, width: W, height: H, bitrate: 10_000_000, framerate: FPS };
  // Ask for the GPU encoder outright where it exists.
  let preferHw = false;
  try {
    preferHw =
      (await VideoEncoder.isConfigSupported({ ...encCfg, hardwareAcceleration: "prefer-hardware" }))
        .supported === true;
  } catch {
    preferHw = false;
  }
  encoder.configure(preferHw ? { ...encCfg, hardwareAcceleration: "prefer-hardware" } : encCfg);

  // The GL canvas is only safely readable right after a draw — snapshot it on
  // every render event and composite from the snapshot.
  const mapCopy = document.createElement("canvas");
  mapCopy.width = srcW;
  mapCopy.height = srcH;
  const copyCtx = mapCopy.getContext("2d");
  const snapshot = () => {
    try {
      // Clear first: outside the globe the GL canvas is transparent, and
      // stale pixels from earlier (larger) globes would otherwise pile up
      // into outward rings during the pull-back.
      copyCtx?.clearRect(0, 0, srcW, srcH);
      copyCtx?.drawImage(mapCanvas, 0, 0, srcW, srcH);
    } catch {
      /* keep previous frame */
    }
  };
  map.on("render", snapshot);

  // In the app, the page shows through the map's transparent surroundings;
  // the film has no page, so paint the same backdrop under every frame.
  const spaceBg =
    getComputedStyle(document.documentElement).getPropertyValue("--color-paper").trim() ||
    getComputedStyle(document.body).backgroundColor ||
    "#f5f2ec";

  // Cinematic vignette — precomputed once.
  const vignette = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.52,
    W / 2, H / 2, Math.max(W, H) * 0.78
  );
  vignette.addColorStop(0, "rgba(12,16,28,0)");
  vignette.addColorStop(1, "rgba(12,16,28,0.16)");

  const inkText = "#181a20";
  const fontStack = "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif";

  // ── The trail, drawn by hand ───────────────────────────────────────────
  // Screen-projects the revealed portion of the route each frame and strokes
  // it as a comet: soft accent glow, steady tail, bright head. Points on the
  // globe's far side are culled; antimeridian jumps break the pen.
  const drawTrail = (headFrac: number, k: number, settled: number) => {
    if (headFrac <= 1e-4) return;
    const c = map.getCenter();
    const cam = { lng: c.lng, lat: c.lat };
    type Pt = { x: number; y: number; f: number } | null;
    const pts: Pt[] = [];
    const push = (lng: number, lat: number, f: number) => {
      if (arcDeg({ lng, lat }, cam) > 80) {
        pts.push(null);
        return;
      }
      const p = map.project([lng, lat]);
      pts.push({ x: p.x * k, y: p.y * k, f });
    };
    const { lineCoords, lineFracs } = plan;
    for (let i = 0; i < lineCoords.length; i++) {
      const f = lineFracs[i];
      if (f >= headFrac) {
        const f0 = lineFracs[i - 1] ?? 0;
        const tt = (headFrac - f0) / Math.max(1e-9, f - f0);
        push(
          lineCoords[i - 1][0] + (lineCoords[i][0] - lineCoords[i - 1][0]) * tt,
          lineCoords[i - 1][1] + (lineCoords[i][1] - lineCoords[i - 1][1]) * tt,
          headFrac
        );
        break;
      }
      push(lineCoords[i][0], lineCoords[i][1], f);
    }

    const stroke = (fromF: number, toF: number, width: number, alpha: number) => {
      ctx.lineWidth = width;
      ctx.strokeStyle = accent;
      ctx.globalAlpha = alpha;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      let pen = false;
      let prev: Pt = null;
      for (const p of pts) {
        if (!p || p.f < fromF) {
          pen = false;
          prev = p;
          continue;
        }
        if (p.f > toF) break;
        if (pen && prev && Math.abs(p.x - prev.x) > W / 3) pen = false;
        if (!pen) {
          ctx.moveTo(p.x, p.y);
          pen = true;
        } else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // Glow, then tail, then the comet head brightening toward the plane.
    stroke(0, headFrac, 9 * k, 0.08 + 0.05 * settled);
    stroke(0, headFrac, 4.6 * k, 0.13 + 0.07 * settled);
    stroke(0, headFrac, 2.2 * k, 0.38 + 0.42 * settled);
    if (settled < 1) {
      const HEAD = 0.1;
      const slices = 7;
      for (let s = 0; s < slices; s++) {
        const a = headFrac - HEAD * (1 - s / slices);
        const b = headFrac - HEAD * (1 - (s + 1) / slices);
        const glowT = s / (slices - 1);
        stroke(Math.max(0, a), Math.max(0, b), (2.4 + 1.1 * glowT) * k, 0.45 + 0.55 * glowT);
      }
    }
  };

  try {
    // First view + tile-cache warm-up along the whole route (each leg's
    // cruise and zoomed-out midsection, then the pull-back view), so capture
    // frames almost never stop for the network.
    const s0 = plan.stateAt(0);
    map.jumpTo({ center: [s0.lng, s0.lat], zoom: s0.zoom, bearing: 0, pitch: 0 });
    await settleFrame(map, 4000);
    for (let wt = 0; wt <= plan.totalMs && !cancelled; wt += 600) {
      const s = plan.stateAt(wt);
      map.jumpTo({ center: [s.lng, s.lat], zoom: s.zoom, bearing: 0, pitch: 0 });
      await settleFrame(map, 700);
      onProgress(0.05 * (wt / plan.totalMs));
    }
    if (!cancelled) {
      map.jumpTo({ center: [endCenter.lng, endCenter.lat], zoom: endZoom, bearing: 0, pitch: 0 });
      await settleFrame(map, 900);
    }

    const easeInOutQ = (f: number) => f * f * (3 - 2 * f);
    let lastCamKey = "";

    for (let i = 0; i < frames; i++) {
      if (cancelled || encodeFailed) break;
      const t = (i * 1000) / FPS;
      // Deterministic library clock: projection morphs etc. follow film time.
      ml.setNow(t);

      let planeVisible = false;
      let fracNow = 1;
      let settled = 0;
      let px = 0, py = 0, heading = 0, altitude = 1;
      let camLng: number, camLat: number, camZoom: number;

      if (t <= plan.totalMs) {
        const s = plan.stateAt(t);
        camLng = s.lng;
        camLat = s.lat;
        camZoom = s.zoom;
        planeVisible = s.phase !== "settle";
        settled = s.phase === "settle" ? 1 : 0;
        fracNow = s.frac;
        heading = s.heading;
        altitude = s.altitude;
      } else {
        // Coda: pull back to frame the journey, trail settles to steady.
        const p = Math.min(1, (t - plan.totalMs) / PULLBACK_MS);
        const e = easeInOutQ(p);
        const last = plan.path[plan.path.length - 1];
        camLng = last.lng + (endCenter.lng - last.lng) * e;
        camLat = last.lat + (endCenter.lat - last.lat) * e;
        camZoom = CRUISE_ZOOM + (endZoom - CRUISE_ZOOM) * e;
        settled = 1;
      }

      // Holds and pauses repeat the same camera — reuse the last snapshot
      // instead of forcing a repaint + settle for an identical view.
      const camKey = `${camLng.toFixed(6)},${camLat.toFixed(6)},${camZoom.toFixed(4)}`;
      if (camKey !== lastCamKey) {
        map.jumpTo({ center: [camLng, camLat], zoom: camZoom, bearing: 0, pitch: 0 });
        await settleFrame(map, 2000);
        lastCamKey = camKey;
      }
      if (cancelled) break;

      if (planeVisible) {
        const p = map.project([camLng, camLat]);
        px = p.x;
        py = p.y;
      }

      const k = W / mapCanvas.clientWidth;
      ctx.fillStyle = spaceBg;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(mapCopy, 0, 0, W, H);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      drawTrail(fracNow, k, settled);

      // Stops: faint ring while upcoming; pop + pulse as the plane arrives.
      for (let si = 0; si < plan.path.length; si++) {
        const arrive = stopArriveMs[si];
        const visited = t >= arrive - 1;
        const sp = map.project([plan.path[si].lng, plan.path[si].lat]);
        const sx = sp.x * k;
        const sy = sp.y * k;
        if (sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40) continue;
        if (arcDeg(plan.path[si], { lng: camLng, lat: camLat }) > 80) continue;
        const age = t - arrive;
        if (visited && age < 750) {
          // arrival pulse ring
          const pf = age / 750;
          ctx.beginPath();
          ctx.arc(sx, sy, (6 + 22 * easeInOutQ(pf)) * k, 0, Math.PI * 2);
          ctx.strokeStyle = accent;
          ctx.globalAlpha = 0.55 * (1 - pf);
          ctx.lineWidth = 2 * k;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        const pop = visited ? Math.min(1, age / 240) : 0;
        const r = visited ? (4.2 + 2.2 * (pop < 1 ? 1.25 * pop : 1)) * k : 4.5 * k;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = visited ? accent : "rgba(255,255,255,.75)";
        ctx.shadowColor = "rgba(0,0,0,.28)";
        ctx.shadowBlur = 4 * k;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2 * k;
        ctx.strokeStyle = visited ? "#ffffff" : accent;
        ctx.stroke();
      }

      if (planeVisible) {
        drawFlightOverlay(ctx, { x: px * k, y: py * k, k, heading, altitude, accent, assets });
      }

      // Title card over the opening hold.
      const titleA = ramp(t, 100, 450) * (1 - ramp(t, HOLD0_MS - 380, HOLD0_MS - 80));
      if (titleA > 0.01) {
        ctx.globalAlpha = titleA;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(255,255,255,.95)";
        ctx.shadowBlur = 22 * k;
        ctx.fillStyle = inkText;
        ctx.font = `700 ${Math.round(56 * k)}px ${fontStack}`;
        ctx.fillText(`${year}`, W / 2, H * 0.42);
        ctx.fillStyle = accent;
        ctx.font = `600 ${Math.round(14 * k)}px ${fontStack}`;
        ctx.fillText("A  Y E A R  I N  T R A V E L", W / 2, H * 0.42 + 34 * k);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // End card: the year's numbers fade in over the settled world.
      const endStart = plan.totalMs + PULLBACK_MS;
      const endA = ramp(t, endStart + 200, endStart + 750);
      if (endA > 0.01) {
        ctx.globalAlpha = endA;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(255,255,255,.95)";
        ctx.shadowBlur = 18 * k;
        ctx.fillStyle = inkText;
        ctx.font = `700 ${Math.round(24 * k)}px ${fontStack}`;
        ctx.fillText(
          `${stats.places} ${stats.places === 1 ? "place" : "places"} · ${stats.countries} ${stats.countries === 1 ? "country" : "countries"}`,
          W / 2,
          H * 0.84
        );
        ctx.fillStyle = accent;
        ctx.font = `600 ${Math.round(12 * k)}px ${fontStack}`;
        ctx.fillText(`W A Y P O I N T  ·  ${year}`, W / 2, H * 0.84 + 26 * k);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      } else {
        drawWatermark(ctx, W, H, k, year);
      }

      const frame = new VideoFrame(work, {
        timestamp: Math.round((i * 1_000_000) / FPS),
        duration: Math.round(1_000_000 / FPS),
      });
      encoder.encode(frame, { keyFrame: i % (FPS * 4) === 0 });
      frame.close();
      if (encoder.encodeQueueSize > 6) {
        await new Promise<void>((r) =>
          encoder.addEventListener("dequeue", () => r(), { once: true })
        );
      }
      onProgress(0.05 + 0.95 * (i / frames));
    }

    if (!cancelled && !encodeFailed) {
      await encoder.flush();
      if (mp4Muxer) {
        mp4Muxer.finalize();
        const buf = (mp4Muxer.target as ArrayBufferTarget).buffer;
        downloadBlob(new Blob([buf], { type: "video/mp4" }), `waypoint-${year}-in-travel.mp4`);
      } else {
        webmMuxer!.finalize();
        const buf = (webmMuxer!.target as WebMTarget).buffer;
        downloadBlob(new Blob([buf], { type: "video/webm" }), `waypoint-${year}-in-travel.webm`);
      }
    }
    try {
      encoder.close();
    } catch {
      /* already closed */
    }
    return cancelled ? "cancelled" : encodeFailed ? "failed" : "saved";
  } catch {
    try {
      encoder.close();
    } catch {
      /* ignore */
    }
    return "failed";
  } finally {
    try {
      ml.restoreNow();
    } catch {
      /* ignore */
    }
    window.removeEventListener(CANCEL_EVENT, onCancel);
    map.off("render", snapshot);
    map.jumpTo({
      center: saved.center,
      zoom: saved.zoom,
      bearing: saved.bearing,
      pitch: saved.pitch,
    });
  }
}
