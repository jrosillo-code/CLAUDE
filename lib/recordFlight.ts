import type maplibregl from "maplibre-gl";
import { jetSvgMarkup, type FlyoverFrame } from "./flyover";

// The flight film: records the journey flyover into a downloadable video,
// entirely client-side. The map's WebGL canvas is copied on the map's own
// "render" event — synchronously after each GL draw, while the buffer is
// still valid — so the map does NOT need preserveDrawingBuffer (which costs
// frame rate all the time for a feature used rarely). A 60fps compositing
// canvas layers the plane + avatar over that copy, and MediaRecorder
// captures the composite.

export interface FlightRecorder {
  /** Wire to the flyover's onFrame — keeps the overlay's plane in sync. */
  handleFrame: (f: FlyoverFrame) => void;
  /** Wire to the flyover's onEnd. Saves the file when completed, else discards. */
  end: (completed: boolean) => void;
}

function pickMime(): string | undefined {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E", // Safari/iOS
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return undefined;
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

function jetImage(accent: string): HTMLImageElement {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    jetSvgMarkup(accent, "wpjet-rec", 72)
  )}`;
  return img;
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
  const mime = pickMime();
  if (!ctx || !mime || typeof mapCanvas.captureStream !== "function") {
    onDone(false);
    return { handleFrame: () => {}, end: () => {} };
  }

  const jet = jetImage(accent);
  const avatar = new Image();
  avatar.crossOrigin = "anonymous"; // tainted frames would abort the recording
  let avatarOk = false;
  avatar.onload = () => (avatarOk = true);
  avatar.src = avatarUrl;

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
    // Device-pixel ratio between the GL canvas and CSS coordinates.
    const k = mapCanvas.width / mapCanvas.clientWidth;
    ctx.drawImage(mapCopy, 0, 0, rec.width, rec.height);
    if (frame) {
      const p = map.project([frame.lng, frame.lat]);
      const x = p.x * k;
      const y = p.y * k;
      const s = frame.altitude * k;

      // Soft halo under the jet.
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 22 * s);
      halo.addColorStop(0, `${accent}55`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
      ctx.fill();

      // Jet, rotated to heading.
      const size = 36 * s;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((frame.heading * Math.PI) / 180);
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = 6 * k;
      ctx.shadowOffsetY = 3 * k;
      if (jet.complete && jet.naturalWidth > 0) {
        ctx.drawImage(jet, -size / 2, -size / 2, size, size);
      }
      ctx.restore();

      // Avatar chip riding top-right of the jet.
      const ar = 10.5 * s;
      const ax = x + 12 * s;
      const ay = y - 12 * s;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, ar, 0, Math.PI * 2);
      ctx.fillStyle = "#dfe5ee";
      ctx.fill();
      ctx.clip();
      if (avatarOk) {
        try {
          ctx.drawImage(avatar, ax - ar, ay - ar, ar * 2, ar * 2);
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

    // Watermark.
    ctx.font = `600 ${13 * k}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(11,18,32,.45)";
    ctx.fillText(`Waypoint · ${year} in travel`, 14 * k, rec.height - 14 * k);

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
        const blob = new Blob(chunks, { type: mime.split(";")[0] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `waypoint-${year}-in-travel.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
