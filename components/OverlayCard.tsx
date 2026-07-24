"use client";

import { useStore } from "@/lib/store";
import { OVERLAYS } from "@/lib/overlays";
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from "@/lib/directions";

// Small floating card for a tapped overlay feature (airport / station /
// stadium) — icon, name, one-line detail, and hand-off directions. Mirrors the
// landmark card exactly.
export default function OverlayCard() {
  const sel = useStore((s) => s.selectedOverlay);
  const selectOverlay = useStore((s) => s.selectOverlay);
  const tripDraft = useStore((s) => s.tripDraft);
  const addTripStop = useStore((s) => s.addTripStop);

  if (!sel) return null;
  const def = OVERLAYS.find((o) => o.id === sel.kind);
  const color = def?.color ?? "#2f80ed";

  return (
    <div className="fixed bottom-24 left-1/2 z-30 w-[min(92vw,400px)] -translate-x-1/2 sm:bottom-8">
      <div className="animate-sheet rounded-3xl bg-paper/95 p-4 shadow-float backdrop-blur">
        <div className="flex items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg"
            style={{ background: `${color}1f`, boxShadow: `inset 0 0 0 1.5px ${color}` }}
          >
            {def?.glyph}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate font-display text-lg leading-tight">{sel.title}</h3>
              <button
                onClick={() => selectOverlay(null)}
                aria-label="Close"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="text-xs font-medium" style={{ color }}>
              {sel.subtitle}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tripDraft && (
                <button
                  onClick={() => {
                    addTripStop({ lng: sel.lng, lat: sel.lat, placeName: sel.title });
                    selectOverlay(null);
                  }}
                  className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-paper"
                >
                  + Add to trip
                </button>
              )}
              <a
                href={googleMapsDirectionsUrl(sel.lat, sel.lng, sel.title)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-paper-2 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line"
              >
                Google Maps ↗
              </a>
              <a
                href={appleMapsDirectionsUrl(sel.lat, sel.lng, sel.title)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-paper-2 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line"
              >
                Apple Maps ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
