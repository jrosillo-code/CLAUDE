"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { reverseGeocode } from "@/lib/geocode";
import { BriefIcon } from "./BriefIcon";

// "Brief here": a field brief for wherever the map is looking, no search and
// no pin needed. Uses the map's centre (the last reported view bounds); the
// place name comes from the reverse geocoder and falls back to coordinates
// when that's offline, so the brief itself never waits on it.
export function BriefHereButton({ bubbleLeft = false }: { bubbleLeft?: boolean }) {
  const viewBounds = useStore((s) => s.viewBounds);
  const userLocation = useStore((s) => s.userLocation);
  const openBrief = useStore((s) => s.openBrief);
  // A searched place makes this button the next step: it glows, and briefs
  // that place rather than the map centre. Clearing the search (the ✕ in
  // the box, or a tap on the bare map) stops the glow.
  const searched = useStore((s) => s.searchedPlace);
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;
    if (searched) {
      openBrief({ lat: searched.lat, lng: searched.lng, placeName: searched.name, countryCode: searched.countryCode, origin: "search" });
      return;
    }
    const centre = viewBounds
      ? { lng: (viewBounds.w + viewBounds.e) / 2, lat: (viewBounds.s + viewBounds.n) / 2 }
      : userLocation;
    if (!centre) return;
    setBusy(true);
    try {
      const geo = await Promise.race([
        reverseGeocode(centre.lng, centre.lat),
        new Promise<null>((r) => setTimeout(() => r(null), 3000)),
      ]);
      openBrief({
        lat: centre.lat,
        lng: centre.lng,
        placeName: geo?.placeName ?? `${centre.lat.toFixed(3)}, ${centre.lng.toFixed(3)}`,
        countryCode: geo?.countryCode || undefined,
        origin: "map",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      title={searched ? `Field brief for ${searched.name}` : "Field brief for this spot"}
      aria-label={searched ? `Field brief for ${searched.name}` : "Field brief for this spot"}
      className={`group relative grid h-11 w-11 place-items-center rounded-full shadow-float backdrop-blur transition-colors ${
        searched ? "wp-brief-glow bg-accent text-paper" : "bg-paper/90 text-accent hover:bg-paper"
      } ${busy ? "opacity-70" : ""}`}
      data-testid="button-brief-here"
      data-glow={searched ? "1" : undefined}
    >
      <BriefIcon size={20} className={busy ? "animate-pulse" : ""} />
      <span
        className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full bg-ink/90 px-2.5 py-1 text-[11px] text-paper opacity-0 transition-opacity group-hover:opacity-100 sm:block ${
          bubbleLeft ? "right-full mr-2" : "left-full ml-2"
        }`}
      >
        {searched ? `Brief ${searched.name}` : "Field brief here"}
      </span>
    </button>
  );
}
