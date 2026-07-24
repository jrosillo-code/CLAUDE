import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import {
  ArrayBufferTarget as WebMTarget,
  Muxer as WebMMuxer,
} from "webm-muxer";
import type maplibregl from "maplibre-gl";
import { buildFlightPlan } from "./flightPlan";
import {
  CRUISE_ZOOM,
  TRAIL_GLOW,
  TRAIL_LYR,
  TRAIL_SRC,
  trailGradients,
  type Stop,
} from "./flyover";
import {
  downloadBlob,
  drawFlightOverlay,
  drawWatermark,
  loadFlightAssets,
} from "./recordFlight";

// The flight film, rendered like a film: frame by frame on a deterministic
// clock. For every output frame the camera is placed exactly, THEN we wait
// for the map to finish loading and drawing that view, THEN the frame is
// composited and encoded with an explicit timestamp (WebCodecs → mp4-muxer).
// Two problems disappear by construction:
//   · half-loaded/white map in the film — a frame is only captured once the
//     map reports idle for that exact camera;
//   · choppiness — output timestamps are i/fps regardless of how long each
//     frame took to render, so playback is constant-rate smooth on any device.
// This is the approach used by maplibre-gl-video-export and browser-side
// renderers like Remotion. Falls back to the realtime recorder when WebCodecs
// H.264 isn't available (see recordFlight.ts).

export type RenderResult = "saved" | "cancelled" | "unsupported" | "failed";

const FPS = 30;
const PULLBACK_MS = 1800;
const HOLD_END_MS = 700;
const CANCEL_EVENT = "wp-flight-render-cancel";

/** Fire this event (the progress overlay's Cancel button does) to abort. */
export function cancelFlightRender(): void {
  window.dispatchEvent(new Event(CANCEL_EVENT));
}

/** Resolves once the current camera's view is fully loaded AND drawn at least
 *  once. Forces a repaint so unchanged frames (pauses, holds) settle in one
 *  render tick instead of waiting out a timeout. */
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
    const trailReady = () => {
      // The trail's GeoJSON is tiled in a worker — a fast GPU can otherwise
      // outrun it and capture trail-less frames.
      try {
        return map.isSourceLoaded(TRAIL_SRC);
      } catch {
        return true;
      }
    };
    map.once("render", () => {
      // Tile requests for this camera have been issued by now.
      if (map.loaded() && trailReady()) finish();
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
  const grads = trailGradients(accent);
  const assets = loadFlightAssets(accent, avatarUrl);

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

  const cleanupMap = () => {
    try {
      if (map.getLayer(TRAIL_LYR)) map.removeLayer(TRAIL_LYR);
      if (map.getLayer(TRAIL_GLOW)) map.removeLayer(TRAIL_GLOW);
      if (map.getSource(TRAIL_SRC)) map.removeSource(TRAIL_SRC);
    } catch {
      /* style may have changed */
    }
  };

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
  encoder.configure({ codec: choice.codec, width: W, height: H, bitrate: 10_000_000, framerate: FPS });

  // The GL canvas is only safely readable right after a draw — snapshot it on
  // every render event (same trick as the realtime recorder) and composite
  // from the snapshot, never from the live GL canvas.
  const mapCopy = document.createElement("canvas");
  mapCopy.width = srcW;
  mapCopy.height = srcH;
  const copyCtx = mapCopy.getContext("2d");
  const snapshot = () => {
    try {
      copyCtx?.drawImage(mapCanvas, 0, 0, srcW, srcH);
    } catch {
      /* keep previous frame */
    }
  };
  map.on("render", snapshot);

  try {
    cleanupMap();
    map.addSource(TRAIL_SRC, {
      type: "geojson",
      lineMetrics: true,
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: plan.lineCoords },
      },
    });
    map.addLayer({
      id: TRAIL_GLOW,
      type: "line",
      source: TRAIL_SRC,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-width": 8, "line-blur": 5, "line-gradient": grads.glow(0) as never },
    });
    map.addLayer({
      id: TRAIL_LYR,
      type: "line",
      source: TRAIL_SRC,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-width": 2.5, "line-gradient": grads.core(0) as never },
    });

    // Let the trail's worker round-trip finish before the first frame.
    await settleFrame(map, 4000);

    let lastFrac = -1;
    let settledSet = false;
    const easeInOutQ = (f: number) => f * f * (3 - 2 * f);

    for (let i = 0; i < frames; i++) {
      if (cancelled || encodeFailed) break;
      const t = (i * 1000) / FPS;
      // Deterministic library clock: projection morphs etc. follow film time.
      ml.setNow(t);

      let planeVisible = false;
      let fracNow = 1;
      let px = 0, py = 0, heading = 0, altitude = 1;

      if (t <= plan.totalMs) {
        const s = plan.stateAt(t);
        map.jumpTo({ center: [s.lng, s.lat], zoom: s.zoom, bearing: 0, pitch: 0 });
        if (Math.abs(s.frac - lastFrac) > 0.0004) {
          lastFrac = s.frac;
          map.setPaintProperty(TRAIL_LYR, "line-gradient", grads.core(s.frac) as never);
          map.setPaintProperty(TRAIL_GLOW, "line-gradient", grads.glow(s.frac) as never);
        }
        planeVisible = s.phase !== "settle";
        fracNow = s.frac;
        heading = s.heading;
        altitude = s.altitude;
        const p = map.project([s.lng, s.lat]);
        px = p.x;
        py = p.y;
      } else {
        // Coda: settle the trail, pull back to frame the journey, hold.
        if (!settledSet) {
          settledSet = true;
          map.setPaintProperty(TRAIL_LYR, "line-gradient", grads.settledCore as never);
          map.setPaintProperty(TRAIL_GLOW, "line-gradient", grads.settledGlow as never);
        }
        const p = Math.min(1, (t - plan.totalMs) / PULLBACK_MS);
        const e = easeInOutQ(p);
        const last = plan.path[plan.path.length - 1];
        map.jumpTo({
          center: [
            last.lng + (endCenter.lng - last.lng) * e,
            last.lat + (endCenter.lat - last.lat) * e,
          ],
          zoom: CRUISE_ZOOM + (endZoom - CRUISE_ZOOM) * e,
          bearing: 0,
          pitch: 0,
        });
      }

      // The contract that keeps the film clean: no capture until this exact
      // view is fully loaded and drawn.
      await settleFrame(map, 2000);
      if (cancelled) break;

      ctx.drawImage(mapCopy, 0, 0, W, H);
      const k = W / mapCanvas.clientWidth;

      // The journey's stops, drawn into the film (the app's pin needles are
      // DOM elements the GL canvas can't see). Upcoming stops wait as faint
      // rings; the plane lights each one up as it arrives.
      for (let si = 0; si < plan.path.length; si++) {
        const visited = plan.stopFracs[si] <= fracNow + 0.002;
        const sp = map.project([plan.path[si].lng, plan.path[si].lat]);
        const sx = sp.x * k;
        const sy = sp.y * k;
        if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, (visited ? 6 : 4.5) * k, 0, Math.PI * 2);
        ctx.fillStyle = visited ? accent : "rgba(255,255,255,.7)";
        ctx.shadowColor = "rgba(0,0,0,.3)";
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
      drawWatermark(ctx, W, H, k, year);

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
      onProgress(i / frames);
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
    cleanupMap();
    map.jumpTo({
      center: saved.center,
      zoom: saved.zoom,
      bearing: saved.bearing,
      pitch: saved.pitch,
    });
  }
}
