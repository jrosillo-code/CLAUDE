"use client";
import { useEffect, useRef } from "react";

// The hero's background: a ledger field. A grid of hairline ticks in ink on
// paper, each one leaning toward the cursor and breathing slowly, like rows
// of a statement waiting to be read. Runs only with a fine pointer and
// motion allowed, pauses off-screen, and draws at most at 2x density.

export function LedgerCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#15191f";
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1e6b4a";
    let w = 0, h = 0, dpr = 1, raf = 0, running = false, t0 = performance.now();
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    const GAP = 26, LEN = 7;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (now: number) => {
      if (!running) return;
      const t = (now - t0) / 1000;
      mouse.x += (mouse.tx - mouse.x) * 0.12; mouse.y += (mouse.ty - mouse.y) * 0.12;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1; ctx.lineCap = "round";
      const cols = Math.ceil(w / GAP) + 1, rows = Math.ceil(h / GAP) + 1;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * GAP + (j % 2 ? GAP / 2 : 0), y = j * GAP;
          const dx = mouse.x - x, dy = mouse.y - y, d = Math.hypot(dx, dy);
          const pull = Math.max(0, 1 - d / 260);
          const breathe = Math.sin(t * 0.8 + i * 0.35 + j * 0.22) * 0.35;
          const angle = pull > 0 ? Math.atan2(dy, dx) * pull + breathe * (1 - pull) : breathe;
          const len = LEN + pull * 9;
          const near = pull > 0.55;
          ctx.strokeStyle = near ? accent : ink;
          ctx.globalAlpha = 0.07 + pull * 0.45;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(angle) * len / 2, y - Math.sin(angle) * len / 2);
          ctx.lineTo(x + Math.cos(angle) * len / 2, y + Math.sin(angle) * len / 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    const start = () => { if (running) return; running = true; t0 = performance.now() - (t0 ? 0 : 0); raf = requestAnimationFrame(draw); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; };
    const onLeave = () => { mouse.tx = -9999; mouse.ty = -9999; };
    const host = canvas.parentElement ?? canvas;
    resize();
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.05 });
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); io.disconnect(); ro.disconnect(); host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerleave", onLeave); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return <canvas ref={ref} className="ledger" aria-hidden="true" />;
}
