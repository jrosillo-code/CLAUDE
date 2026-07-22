"use client";

import { useMemo } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { acceptedFriendIds, canView } from "@/lib/data";
import { googleMapsDirectionsUrl } from "@/lib/directions";
import type { Pin, User } from "@/lib/types";

// "Top spots in this area": ranks the most-liked pins inside the current
// viewport — open it on a trip to see what's worth visiting around you.
// Includes public pins from everyone (not just friends/followed creators):
// discovery is the point when you're somewhere new.
export default function TopSpotsPanel({ onClose }: { onClose: () => void }) {
  const pins = useStore((s) => s.pins);
  const users = useStore((s) => s.users);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const likeCounts = useStore((s) => s.likeCounts);
  const viewBounds = useStore((s) => s.viewBounds);
  const selectPin = useStore((s) => s.selectPin);
  const requestFlyTo = useStore((s) => s.requestFlyTo);

  const worldwide = !viewBounds || viewBounds.zoom < 3.5;

  const ranked = useMemo(() => {
    const friendIds = acceptedFriendIds(friendships, viewerId);
    const usersById = new Map(users.map((u) => [u.id, u]));
    const inBounds = (p: Pin): boolean => {
      if (!viewBounds) return true;
      const { w, s, e, n } = viewBounds;
      if (p.lat < s || p.lat > n) return false;
      // Handle viewports that cross the antimeridian.
      return w <= e ? p.lng >= w && p.lng <= e : p.lng >= w || p.lng <= e;
    };
    return pins
      .filter(
        (p) =>
          inBounds(p) &&
          // Public pins from anyone, plus anything the viewer can already see.
          (p.visibility === "public" || canView(p, viewerId, friendIds, false))
      )
      .map((p) => ({
        pin: p,
        owner: usersById.get(p.userId),
        likes: likeCounts[p.id] ?? 0,
      }))
      .filter((r): r is { pin: Pin; owner: User; likes: number } => Boolean(r.owner))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 12);
  }, [pins, users, friendships, viewerId, likeCounts, viewBounds]);

  function open(pin: Pin) {
    selectPin(pin.id);
    requestFlyTo(pin.lng, pin.lat, 8);
    onClose();
  }

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">
            {worldwide ? "Top spots worldwide" : "Top spots in this area"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          The most-liked places {worldwide ? "on the map" : "where you're looking"} — move the
          map to rescan. Includes public pins from all travelers.
        </p>
      </div>

      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {ranked.length === 0 && (
          <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
            <div className="text-2xl">🧭</div>
            <p className="mt-2 font-display text-lg">No pins around here yet</p>
            <p className="mt-1 text-sm text-ink-3">Zoom out a little, or be the first to drop one.</p>
          </div>
        )}
        {ranked.map((r, i) => (
          <div
            key={r.pin.id}
            className="flex items-center gap-3 rounded-2xl border border-line bg-paper-2/60 p-2.5"
          >
            <span className="w-6 shrink-0 text-center font-display text-xl text-ink-3">
              {i + 1}
            </span>
            <button
              onClick={() => open(r.pin)}
              className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-line"
            >
              {r.pin.photos[0] && (
                <img src={r.pin.photos[0].url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
            <button onClick={() => open(r.pin)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-medium">{r.pin.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                <img
                  src={r.owner.avatarUrl}
                  alt=""
                  className="h-4 w-4 rounded-full object-cover"
                />
                <span className="truncate">
                  {r.pin.placeName}
                  {r.pin.countryCode ? ` · ${r.pin.countryCode}` : ""}
                </span>
              </div>
            </button>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="flex items-center gap-1 text-xs font-medium text-ink-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-accent">
                  <path d="M12 21s-7.5-4.7-10-9.3C.5 8.6 2.5 4.5 6.4 4.5c2.2 0 3.9 1.2 5.6 3.3 1.7-2.1 3.4-3.3 5.6-3.3 3.9 0 5.9 4.1 4.4 7.2C19.5 16.3 12 21 12 21z" />
                </svg>
                {r.likes.toLocaleString()}
              </span>
              <a
                href={googleMapsDirectionsUrl(r.pin.lat, r.pin.lng)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper"
              >
                Directions ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
