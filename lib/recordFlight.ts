import type maplibregl from "maplibre-gl";
import type { FlyoverFrame } from "./flyover";

// The flight film: records the journey flyover into a downloadable video,
// entirely client-side. The map's WebGL canvas streams into a compositing
// canvas (the plane is a DOM marker, invisible to the GL canvas, so it gets
// redrawn onto the composite each frame), and MediaRecorder captures that.
// Requires the map to be created with preserveDrawingBuffer so drawImage can
// read the GL canvas between renders.

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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="j" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fd8ff"/><stop offset="1" stop-color="${accent}"/>
    </linearGradient></defs>
    <path d="M21 15.5v-2.2l-8-5V3.6a1.5 1.5 0 0 0-3 0v4.7l-8 5v2.2l8-2.4v4.9l-2.1 1.6v1.7l3.6-1.1 3.6 1.1v-1.7L13 18v-4.9z"
      fill="url(#j)" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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

  const stream = rec.captureStream(30);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  let frame: FlyoverFrame | null = null;
  let raf = 0;
  let stopped = false;

  const compose = () => {
    if (stopped) return;
    // Device-pixel ratio between the GL canvas and CSS coordinates.
    const k = mapCanvas.width / mapCanvas.clientWidth;
    try {
      ctx.drawImage(mapCanvas, 0, 0, rec.width, rec.height);
    } catch {
      /* GL canvas momentarily unreadable — keep last frame */
    }
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
