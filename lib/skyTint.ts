// The daylight sky's tint by time of day: peach at dawn, a pale blue-white
// at midday, amber in the late afternoon — blended continuously so the sky
// is never quite the same twice. Pure, so it is testable; MapCanvas writes
// the result into CSS variables the .wp-sky layers read.

export interface SkyPalette {
  /** The glow that rises from behind the globe's rim. */
  glow: [number, number, number];
  /** The second, softer swell. */
  glow2: [number, number, number];
  /** The sky ground, top to bottom. */
  top: string;
  mid: string;
  bottom: string;
  /** 0 = dawn, 0.5 = midday, 1 = dusk. */
  t: number;
}

type RGB = [number, number, number];
const MORNING = { glow: [255, 186, 150] as RGB, glow2: [255, 160, 120] as RGB, top: "#fbefe6", mid: "#f4ebe0", bottom: "#f0dcc8" };
const MIDDAY = { glow: [255, 222, 160] as RGB, glow2: [215, 232, 255] as RGB, top: "#f4f5f4", mid: "#f1ece2", bottom: "#e9e3d6" };
const EVENING = { glow: [255, 168, 92] as RGB, glow2: [255, 140, 90] as RGB, top: "#f6e9d9", mid: "#f0e2cf", bottom: "#e6cfb0" };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a: RGB, b: RGB, f: number): RGB => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Where in the day we are: 6:00 → 0, 13:00 → 0.5, 20:00 → 1 (clamped). */
export function dayFraction(now: Date): number {
  const h = now.getHours() + now.getMinutes() / 60;
  return clamp01((h - 6) / 14);
}

export function skyPalette(now: Date): SkyPalette {
  const t = dayFraction(now);
  // morning holds until 0.2, blends to midday by 0.45, holds, blends to evening from 0.7 to 0.9
  let a: typeof MORNING, b: typeof MORNING, f: number;
  if (t < 0.2) { a = MORNING; b = MORNING; f = 0; }
  else if (t < 0.45) { a = MORNING; b = MIDDAY; f = (t - 0.2) / 0.25; }
  else if (t < 0.7) { a = MIDDAY; b = MIDDAY; f = 0; }
  else if (t < 0.9) { a = MIDDAY; b = EVENING; f = (t - 0.7) / 0.2; }
  else { a = EVENING; b = EVENING; f = 0; }
  const s = f * f * (3 - 2 * f);
  return {
    glow: mix(a.glow, b.glow, s),
    glow2: mix(a.glow2, b.glow2, s),
    top: toHex(mix(hex(a.top), hex(b.top), s)),
    mid: toHex(mix(hex(a.mid), hex(b.mid), s)),
    bottom: toHex(mix(hex(a.bottom), hex(b.bottom), s)),
    t,
  };
}

/** The CSS variables the sky layers read. */
export function skyVars(p: SkyPalette): Record<string, string> {
  const rgb = (c: RGB) => `${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}`;
  return { "--sky-glow": rgb(p.glow), "--sky-glow2": rgb(p.glow2), "--sky-top": p.top, "--sky-mid": p.mid, "--sky-bottom": p.bottom };
}
