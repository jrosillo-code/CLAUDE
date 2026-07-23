"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { coverUrl, topPlacesFor } from "@/lib/data";

// Rated Top 5 — the profile's centerpiece (plan §1.4, Letterboxd-style).
// Reorder your own: drag rows, or use the ▲▼ arrows (which also work on
// touch, where HTML5 drag-and-drop doesn't exist).
export default function TopFive({
  userId,
  editable,
  onOpen,
}: {
  userId: string;
  editable: boolean;
  onOpen: (pinId: string, lng: number, lat: number) => void;
}) {
  const pins = useStore((s) => s.pins);
  const topPlaces = useStore((s) => s.topPlaces);
  const reorderTop = useStore((s) => s.reorderTop);
  const setTopPlace = useStore((s) => s.setTopPlace);

  const ranked = topPlacesFor(topPlaces, pins, userId);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Which rank slot the swap picker is open for (1-5), or null.
  const [pickingRank, setPickingRank] = useState<number | null>(null);

  // Your pins that could fill a slot — everything not already in the Top 5.
  const rankedPinIds = new Set(ranked.map((r) => r.pin.id));
  const candidates = pins.filter((p) => p.userId === userId && !rankedPinIds.has(p.id));

  if (!ranked.length) {
    return (
      <div className="rounded-2xl bg-paper-2 p-6 text-center text-sm text-ink-3">
        No Top 5 yet — pin a place you love, then add it here.
      </div>
    );
  }

  function commitMove(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= ranked.length || to >= ranked.length) return;
    const order = ranked.map((r) => r.pin.id);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    reorderTop(userId, order);
  }

  return (
    <ol className="space-y-3">
      {ranked.map((r, i) => (
        <li
          key={r.pin.id}
          draggable={editable}
          onDragStart={(e) => {
            // Firefox cancels drags that carry no data; set it always.
            e.dataTransfer.setData("text/plain", String(i));
            e.dataTransfer.effectAllowed = "move";
            setDragIndex(i);
          }}
          onDragOver={(e) => {
            if (!editable) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (overIndex !== i) setOverIndex(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            // State can lag a fast drag — the dataTransfer index is authoritative.
            const from = Number(e.dataTransfer.getData("text/plain"));
            commitMove(Number.isFinite(from) ? from : (dragIndex ?? -1), i);
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
          className={`group flex items-stretch gap-3 rounded-2xl bg-paper-2 p-2 transition-all ${
            editable ? "cursor-grab active:cursor-grabbing" : ""
          } ${overIndex === i && dragIndex !== null && dragIndex !== i ? "ring-2 ring-accent" : ""} ${
            dragIndex === i ? "opacity-40" : ""
          }`}
        >
          {/* Rank */}
          <div className="flex w-9 shrink-0 items-center justify-center">
            <span className="font-display text-3xl text-ink-3">{r.rank}</span>
          </div>

          {/* Photo */}
          <button
            onClick={() => onOpen(r.pin.id, r.pin.lng, r.pin.lat)}
            className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-line"
          >
            {coverUrl(r.pin) && (
              <img
                src={coverUrl(r.pin)!}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
          </button>

          {/* Text */}
          <button
            onClick={() => onOpen(r.pin.id, r.pin.lng, r.pin.lat)}
            className="flex min-w-0 flex-1 flex-col justify-center py-0.5 pr-2 text-left"
          >
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium">{r.pin.placeName}</span>
              {r.pin.countryCode && <span className="text-xs text-ink-3">{r.pin.countryCode}</span>}
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{r.blurb}</p>
          </button>

          {/* Reorder + swap controls: arrows always work — drag is the shortcut. */}
          {editable && (
            <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 pr-1">
              <button
                onClick={() => commitMove(i, i - 1)}
                disabled={i === 0}
                aria-label={`Move ${r.pin.placeName} up`}
                className="grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-paper hover:text-ink disabled:opacity-25"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m6 14 6-6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button
                onClick={() => setPickingRank(pickingRank === r.rank ? null : r.rank)}
                aria-label={`Swap ${r.pin.placeName} for another pin`}
                title="Swap this slot for another of your pins"
                className={`grid h-6 w-6 place-items-center rounded-full hover:bg-paper ${
                  pickingRank === r.rank ? "bg-accent text-paper" : "text-ink-3 hover:text-ink"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 8h11m0 0-3.5-3.5M18 8l-3.5 3.5M17 16H6m0 0 3.5-3.5M6 16l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button
                onClick={() => commitMove(i, i + 1)}
                disabled={i === ranked.length - 1}
                aria-label={`Move ${r.pin.placeName} down`}
                className="grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-paper hover:text-ink disabled:opacity-25"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m6 10 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          )}
        </li>
      ))}

      {/* Fill an empty slot */}
      {editable && ranked.length < 5 && (
        <li>
          <button
            onClick={() => setPickingRank(pickingRank === ranked.length + 1 ? null : ranked.length + 1)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-4 text-sm font-medium text-ink-3 hover:border-ink-3 hover:text-ink-2"
          >
            + Add your #{ranked.length + 1}
          </button>
        </li>
      )}

      {/* Swap picker: choose any of your other pins for the open slot */}
      {editable && pickingRank !== null && (
        <li className="rounded-2xl border border-line bg-paper-2/60 p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Pick a pin for #{pickingRank}
            </span>
            <button onClick={() => setPickingRank(null)} className="text-xs text-ink-3 underline-offset-2 hover:underline">
              Cancel
            </button>
          </div>
          {candidates.length === 0 ? (
            <p className="px-1 pb-1 text-sm text-ink-3">
              All your pins are already in the Top 5 — drop a new pin first.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {candidates.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      setTopPlace(pickingRank, p.id);
                      setPickingRank(null);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-paper"
                  >
                    {coverUrl(p) ? (
                      <img src={coverUrl(p)!} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-paper text-sm">📍</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      <span className="block truncate text-xs text-ink-3">{p.placeName}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      )}
    </ol>
  );
}
