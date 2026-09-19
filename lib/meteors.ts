// Shooting stars for night mode. A small scheduler spawns a streak every few
// seconds at a random point in the upper sky, flying down and across at a
// shallow angle; each fades in a second. Drawn onto whatever canvas the
// caller hands it, so the globe's space backdrop and the profile
// constellation share one look. Deterministic-free by design: real
// randomness is the point of a meteor.

export interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornMs: number;
  lifeMs: number;
  /** Tail length in CSS px at full brightness. */
  tail: number;
  /** 0.6–1: a faint one or a bright one. */
  glow: number;
}

/** A disc to keep meteors out of: the globe's silhouette on the map, where
 *  the space canvas is masked away and a streak would fly unseen. */
export interface Avoid {
  cx: number;
  cy: number;
  r: number;
}

export interface MeteorField {
  /** Advance and draw. Returns true when something was drawn. */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, nowMs: number, avoid?: Avoid | null) => boolean;
  /** Force one now (used by tests and screenshots). */
  spawn: (w: number, h: number, nowMs: number, avoid?: Avoid | null) => void;
  count: () => number;
}

export interface MeteorOptions {
  /** Seconds between streaks, sampled uniformly. */
  minGapS?: number;
  maxGapS?: number;
  /** CSS colour of the head and tail (defaults to a cool white). */
  color?: string;
  rnd?: () => number;
}

export function createMeteorField(opts: MeteorOptions = {}): MeteorField {
  const rnd = opts.rnd ?? Math.random;
  const minGap = (opts.minGapS ?? 1.6) * 1000;
  const maxGap = (opts.maxGapS ?? 4.5) * 1000;
  const color = opts.color ?? "rgba(226, 236, 255, 1)";
  const rgb = color.match(/\d+\s*,\s*\d+\s*,\s*\d+/)?.[0] ?? "226, 236, 255";
  let meteors: Meteor[] = [];
  let nextAt = -1;

  const spawn = (w: number, h: number, nowMs: number, avoid?: Avoid | null) => {
    // Start in the upper part of the sky, outside the globe when there is
    // one, and fly down-and-across at 15–40° below the horizontal — fast
    // enough to cross a phone in about a second.
    const angle = ((15 + rnd() * 25) * Math.PI) / 180;
    const dir = rnd() < 0.5 ? 1 : -1;
    const speed = 420 + rnd() * 380; // px/s
    let x = 0, y = 0;
    if (avoid) {
      // Sample in the ring of sky around the planet — mostly above it — so
      // the streak starts where the space canvas is actually visible.
      const margin = avoid.r * 1.12 + 12;
      const maxD = Math.max(margin + 40, Math.hypot(Math.max(avoid.cx, w - avoid.cx), Math.max(avoid.cy, h - avoid.cy)));
      let placed = false;
      for (let tries = 0; tries < 24; tries++) {
        const theta = Math.PI + rnd() * Math.PI * 1.3 - Math.PI * 0.15; // upper half, spilling a little past the equator
        const d = margin + rnd() * (maxD - margin);
        x = avoid.cx + Math.cos(theta) * d;
        y = avoid.cy + Math.sin(theta) * d;
        if (x >= 0 && x <= w && y >= 0 && y <= h) { placed = true; break; }
      }
      if (!placed) return; // the sky is all planet right now — skip this one
    } else {
      x = dir > 0 ? rnd() * w * 0.6 : w * 0.4 + rnd() * w * 0.6;
      y = rnd() * h * 0.6;
    }
    meteors.push({
      x,
      y,
      vx: Math.cos(angle) * speed * dir,
      vy: Math.sin(angle) * speed,
      bornMs: nowMs,
      lifeMs: 900 + rnd() * 600,
      tail: 110 + rnd() * 130,
      glow: rnd() < 0.3 ? 1 : 0.65 + rnd() * 0.3,
    });
  };

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, nowMs: number, avoid?: Avoid | null): boolean => {
    if (nextAt < 0) nextAt = nowMs + minGap + rnd() * (maxGap - minGap);
    if (nowMs >= nextAt) {
      spawn(w, h, nowMs, avoid);
      // now and then two come together
      if (rnd() < 0.18) spawn(w, h, nowMs + 120, avoid);
      nextAt = nowMs + minGap + rnd() * (maxGap - minGap);
    }
    meteors = meteors.filter((m) => nowMs - m.bornMs < m.lifeMs && nowMs >= m.bornMs);
    if (!meteors.length) return false;
    ctx.save();
    ctx.lineCap = "round";
    for (const m of meteors) {
      const age = (nowMs - m.bornMs) / m.lifeMs; // 0..1
      // quick rise, long fall
      const alpha = (age < 0.15 ? age / 0.15 : 1 - (age - 0.15) / 0.85) * m.glow;
      const t = (nowMs - m.bornMs) / 1000;
      const hx = m.x + m.vx * t;
      const hy = m.y + m.vy * t;
      const len = m.tail * (0.4 + 0.6 * Math.min(1, age * 3));
      const norm = Math.hypot(m.vx, m.vy) || 1;
      const tx = hx - (m.vx / norm) * len;
      const ty = hy - (m.vy / norm) * len;
      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, `rgba(${rgb}, 0)`);
      grad.addColorStop(0.7, `rgba(${rgb}, ${(0.55 * alpha).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${rgb}, ${alpha.toFixed(3)})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4 + m.glow * 1.1;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      // the head: a bright point with a soft halo
      const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, 6 + 6 * m.glow);
      halo.addColorStop(0, `rgba(${rgb}, ${(0.9 * alpha).toFixed(3)})`);
      halo.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(hx, hy, 6 + 6 * m.glow, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return true;
  };

  return { draw, spawn, count: () => meteors.length };
}
