"use client";

import { useStore } from "@/lib/store";
import { LANDMARKS, LANDMARK_CATEGORY_META } from "@/lib/landmarks";
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from "@/lib/directions";

// Small floating card for a tapped world landmark — name, category, one-line
// hook, and hand-off directions. Deliberately lighter than the pin modal.
export default function LandmarkCard() {
  const id = useStore((s) => s.selectedLandmarkId);
  const selectLandmark = useStore((s) => s.selectLandmark);
  const tripDraft = useStore((s) => s.tripDraft);
  const addTripStop = useStore((s) => s.addTripStop);

  const lm = LANDMARKS.find((l) => l.id === id);
  if (!lm) return null;
  const meta = LANDMARK_CATEGORY_META[lm.category];

  return (
    <div className="fixed bottom-24 left-1/2 z-30 w-[min(92vw,400px)] -translate-x-1/2 sm:bottom-8">
      <div className="animate-sheet rounded-3xl bg-paper/95 p-4 shadow-float backdrop-blur">
        <div className="flex items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg"
            style={{ background: `${meta.color}1f`, boxShadow: `inset 0 0 0 1.5px ${meta.color}` }}
          >
            {meta.glyph}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate font-display text-lg leading-tight">{lm.name}</h3>
              <button
                onClick={() => selectLandmark(null)}
                aria-label="Close"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="text-xs font-medium" style={{ color: meta.color }}>
              {meta.label} · {lm.countryCode}
            </div>
            <p className="mt-1.5 text-sm leading-snug text-ink-2">{lm.blurb}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tripDraft && (
                <button
                  onClick={() => {
                    addTripStop({ lng: lm.lng, lat: lm.lat, placeName: lm.name });
                    selectLandmark(null);
                  }}
                  className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-paper"
                >
                  + Add to trip
                </button>
              )}
              <a
                href={googleMapsDirectionsUrl(lm.lat, lm.lng, `${lm.name}, ${lm.countryCode}`)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-paper-2 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line"
              >
                Google Maps ↗
              </a>
              <a
                href={appleMapsDirectionsUrl(lm.lat, lm.lng, `${lm.name}, ${lm.countryCode}`)}
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
