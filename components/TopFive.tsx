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

  const ranked = topPlacesFor(topPlaces, pins, userId);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

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

          {/* Reorder controls: arrows always work — drag is the shortcut. */}
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
    </ol>
  );
}
