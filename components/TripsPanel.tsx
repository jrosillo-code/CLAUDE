"use client";

import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { visibleTrips } from "@/lib/data";
import { appleMapsRouteUrl, googleMapsRouteUrl } from "@/lib/directions";

// Trips: planned routes — ordered stops stitched by a thread on the map.
// Yours plus friends' shared ones. Never public: friends-only or private.
export default function TripsPanel({
  onClose,
  onOpenGuide,
}: {
  onClose: () => void;
  onOpenGuide: (tripId: string) => void;
}) {
  const trips = useStore((s) => s.trips);
  const users = useStore((s) => s.users);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const shownTripIds = useStore((s) => s.shownTripIds);
  const toggleTripShown = useStore((s) => s.toggleTripShown);
  const deleteTrip = useStore((s) => s.deleteTrip);
  const startTripDraft = useStore((s) => s.startTripDraft);
  const requestFitBounds = useStore((s) => s.requestFitBounds);

  const list = visibleTrips(trips, friendships, viewerId);
  const usersById = new Map(users.map((u) => [u.id, u]));

  function viewTrip(id: string) {
    const t = trips.find((x) => x.id === id);
    if (!t || t.stops.length === 0) return;
    if (!shownTripIds.has(id)) toggleTripShown(id);
    const lngs = t.stops.map((s) => s.lng);
    const lats = t.stops.map((s) => s.lat);
    requestFitBounds({
      w: Math.min(...lngs) - 0.5,
      s: Math.min(...lats) - 0.5,
      e: Math.max(...lngs) + 0.5,
      n: Math.max(...lats) + 0.5,
    });
    onOpenGuide(id);
    onClose();
  }

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Trips</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          Plan a route stop by stop — a thread stitches it across the map. Trips stay
          private or friends-only, never public.
        </p>
        <button
          onClick={() => {
            startTripDraft();
            onClose();
          }}
          className="mt-3 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-paper"
        >
          + Plan a trip
        </button>
      </div>

      <div className="scroll-thin flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {list.length === 0 && (
          <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
            <div className="text-2xl">🧵</div>
            <p className="mt-2 font-display text-lg">No trips yet</p>
            <p className="mt-1 text-sm text-ink-3">Plan your first route — tap the map stop by stop.</p>
          </div>
        )}
        {list.map((t) => {
          const owner = usersById.get(t.userId);
          const mine = t.userId === viewerId;
          const shown = shownTripIds.has(t.id);
          return (
            <div key={t.id} className="rounded-2xl border border-line bg-paper-2/60 p-3.5">
              <div className="flex items-center gap-2.5">
                {owner && (
                  <img src={owner.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: owner.color }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-ink-3">
                    {mine ? "You" : owner?.displayName} · {t.stops.length} stops ·{" "}
                    {t.visibility === "private" ? "Only me" : "Friends"}
                  </div>
                </div>
                {/* Show/hide on map */}
                <button
                  onClick={() => toggleTripShown(t.id)}
                  title={shown ? "Hide from map" : "Show on map"}
                  className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
                    shown ? "bg-ink text-paper" : "bg-paper text-ink-3 ring-1 ring-line"
                  }`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="2.6" fill="currentColor" />
                  </svg>
                </button>
              </div>
              {/* Route preview */}
              <div className="no-scrollbar mt-2.5 flex items-center gap-1 overflow-x-auto text-xs text-ink-2">
                {t.stops.map((s, i) => (
                  <span key={s.id} className="flex shrink-0 items-center gap-1">
                    {i > 0 && <span className="text-ink-3">·····</span>}
                    <span className="rounded-full bg-paper px-2 py-0.5">{s.placeName}</span>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => viewTrip(t.id)}
                  className="flex-1 rounded-full bg-ink py-2 text-xs font-semibold text-paper"
                >
                  View route
                </button>
                {mine && (
                  <button
                    onClick={() => deleteTrip(t.id)}
                    className="rounded-full bg-paper px-4 py-2 text-xs font-semibold text-accent ring-1 ring-line"
                  >
                    Delete
                  </button>
                )}
              </div>
              {/* Turn-by-turn hand-off: current location through every stop in order */}
              <div className="mt-2 flex gap-2">
                <a
                  href={googleMapsRouteUrl(t.stops)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-full bg-paper py-2 text-center text-xs font-semibold text-ink-2 ring-1 ring-line transition-colors hover:bg-paper-2"
                >
                  Google Maps ↗
                </a>
                <a
                  href={appleMapsRouteUrl(t.stops)}
                  target="_blank"
                  rel="noreferrer"
                  title="Opens the full route in the Apple Maps app. On desktop browsers Apple only previews the first stop — use the route guide's per-stop links there."
                  className="flex-1 rounded-full bg-paper py-2 text-center text-xs font-semibold text-ink-2 ring-1 ring-line transition-colors hover:bg-paper-2"
                >
                  Apple Maps ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
