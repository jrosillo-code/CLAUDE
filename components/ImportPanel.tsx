"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";

// Import your travel history: Google Takeout "Semantic Location History" JSON
// files become reviewed draft pins — a full map on day one instead of an empty
// globe. Everything parses client-side; nothing is uploaded anywhere.

interface Candidate {
  placeName: string;
  lat: number;
  lng: number;
  when?: string;
  visits: number;
  checked: boolean;
}

export default function ImportPanel({ onClose }: { onClose: () => void }) {
  const addPin = useStore((s) => s.addPin);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [parsedFiles, setParsedFiles] = useState(0);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const byPlace = new Map<string, Candidate>(candidates.map((c) => [c.placeName.toLowerCase(), c]));
    let parsed = 0;
    for (const file of Array.from(files)) {
      try {
        const json = JSON.parse(await file.text());
        // Google Takeout Semantic Location History: { timelineObjects: [{ placeVisit: {...} }] }
        const objects: unknown[] = json?.timelineObjects ?? [];
        for (const o of objects as { placeVisit?: { location?: { name?: string; latitudeE7?: number; longitudeE7?: number }; duration?: { startTimestamp?: string } } }[]) {
          const v = o.placeVisit;
          const loc = v?.location;
          if (!loc?.latitudeE7 || !loc.longitudeE7) continue;
          const name = loc.name?.trim();
          if (!name) continue; // skip unnamed raw coordinates
          const key = name.toLowerCase();
          const existing = byPlace.get(key);
          if (existing) {
            existing.visits += 1;
          } else {
            byPlace.set(key, {
              placeName: name,
              lat: loc.latitudeE7 / 1e7,
              lng: loc.longitudeE7 / 1e7,
              when: v?.duration?.startTimestamp,
              visits: 1,
              checked: true,
            });
          }
        }
        parsed++;
      } catch {
        setError(`Couldn't parse ${file.name} — expected a Takeout Semantic Location History JSON.`);
      }
    }
    setParsedFiles((n) => n + parsed);
    setCandidates([...byPlace.values()].sort((a, b) => b.visits - a.visits));
  }

  function importChecked() {
    const chosen = candidates.filter((c) => c.checked);
    for (const c of chosen) {
      addPin({
        lng: c.lng,
        lat: c.lat,
        placeName: c.placeName,
        countryCode: "",
        title: c.placeName,
        note: "",
        visibility: "friends",
        media: [],
        dates: c.when ? [c.when.slice(0, 10), c.when.slice(0, 10)] : undefined,
        // Backdate to the actual visit so an import doesn't flood friends'
        // feeds as 30 "just now" pins, and the year tags read true.
        createdAt: c.when,
      });
    }
    setImportedCount(chosen.length);
    setCandidates([]);
  }

  const checkedCount = candidates.filter((c) => c.checked).length;

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Import your travels</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          Turn your Google location history into pins — a full map on day one.
        </p>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">
        {importedCount !== null ? (
          <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
            <div className="text-2xl">🎉</div>
            <p className="mt-2 font-display text-lg">
              {importedCount} {importedCount === 1 ? "pin" : "pins"} added to your map
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper"
            >
              See them on the map
            </button>
          </div>
        ) : (
          <>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
              <li>
                Go to{" "}
                <a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
                  takeout.google.com
                </a>{" "}
                and export <span className="font-medium">Location History (Timeline)</span>.
              </li>
              <li>
                Unzip it and find <span className="font-mono text-xs">Semantic Location History/</span> —
                one JSON per month.
              </li>
              <li>Drop any of those files below. Parsing happens on your device only.</li>
            </ol>

            <label className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-3 transition-colors hover:border-ink-3 hover:text-ink-2">
              <span className="font-medium">Choose Takeout JSON files</span>
              {parsedFiles > 0 && <span className="mt-1 block text-xs">{parsedFiles} file{parsedFiles === 1 ? "" : "s"} parsed</span>}
              <input
                type="file"
                accept=".json,application/json"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {error && <p className="mt-2 text-xs text-accent">{error}</p>}

            {candidates.length > 0 && (
              <>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    {candidates.length} places found · {checkedCount} selected
                  </span>
                  <button
                    onClick={() => setCandidates((cs) => cs.map((c) => ({ ...c, checked: checkedCount === 0 })))}
                    className="text-xs font-medium text-ink-3 underline-offset-2 hover:underline"
                  >
                    {checkedCount === 0 ? "Select all" : "Clear all"}
                  </button>
                </div>
                <ul className="mt-2 space-y-1">
                  {candidates.slice(0, 200).map((c, i) => (
                    <li key={i}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-paper-2">
                        <input
                          type="checkbox"
                          checked={c.checked}
                          onChange={() =>
                            setCandidates((cs) => cs.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))
                          }
                          className="h-4 w-4 accent-[var(--color-accent)]"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{c.placeName}</span>
                        <span className="shrink-0 text-xs text-ink-3">
                          {c.visits > 1 ? `${c.visits} visits` : ""}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={importChecked}
                  disabled={checkedCount === 0}
                  className="mt-4 w-full rounded-full bg-accent py-3 text-sm font-semibold text-paper disabled:opacity-40"
                >
                  Add {checkedCount} {checkedCount === 1 ? "pin" : "pins"} to my map
                </button>
              </>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
