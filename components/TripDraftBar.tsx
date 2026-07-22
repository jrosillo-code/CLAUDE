"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { searchPlaces, type GeoResult } from "@/lib/geocode";

// Floating toolbar while planning a trip: name it, choose who can see it,
// add stops by tapping the map OR by searching a place by name, undo, save.
export default function TripDraftBar() {
  const draft = useStore((s) => s.tripDraft)!;
  const setTitle = useStore((s) => s.setTripDraftTitle);
  const setVisibility = useStore((s) => s.setTripDraftVisibility);
  const addTripStop = useStore((s) => s.addTripStop);
  const undoStop = useStore((s) => s.undoTripStop);
  const cancel = useStore((s) => s.cancelTripDraft);
  const save = useStore((s) => s.saveTripDraft);
  const requestFlyTo = useStore((s) => s.requestFlyTo);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setResults(await searchPlaces(q, ac.signal));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function addFromSearch(r: GeoResult) {
    addTripStop({ lng: r.lng, lat: r.lat, placeName: r.placeName });
    requestFlyTo(r.lng, r.lat, 6);
    setQ("");
    setResults([]);
  }

  const canSave = draft.stops.length >= 2;

  return (
    <div className="fixed bottom-6 left-1/2 z-30 w-[min(94vw,480px)] -translate-x-1/2">
      <div className="animate-sheet rounded-3xl bg-paper/95 p-4 shadow-float backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <input
            value={draft.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name this trip…"
            className="min-w-0 flex-1 bg-transparent font-display text-xl outline-none placeholder:text-ink-3"
          />
          <div className="flex shrink-0 gap-1 rounded-full bg-paper-2 p-1">
            <button
              onClick={() => setVisibility("private")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                draft.visibility === "private" ? "bg-ink text-paper" : "text-ink-3"
              }`}
            >
              Only me
            </button>
            <button
              onClick={() => setVisibility("friends")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                draft.visibility === "friends" ? "bg-ink text-paper" : "text-ink-3"
              }`}
            >
              Friends
            </button>
          </div>
        </div>

        {/* Add a stop by name — results open upward, above the bar. */}
        <div className="relative mt-3">
          {results.length > 0 && (
            <ul className="absolute bottom-full left-0 right-0 z-10 mb-2 max-h-56 overflow-y-auto rounded-2xl bg-paper shadow-float">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => addFromSearch(r)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-paper-2"
                  >
                    <span className="text-ink-3">📍</span>
                    <span className="truncate">{r.placeName}</span>
                    {r.countryCode && (
                      <span className="ml-auto text-xs text-ink-3">{r.countryCode}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 rounded-full bg-paper-2 px-4 py-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-3">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Add a stop by name — or tap the map"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
            />
          </div>
        </div>

        <p className="mt-2 text-xs text-ink-3">
          {draft.stops.length === 0
            ? "No stops yet."
            : draft.stops.length === 1
              ? `1 stop: ${draft.stops[0].placeName} — add at least one more to stitch the thread.`
              : `${draft.stops.length} stops · ${draft.stops.map((s) => s.placeName).join(" → ")}`}
        </p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={undoStop}
            disabled={draft.stops.length === 0}
            className="rounded-full bg-paper-2 px-4 py-2 text-xs font-semibold text-ink-2 disabled:opacity-40"
          >
            Undo stop
          </button>
          <button
            onClick={cancel}
            className="rounded-full bg-paper-2 px-4 py-2 text-xs font-semibold text-ink-2"
          >
            Cancel
          </button>
          <button
            onClick={() => save()}
            disabled={!canSave}
            className="ml-auto rounded-full bg-accent px-5 py-2 text-xs font-semibold text-paper disabled:opacity-40"
          >
            Save trip
          </button>
        </div>
      </div>
    </div>
  );
}
