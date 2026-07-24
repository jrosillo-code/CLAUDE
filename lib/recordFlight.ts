import type maplibregl from "maplibre-gl";
import { jetSvgMarkup, type FlyoverFrame } from "./flyover";

// Realtime flight recorder — the FALLBACK path for browsers without WebCodecs
// (the offline renderer in renderFlight.ts is preferred: it renders frame by
// frame and waits for tiles, so its output is always smooth and fully loaded).
// This one records the live flyover as it plays: the map's GL canvas is
// snapshotted on the map's own "render" event — synchronously after each GL
// draw, while the buffer is still valid — so the map does NOT need
// preserveDrawingBuffer. A 60fps compositing canvas layers the plane + avatar
// over that copy, and MediaRecorder captures the composite.

export interface FlightRecorder {
  /** Wire to the flyover's onFrame — keeps the overlay's plane in sync. */
  handleFrame: (f: FlyoverFrame) => void;
  /** Wire to the flyover's onEnd. Saves the file when completed, else discards. */
  end: (completed: boolean) => void;
}

export interface FlightAssets {
  jet: HTMLImageElement;
  avatar: HTMLImageElement;
  avatarOk: () => boolean;
}

export function loadFlightAssets(accent: string, avatarUrl: string): FlightAssets {
  const jet = new Image();
  jet.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    jetSvgMarkup(accent, "wpjet-rec", 72)
  )}`;
  const avatar = new Image();
  avatar.crossOrigin = "anonymous"; // tainted frames would abort the recording
  let ok = false;
  avatar.onload = () => (ok = true);
  avatar.src = avatarUrl;
  return { jet, avatar, avatarOk: () => ok };
}

/** Draws the jet + halo + avatar chip at (x, y) canvas-px, `k` = device-pixel
 *  scale of the target canvas relative to CSS px. Shared by both recorders. */
export function drawFlightOverlay(
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    k: number;
    heading: number;
    altitude: number;
    accent: string;
    assets: FlightAssets;
  }
): void {
  const { x, y, k, heading, altitude, accent, assets } = o;
  const s = altitude * k;

  const halo = ctx.createRadialGradient(x, y, 0, x, y, 22 * s);
  halo.addColorStop(0, `${accent}55`);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
  ctx.fill();

  const size = 36 * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((heading * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 6 * k;
  ctx.shadowOffsetY = 3 * k;
  if (assets.jet.complete && assets.jet.naturalWidth > 0) {
    ctx.drawImage(assets.jet, -size / 2, -size / 2, size, size);
  }
  ctx.restore();

  const ar = 10.5 * s;
  const ax = x + 12 * s;
  const ay = y - 12 * s;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.fillStyle = "#dfe5ee";
  ctx.fill();
  ctx.clip();
  if (assets.avatarOk()) {
    try {
      ctx.drawImage(assets.avatar, ax - ar, ay - ar, ar * 2, ar * 2);
    } catch {
      /* cross-origin without CORS — leave the neutral disc */
    }
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.lineWidth = 2 * k;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  k: number,
  year: number
): void {
  ctx.font = `600 ${13 * k}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(11,18,32,.45)";
  ctx.fillText(`Waypoint · ${year} in travel`, 14 * k, h - 14 * k);
}

export function pickRecorderMime(): string | undefined {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E", // Safari/iOS
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return undefined;
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function createFlightRecorder(
  map: maplibregl.Map,
  avatarUrl: string,
  accent: string,
  year: number,
  onDone: (saved: boolean) => void
): FlightRecorder {
  const mapCanvas = map.getCanvas();
  const rec = document.createElement("canvas");
  rec.width = mapCanvas.width;
  rec.height = mapCanvas.height;
  const ctx = rec.getContext("2d");
  const mime = pickRecorderMime();
  if (!ctx || !mime || typeof mapCanvas.captureStream !== "function") {
    onDone(false);
    return { handleFrame: () => {}, end: () => {} };
  }

  const assets = loadFlightAssets(accent, avatarUrl);

  const stream = rec.captureStream(60);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 14_000_000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Snapshot the GL canvas right after each map render, while its buffer is
  // guaranteed intact — no preserveDrawingBuffer needed.
  const mapCopy = document.createElement("canvas");
  mapCopy.width = mapCanvas.width;
  mapCopy.height = mapCanvas.height;
  const copyCtx = mapCopy.getContext("2d");
  const snapshot = () => {
    try {
      copyCtx?.drawImage(mapCanvas, 0, 0, mapCopy.width, mapCopy.height);
    } catch {
      /* keep the previous frame */
    }
  };
  map.on("render", snapshot);
  snapshot();

  let frame: FlyoverFrame | null = null;
  let raf = 0;
  let stopped = false;

  const compose = () => {
    if (stopped) return;
    const k = mapCanvas.width / mapCanvas.clientWidth;
    ctx.drawImage(mapCopy, 0, 0, rec.width, rec.height);
    if (frame) {
      const p = map.project([frame.lng, frame.lat]);
      drawFlightOverlay(ctx, {
        x: p.x * k,
        y: p.y * k,
        k,
        heading: frame.heading,
        altitude: frame.altitude,
        accent,
        assets,
      });
    }
    drawWatermark(ctx, rec.width, rec.height, mapCanvas.width / mapCanvas.clientWidth, year);
    raf = requestAnimationFrame(compose);
  };

  recorder.start(500);
  raf = requestAnimationFrame(compose);

  return {
    handleFrame: (f) => {
      frame = f;
    },
    end: (completed) => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      map.off("render", snapshot);
      recorder.onstop = () => {
        if (!completed || chunks.length === 0) {
          onDone(false);
          return;
        }
        const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
        downloadBlob(new Blob(chunks, { type: mime.split(";")[0] }), `waypoint-${year}-in-travel.${ext}`);
        onDone(true);
      };
      try {
        recorder.stop();
      } catch {
        onDone(false);
      }
    },
  };
}
