// DOM markers: the Waypoint needle (pins, clusters, trip stops, the ghost
// for saved places), the field-report flight marker, and the you-are-here
// dot. Pure element builders — no map, no store.

// THE Waypoint marker: a sewing-pin needle — round ball head (photo or avatar)
// on a thin gray stick with a specular gleam, tip planted on the location.
// Used for everything: pins, clusters (stacked pair, no count), trip stops.
// The ring around the head carries the theme color.
export function needleEl(opts: {
  photo?: string;
  ring: string;
  scale: number;
  stacked: boolean;
  ghost: boolean;
  /** Cluster twin: the second pin's photo, so the pair reads as two pins. */
  twinPhoto?: string;
  /** Travel year — worn as a tiny badge at the base of the head. */
  year?: string;
  /** Scout details on the pin: a small reticle at the head's shoulder. */
  scout?: boolean;
  /** A live dispatch: a soft accent pulse behind the head. */
  live?: boolean;
}): HTMLDivElement {
  const { photo, ring, scale, stacked, ghost, twinPhoto, year, scout, live } = opts;
  const headSize = Math.round(26 * scale);
  const stickHeight = Math.round(20 * scale);
  const width = headSize + 14; // room for the stacked twin
  const height = headSize + stickHeight;
  const wrap = document.createElement("div");
  wrap.className = "marker-in cursor-pointer select-none";
  wrap.style.cssText = `position:relative;width:${width}px;height:${height}px;opacity:${ghost ? 0.8 : 1};filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));`;

  const needle = (dx: number, dy: number, opacity: number, small: boolean, img?: string) => {
    const h = small ? Math.round(headSize * 0.86) : headSize;
    const group = document.createElement("div");
    group.style.cssText = `position:absolute;left:0;right:0;bottom:0;top:0;transform:translate(${dx}px,${dy}px);opacity:${opacity};`;

    const stick = document.createElement("div");
    stick.style.cssText = `position:absolute;left:50%;bottom:0;width:2.5px;height:${stickHeight + h / 2}px;transform:translateX(-50%);background:#585d66;border-radius:2px;`;
    group.appendChild(stick);

    const head = document.createElement("div");
    head.style.cssText = `position:absolute;left:50%;top:${headSize - h}px;width:${h}px;height:${h}px;transform:translateX(-50%);border-radius:9999px;background-size:cover;background-position:center;background-color:${ring};box-shadow:0 0 0 1.5px rgba(255,255,255,.95),0 0 0 3.5px ${ring};`;
    const src = img ?? photo;
    if (src) head.style.backgroundImage = `url("${src}")`;
    group.appendChild(head);

    return group;
  };

  if (live) {
    // The beacon: a steady glow plus two radar rings out of phase, big
    // enough to read at planet scale where the head is a dot.
    const glow = document.createElement("div");
    glow.className = "wp-live-glow";
    glow.title = "Here now";
    glow.style.cssText = `position:absolute;left:50%;top:${headSize / 2}px;width:${headSize * 2.2}px;height:${headSize * 2.2}px;transform:translate(-50%,-50%);border-radius:9999px;background:radial-gradient(circle, ${ring} 0%, ${ring}99 35%, transparent 70%);pointer-events:none;`;
    wrap.appendChild(glow);
    for (const delay of ["0s", "-1.1s"]) {
      const pulse = document.createElement("div");
      pulse.className = "wp-live-pulse";
      pulse.style.cssText = `position:absolute;left:50%;top:${headSize / 2}px;width:${headSize * 2.6}px;height:${headSize * 2.6}px;border-radius:9999px;border:2px solid ${ring};background:${ring}55;opacity:.6;pointer-events:none;animation-delay:${delay};`;
      wrap.appendChild(pulse);
    }
  }
  if (stacked) wrap.appendChild(needle(Math.round(headSize * 0.34), -2, 0.55, true));
  wrap.appendChild(needle(0, 0, 1, false));

  // The travel year, worn like a tiny luggage tag at the base of the head
  // (replaces the old specular gleam, which read as a stray white dot on
  // avatar faces).
  if (year) {
    const tag = document.createElement("div");
    tag.textContent = `’${year.slice(2)}`;
    tag.style.cssText = `position:absolute;left:50%;top:${headSize - 4}px;transform:translateX(-50%);font-size:7px;font-weight:700;line-height:10px;padding:0 3.5px;border-radius:5px;background:rgba(255,255,255,.94);color:#2a3446;box-shadow:0 1px 2px rgba(0,0,0,.25);pointer-events:none;letter-spacing:.02em;`;
    wrap.appendChild(tag);
  }
  if (scout) {
    const glyph = document.createElement("div");
    glyph.title = "Scout details";
    glyph.style.cssText = `position:absolute;left:calc(50% + ${Math.round(headSize * 0.32)}px);top:-3px;width:13px;height:13px;border-radius:9999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);display:grid;place-items:center;pointer-events:none;`;
    glyph.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="#2a3446" stroke-width="2.4"/><circle cx="12" cy="12" r="2.4" fill="#2a3446"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="#2a3446" stroke-width="2.4" stroke-linecap="round"/></svg>`;
    wrap.appendChild(glyph);
  }
  return wrap;
}

// The blue you-are-here dot: white-ringed blue disc with a soft radar pulse,
// like Apple/Google Maps. Marker anchor is "bottom", so the disc is drawn
// hanging half below the wrapper — its center lands exactly on the location.
/** Outcome colours for the flights layer: green flew, amber refused,
 *  red fined, grey didn't try. Semantic, not the accent. */
const FLIGHT_COLOR: Record<string, string> = { flew: "#2e9e5b", refused: "#d9962b", fined: "#d64545", did_not_try: "#8a8f98" };
const FLIGHT_GLYPH: Record<string, string> = { flew: "✓", refused: "!", fined: "€", did_not_try: "–" };

export function flightEl(outcome: string, year: string, index: number): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "marker-in select-none";
  // fan the nth report on the same pin out to the right
  wrap.style.cssText = `position:relative;width:26px;height:40px;cursor:pointer;transform:translateX(${index * 14}px);`;
  const badge = document.createElement("div");
  const color = FLIGHT_COLOR[outcome] ?? FLIGHT_COLOR.did_not_try;
  badge.style.cssText = `position:absolute;left:50%;top:0;width:22px;height:22px;transform:translateX(-50%);border-radius:9999px;background:${color};color:#fff;font:700 12px/22px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff,0 1px 5px rgba(0,0,0,.35);`;
  badge.textContent = FLIGHT_GLYPH[outcome] ?? "·";
  badge.title = `${outcome.replace("_", " ")} · ${year}`;
  wrap.appendChild(badge);
  const stem = document.createElement("div");
  stem.style.cssText = `position:absolute;left:50%;top:22px;width:2px;height:16px;transform:translateX(-50%);background:${color};opacity:.8;`;
  wrap.appendChild(stem);
  return wrap;
}

export function locationDotEl(): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "select-none";
  wrap.style.cssText = "position:relative;width:44px;height:22px;pointer-events:none;";

  const halo = document.createElement("div");
  halo.className = "wp-loc-pulse";
  halo.style.cssText =
    "position:absolute;left:50%;top:22px;width:44px;height:44px;transform:translate(-50%,-50%);border-radius:9999px;background:rgba(47,124,246,.28);";
  wrap.appendChild(halo);

  const dot = document.createElement("div");
  dot.style.cssText =
    "position:absolute;left:50%;top:22px;width:17px;height:17px;transform:translate(-50%,-50%);border-radius:9999px;background:#2f7cf6;box-shadow:0 0 0 3px #fff,0 1px 6px rgba(0,0,0,.4);";
  wrap.appendChild(dot);
  return wrap;
}

