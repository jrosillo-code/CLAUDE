"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useFriends, useViewer } from "@/lib/hooks";

// World coverage, together: how many of the world's countries you and your
// friends have pinned between you. Reaching ALL of them triggers the
// easter egg — confetti and a golden globe. (Tap the row five times fast to
// preview the celebration; that's an easter egg about the easter egg.)
const WORLD_TARGET = 195; // UN members + observers

export default function WorldProgress() {
  const pins = useStore((s) => s.pins);
  const viewer = useViewer();
  const friends = useFriends();
  const [celebrate, setCelebrate] = useState<"preview" | "real" | null>(null);
  const taps = useRef<number[]>([]);

  const covered = useMemo(() => {
    const crew = new Set([viewer.id, ...friends.map((f) => f.id)]);
    const codes = new Set<string>();
    for (const p of pins) {
      if (crew.has(p.userId) && p.countryCode) codes.add(p.countryCode.toUpperCase());
    }
    return codes;
  }, [pins, viewer.id, friends]);

  const complete = covered.size >= WORLD_TARGET;

  // The real thing: fire once when the crew completes the world.
  useEffect(() => {
    if (!complete) return;
    try {
      if (window.localStorage.getItem("wp-world-complete")) return;
      window.localStorage.setItem("wp-world-complete", "1");
    } catch {
      /* still celebrate */
    }
    setCelebrate("real");
  }, [complete]);

  function tap() {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2200), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      setCelebrate("preview");
    }
  }

  const pct = Math.min(100, Math.round((covered.size / WORLD_TARGET) * 100));

  return (
    <>
      <button
        onClick={tap}
        className="mt-1.5 w-full rounded-xl px-2 py-1.5 text-left hover:bg-paper-2"
        title={`${covered.size} of ${WORLD_TARGET} countries pinned by you and your friends`}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
          <span>{complete ? "🏆" : "🌍"}</span>
          <span>
            {complete
              ? "The whole world, together"
              : `${covered.size} of ${WORLD_TARGET} countries together`}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-2">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.max(2, pct)}%`,
              background: complete
                ? "linear-gradient(90deg,#d9a52b,#f0c75e)"
                : "var(--color-accent-2)",
            }}
          />
        </div>
      </button>

      {celebrate && (
        <WorldCompleteOverlay
          preview={celebrate === "preview"}
          covered={covered.size}
          onClose={() => setCelebrate(null)}
        />
      )}
    </>
  );
}

function WorldCompleteOverlay({
  preview,
  covered,
  onClose,
}: {
  preview: boolean;
  covered: number;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Confetti: cheap particles, ~4 seconds, no library.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#d9a52b", "#c65d3b", "#2f6b6b", "#f0c75e", "#8a4fc6", "#fdfaf4"];
    const parts = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 2 + Math.random() * 3.5,
      vx: -1.2 + Math.random() * 2.4,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    let raf = 0;
    const started = performance.now();
    const tick = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.y / 40);
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t - started < 4500) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/60 backdrop-blur-sm" onClick={onClose}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      <div
        className="animate-sheet relative mx-5 max-w-sm rounded-3xl bg-paper p-8 text-center shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl">🏆🌍</div>
        <h2 className="mt-4 font-display text-3xl leading-tight">
          {preview ? "Someday…" : "The whole world."}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          {preview
            ? `This is what it'll look like when you and your friends have pinned every country on Earth. Current crew total: ${covered} of ${WORLD_TARGET}. Keep going.`
            : `You and your friends have pinned every country on Earth — all ${WORLD_TARGET}. There is no map left. Go back and love the places twice.`}
        </p>
        <button
          onClick={onClose}
          className="mt-6 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper"
        >
          {preview ? "Back to the map" : "🥂 Onward"}
        </button>
      </div>
    </div>
  );
}
