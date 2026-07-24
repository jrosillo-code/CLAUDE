"use client";

import { useStore } from "@/lib/store";
import { coverUrl, topPlacesFor } from "@/lib/data";

// Rated Top 5 — the profile's centerpiece. Ranked automatically from the
// owner's 1–10 pin ratings; ties go to the older trip. Change a rating on any
// pin and the list reshuffles itself.
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

  const ranked = topPlacesFor(topPlaces, pins, userId);

  if (!ranked.length) {
    return (
      <div className="rounded-2xl bg-paper-2 p-6 text-center text-sm text-ink-3">
        No Top 5 yet — pin a place you love and rate it.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {ranked.map((r) => (
        <li key={r.pin.id} className="group flex items-stretch gap-3 rounded-2xl bg-paper-2 p-2">
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

          {/* The score that earned the slot */}
          {r.pin.rating != null && (
            <div className="flex shrink-0 items-center pr-2">
              <span className="tnum rounded-full bg-paper px-2.5 py-1 text-xs font-bold text-accent ring-1 ring-line">
                {r.pin.rating}/10
              </span>
            </div>
          )}
        </li>
      ))}

      {editable && (
        <li className="px-1 text-center text-xs text-ink-3">
          Ranked by your ratings — rate any pin to reshuffle. Ties go to the older trip.
        </li>
      )}
    </ol>
  );
}
