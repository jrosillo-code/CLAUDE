"use client";

import { useStore } from "@/lib/store";
import { LIST_META, LIST_HONESTY, listPlaceById, monthsLabel } from "@/lib/lists";
import { googleMapsDirectionsUrl } from "@/lib/directions";
import { BriefIcon } from "./BriefIcon";

// A tapped world-list place: why it is on the list, when to go, and the
// honest label that it comes from public rankings — never from a friend.
export default function ListPlaceCard() {
  const id = useStore((s) => s.selectedListPlaceId);
  const selectListPlace = useStore((s) => s.selectListPlace);
  const saved = useStore((s) => s.savedListPlaceIds);
  const toggleSaved = useStore((s) => s.toggleSavedListPlace);
  const openBrief = useStore((s) => s.openBrief);
  const tripDraft = useStore((s) => s.tripDraft);
  const addTripStop = useStore((s) => s.addTripStop);

  const p = listPlaceById(id);
  if (!p) return null;
  const meta = LIST_META[p.list];
  const isSaved = saved.has(p.id);

  return (
    <div className="fixed bottom-24 left-1/2 z-30 w-[min(92vw,400px)] -translate-x-1/2 sm:bottom-8" data-testid="list-place-card">
      <div className="animate-sheet rounded-3xl bg-paper/95 p-4 shadow-float backdrop-blur">
        <div className="flex items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg"
            style={{ background: `${meta.color}1f`, boxShadow: `inset 0 0 0 1.5px ${meta.color}` }}
            aria-hidden
          >
            {meta.glyph}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate font-display text-lg leading-tight">{p.name}</h3>
              <button onClick={() => selectListPlace(null)} aria-label="Close" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="text-xs font-medium" style={{ color: meta.color }}>
              {meta.label} · {p.region} · {p.countryCode}
            </div>
            <p className="mt-1.5 text-sm leading-snug text-ink-2">{p.why}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
              <span className="rounded-full bg-paper-2 px-2 py-0.5 text-ink-2">Best {monthsLabel(p.bestMonths)}</span>
              {p.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-paper-2 px-2 py-0.5">{t.replace(/-/g, " ")}</span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-3">
              {LIST_HONESTY} Source: {p.source}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => toggleSaved(p.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${isSaved ? "bg-ink text-paper" : "bg-accent text-paper"}`}
                data-testid="list-place-save"
                aria-pressed={isSaved}
              >
                {isSaved ? "Saved ✓" : "Save"}
              </button>
              <button
                onClick={() => openBrief({ lat: p.lat, lng: p.lng, placeName: p.name, countryCode: p.countryCode, origin: "search" })}
                className="flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line"
                data-testid="list-place-brief"
              >
                <BriefIcon size={13} className="text-accent" />
                Field brief
              </button>
              {tripDraft && (
                <button
                  onClick={() => { addTripStop({ lng: p.lng, lat: p.lat, placeName: p.name }); selectListPlace(null); }}
                  className="rounded-full bg-paper-2 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line"
                >
                  + Add to trip
                </button>
              )}
              <a
                href={googleMapsDirectionsUrl(p.lat, p.lng, `${p.name}, ${p.countryCode}`)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-paper-2 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line"
              >
                Maps ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
