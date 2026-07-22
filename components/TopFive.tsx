"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { topPlacesFor } from "@/lib/data";

// Rated Top 5 — the profile's centerpiece (plan §1.4, Letterboxd-style).
// Drag-to-rank when it's your own profile.
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

  function onDrop(target: number) {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const order = ranked.map((r) => r.pin.id);
    const [moved] = order.splice(dragIndex, 1);
    order.splice(target, 0, moved);
    reorderTop(userId, order);
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <ol className="space-y-3">
      {ranked.map((r, i) => (
        <li
          key={r.pin.id}
          draggable={editable}
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => {
            if (!editable) return;
            e.preventDefault();
            setOverIndex(i);
          }}
          onDrop={() => onDrop(i)}
          onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
          className={`group flex items-stretch gap-3 rounded-2xl bg-paper-2 p-2 transition-all ${
            editable ? "cursor-grab active:cursor-grabbing" : ""
          } ${overIndex === i && dragIndex !== null ? "ring-2 ring-accent" : ""} ${
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
            {r.pin.photos[0] && (
              <img
                src={r.pin.photos[0].url}
                alt=""
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

          {editable && (
            <div className="flex w-6 shrink-0 items-center justify-center text-ink-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="6" r="1.4" fill="currentColor" /><circle cx="15" cy="6" r="1.4" fill="currentColor" />
                <circle cx="9" cy="12" r="1.4" fill="currentColor" /><circle cx="15" cy="12" r="1.4" fill="currentColor" />
                <circle cx="9" cy="18" r="1.4" fill="currentColor" /><circle cx="15" cy="18" r="1.4" fill="currentColor" />
              </svg>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
