"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { photoFix, clusterFixes, parsePlaceLine, type PhotoFix } from "@/lib/exif";
import { reverseGeocode, searchPlaces } from "@/lib/geocode";

// Import your travels three ways, easiest first:
//  · Photos — pick photos from your library; the GPS and date every phone
//    writes into them become visits. Nothing is uploaded: only the first
//    256 KB of each file is read, on the device, for its EXIF block.
//  · Type your places — one per line, with an optional year or month.
//  · Google Takeout — the location-history JSON, for people who have it.
// Every path ends in the same review list: untick anything, then import.

type Mode = "photos" | "type" | "takeout";

interface Candidate {
  placeName: string;
  lat: number;
  lng: number;
  countryCode?: string;
  region?: string;
  when?: string;
  until?: string;
  visits: number;
  checked: boolean;
}

export default function ImportPanel({ onClose }: { onClose: () => void }) {
  const addPin = useStore((s) => s.addPin);
  const [mode, setMode] = useState<Mode>("photos");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [photoNote, setPhotoNote] = useState<string | null>(null);

  function merge(next: Candidate[]) {
    const byKey = new Map<string, Candidate>(candidates.map((c) => [c.placeName.toLowerCase(), c]));
    for (const c of next) {
      const k = c.placeName.toLowerCase();
      const ex = byKey.get(k);
      if (ex) ex.visits += c.visits;
      else byKey.set(k, c);
    }
    setCandidates([...byKey.values()].sort((a, b) => b.visits - a.visits));
  }

  // ── Photos ──
  async function handlePhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setPhotoNote(null);
    setBusy(`Reading ${files.length} ${files.length === 1 ? "photo" : "photos"}…`);
    const fixes: PhotoFix[] = [];
    let skipped = 0;
    for (const f of Array.from(files)) {
      const fix = await photoFix(f);
      if (fix) fixes.push(fix); else skipped++;
    }
    if (!fixes.length) {
      setBusy(null);
      setError(
        "None of those photos carry a location. On iPhone, pick them from the Photos app (not Files) and, if it asks, keep Location on. Screenshots and downloaded images never have one."
      );
      return;
    }
    const clusters = clusterFixes(fixes).slice(0, 60);
    const out: Candidate[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      setBusy(`Naming place ${i + 1} of ${clusters.length}…`);
      let name = `${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}`;
      let countryCode = "", region: string | undefined;
      try {
        const g = await reverseGeocode(c.lng, c.lat);
        if (g?.placeName) { name = g.placeName; countryCode = g.countryCode ?? ""; region = g.region; }
      } catch { /* keep coordinates */ }
      out.push({ placeName: name, lat: c.lat, lng: c.lng, countryCode, region, when: c.from?.slice(0, 10), until: c.to?.slice(0, 10), visits: c.count, checked: true });
      // be gentle with the keyless geocoder
      await new Promise((r) => setTimeout(r, 350));
    }
    setBusy(null);
    setPhotoNote(`${fixes.length} located ${fixes.length === 1 ? "photo" : "photos"} → ${clusters.length} ${clusters.length === 1 ? "visit" : "visits"}${skipped ? ` · ${skipped} without a location skipped` : ""}.`);
    merge(out);
  }

  // ── Typed places ──
  async function handleTyped() {
    const lines = typed.split(/\n+/).map(parsePlaceLine).filter((x): x is { name: string; when?: string } => !!x);
    if (!lines.length) return;
    setError(null);
    const out: Candidate[] = [];
    const misses: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      setBusy(`Finding ${lines[i].name} (${i + 1}/${lines.length})…`);
      try {
        const hits = await searchPlaces(lines[i].name);
        const h = hits.find((r) => r.kind === "place") ?? hits[0];
        if (!h) { misses.push(lines[i].name); continue; }
        out.push({ placeName: h.placeName, lat: h.lat, lng: h.lng, countryCode: h.countryCode, region: h.region, when: lines[i].when, visits: 1, checked: true });
      } catch {
        misses.push(lines[i].name);
      }
    }
    setBusy(null);
    if (misses.length) setError(`Couldn't find: ${misses.join(", ")}. Try adding the country.`);
    if (out.length) { merge(out); setTyped(""); }
  }

  // ── Google Takeout ──
  async function handleTakeout(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const out: Candidate[] = [];
    for (const file of Array.from(files)) {
      try {
        const json = JSON.parse(await file.text());
        const objects: unknown[] = json?.timelineObjects ?? [];
        for (const o of objects as { placeVisit?: { location?: { name?: string; latitudeE7?: number; longitudeE7?: number }; duration?: { startTimestamp?: string } } }[]) {
          const v = o.placeVisit;
          const loc = v?.location;
          if (!loc?.latitudeE7 || !loc.longitudeE7) continue;
          const name = loc.name?.trim();
          if (!name) continue;
          out.push({ placeName: name, lat: loc.latitudeE7 / 1e7, lng: loc.longitudeE7 / 1e7, when: v?.duration?.startTimestamp?.slice(0, 10), visits: 1, checked: true });
        }
      } catch {
        setError(`Couldn't parse ${file.name} — expected a Takeout Semantic Location History JSON.`);
      }
    }
    merge(out);
  }

  function importChecked() {
    const chosen = candidates.filter((c) => c.checked);
    for (const c of chosen) {
      addPin({
        lng: c.lng,
        lat: c.lat,
        placeName: c.placeName,
        countryCode: c.countryCode ?? "",
        region: c.region,
        title: c.placeName,
        note: "",
        visibility: "friends",
        media: [],
        dates: c.when ? [c.when, c.until ?? c.when] : undefined,
        // Backdate to the visit so an import doesn't flood friends' feeds as
        // thirty "just now" pins, and the year tags read true.
        createdAt: c.when ? `${c.when}T12:00:00.000Z` : undefined,
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
        <p className="mt-1 text-sm text-ink-3">A full map on day one. Nothing leaves your device.</p>
        <div className="mt-3 flex gap-1.5">
          <Tab active={mode === "photos"} onClick={() => setMode("photos")}>From photos</Tab>
          <Tab active={mode === "type"} onClick={() => setMode("type")}>Type places</Tab>
          <Tab active={mode === "takeout"} onClick={() => setMode("takeout")}>Google</Tab>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">
        {importedCount !== null ? (
          <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
            <div className="text-2xl">🎉</div>
            <p className="mt-2 font-display text-lg">{importedCount} {importedCount === 1 ? "pin" : "pins"} added to your map</p>
            <button onClick={onClose} className="mt-4 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper">See them on the map</button>
          </div>
        ) : (
          <>
            {mode === "photos" && (
              <>
                <p className="text-sm leading-relaxed text-ink-2">
                  Pick the photos from your trips. Every phone writes where and when a photo was taken into the file; Waypoint reads that on your device, groups the photos into visits, and names each place. The photos themselves are never uploaded.
                </p>
                <label className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-3 transition-colors hover:border-ink-3 hover:text-ink-2">
                  <span className="font-medium text-ink">Choose photos</span>
                  <span className="mt-1 block text-xs">iPhone and Mac: pick from Photos. Any number at once.</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotos(e.target.files)} data-testid="import-photos" />
                </label>
                {photoNote && <p className="mt-2 text-xs text-ink-2">{photoNote}</p>}
              </>
            )}

            {mode === "type" && (
              <>
                <p className="text-sm leading-relaxed text-ink-2">
                  One place per line. Add a year or month if you like — <span className="font-mono text-xs">Lisbon, Portugal — Aug 2024</span>.
                </p>
                <textarea
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  rows={7}
                  placeholder={"Kyoto 2023\nOaxaca, Mexico — Nov 2024\nFaro"}
                  className="mt-3 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none placeholder:text-ink-3 focus:border-ink"
                  data-testid="import-typed"
                />
                <button
                  onClick={handleTyped}
                  disabled={!typed.trim() || !!busy}
                  className="mt-2 w-full rounded-full bg-ink py-2.5 text-sm font-semibold text-paper disabled:opacity-40"
                  data-testid="import-typed-go"
                >
                  Find these places
                </button>
              </>
            )}

            {mode === "takeout" && (
              <>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
                  <li>
                    Go to <a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">takeout.google.com</a> and export <span className="font-medium">Location History (Timeline)</span>.
                  </li>
                  <li>Unzip it and find <span className="font-mono text-xs">Semantic Location History/</span> — one JSON per month.</li>
                  <li>Choose those files below.</li>
                </ol>
                <label className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-3 transition-colors hover:border-ink-3 hover:text-ink-2">
                  <span className="font-medium">Choose Takeout JSON files</span>
                  <input type="file" accept=".json,application/json" multiple className="hidden" onChange={(e) => handleTakeout(e.target.files)} />
                </label>
              </>
            )}

            {busy && <p className="mt-3 text-xs text-ink-2" data-testid="import-busy">{busy}</p>}
            {error && <p className="mt-2 text-xs text-accent">{error}</p>}

            {candidates.length > 0 && (
              <div className="mt-5" data-testid="import-review">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg">{candidates.length} places found</h3>
                  <button onClick={() => setCandidates((cs) => cs.map((c) => ({ ...c, checked: checkedCount !== cs.length })))} className="text-xs font-medium text-accent">
                    {checkedCount === candidates.length ? "Untick all" : "Tick all"}
                  </button>
                </div>
                <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto rounded-2xl border border-line p-1.5">
                  {candidates.map((c, i) => (
                    <li key={`${c.placeName}-${i}`}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-paper-2">
                        <input type="checkbox" checked={c.checked} onChange={() => setCandidates((cs) => cs.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))} className="accent-[var(--color-accent)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{c.placeName}</span>
                          <span className="block text-[11px] text-ink-3">
                            {c.when ? c.when.slice(0, 7) : "date unknown"}{c.visits > 1 ? ` · ${c.visits} photos` : ""}{c.countryCode ? ` · ${c.countryCode}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <button onClick={importChecked} disabled={checkedCount === 0} className="mt-3 w-full rounded-full bg-accent py-3 text-sm font-semibold text-paper disabled:opacity-40" data-testid="import-go">
                  Add {checkedCount} {checkedCount === 1 ? "pin" : "pins"} to my map
                </button>
                <p className="mt-1.5 text-center text-xs text-ink-3">Pins are added as friends-only; edit any of them afterwards.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${active ? "bg-ink text-paper" : "bg-paper-2 text-ink-2"}`}>
      {children}
    </button>
  );
}
