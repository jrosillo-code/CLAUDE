"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import DebriefQuotes from "./DebriefQuotes";
import { useStore } from "@/lib/store";
import { visibleTrips } from "@/lib/data";
import { appleMapsRouteUrl, googleMapsRouteUrl } from "@/lib/directions";
import { contributionCount } from "@/lib/analytics";

// Trips: planned routes — ordered stops stitched by a thread on the map.
// Yours plus friends' shared ones. Never public: friends-only or private.
export default function TripsPanel({
  onClose,
  onOpenGuide,
  onViewRoute,
  onOpenDebrief,
}: {
  onClose: () => void;
  onOpenGuide: (tripId: string) => void;
  /** Phones: View route shows the threaded map itself (no guide popup);
   *  the AI guide waits behind a small floating button instead. */
  onViewRoute?: (tripId: string) => void;
  /** Open the 60-second post-trip debrief for one of the viewer's trips. */
  onOpenDebrief: (tripId: string) => void;
}) {
  const trips = useStore((s) => s.trips);
  const users = useStore((s) => s.users);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const shownTripIds = useStore((s) => s.shownTripIds);
  const toggleTripShown = useStore((s) => s.toggleTripShown);
  const deleteTrip = useStore((s) => s.deleteTrip);
  const renameTrip = useStore((s) => s.renameTrip);
  const startTripDraft = useStore((s) => s.startTripDraft);
  const cloneTripToDraft = useStore((s) => s.cloneTripToDraft);
  const completeTrip = useStore((s) => s.completeTrip);
  const reflections = useStore((s) => s.reflections);
  const requestFitBounds = useStore((s) => s.requestFitBounds);

  const list = visibleTrips(trips, friendships, viewerId);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function commitRename(id: string) {
    if (draftTitle.trim()) renameTrip(id, draftTitle);
    setEditingId(null);
  }

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
    // Phones want the MAP first — the guide is a follow-up tap; desktop keeps
    // the side panel opening alongside the framed route.
    if (window.innerWidth < 640 && onViewRoute) onViewRoute(id);
    else onOpenGuide(id);
    onClose();
  }

  return (
    <Sheet onClose={onClose} side="left">
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
                  {editingId === t.id ? (
                    <input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onBlur={() => commitRename(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(t.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      placeholder="Trip name"
                      className="w-full rounded-lg bg-paper px-2 py-1 text-sm font-medium outline-none ring-1 ring-line focus:ring-ink/30"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{t.title}</span>
                      {mine && (
                        <button
                          onClick={() => {
                            setDraftTitle(t.title);
                            setEditingId(t.id);
                          }}
                          title="Rename trip"
                          aria-label="Rename trip"
                          className="shrink-0 text-ink-3 transition-colors hover:text-ink"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                            <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                            <path d="m13.5 8.5 3 3" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
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
              {/* A friend's finished trip speaks for itself: their debrief,
                  in their words, right on the card. */}
              {!mine && t.completedOn && (
                <DebriefQuotes tripId={t.id} onNavigateToPin={onClose} />
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => viewTrip(t.id)}
                  className="flex-1 rounded-full bg-ink py-2 text-xs font-semibold text-paper"
                >
                  View route
                </button>
                {/* Fork a friend's route: their stops become your editable
                    draft — the honest version of "turn a Reel into a trip". */}
                {!mine && (
                  <button
                    onClick={() => {
                      if (!cloneTripToDraft(t.id)) return;
                      const lngs = t.stops.map((s) => s.lng);
                      const lats = t.stops.map((s) => s.lat);
                      requestFitBounds({
                        w: Math.min(...lngs) - 0.5,
                        s: Math.min(...lats) - 0.5,
                        e: Math.max(...lngs) + 0.5,
                        n: Math.max(...lats) + 0.5,
                      });
                      onClose();
                    }}
                    title={`Copy ${owner?.displayName ?? "this"} route as your own draft`}
                    className="rounded-full bg-paper px-4 py-2 text-xs font-semibold text-ink-2 ring-1 ring-line transition-colors hover:bg-paper-2"
                  >
                    Clone trip
                  </button>
                )}
                {mine && (
                  <button
                    onClick={() => deleteTrip(t.id)}
                    className="rounded-full bg-paper px-4 py-2 text-xs font-semibold text-accent ring-1 ring-line"
                  >
                    Delete
                  </button>
                )}
              </div>
              {/* Post-trip debrief: marking a trip done is the cue for the
                  60-second interview; the answers power Ask & Don't-miss. */}
              {mine && (() => {
                const refl = reflections.find(
                  (r) => r.tripId === t.id && r.userId === viewerId
                );
                if (!t.completedOn) {
                  return (
                    <button
                      onClick={() => {
                        completeTrip(t.id);
                        onOpenDebrief(t.id);
                        onClose();
                      }}
                      className="mt-2 w-full rounded-full bg-paper py-2 text-xs font-semibold text-ink-2 ring-1 ring-line transition-colors hover:bg-paper-2"
                    >
                      ✓ Mark trip completed
                    </button>
                  );
                }
                if (refl?.status === "complete") {
                  // Reward signal, no engagement pressure: how often these
                  // words did work for a friend (this device's log only).
                  const cited = contributionCount(viewerId, refl.id);
                  return (
                    <button
                      onClick={() => {
                        onOpenDebrief(t.id);
                        onClose();
                      }}
                      className="mt-2 w-full rounded-full bg-paper py-2 text-xs font-semibold text-ink-3 ring-1 ring-line transition-colors hover:bg-paper-2"
                    >
                      Debrief saved ✓ — view or edit
                      {cited > 0 && (
                        <span
                          className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent"
                          title="Times your answers appeared as evidence for a friend, on this device"
                        >
                          helped {cited}×
                        </span>
                      )}
                    </button>
                  );
                }
                return (
                  <button
                    onClick={() => {
                      onOpenDebrief(t.id);
                      onClose();
                    }}
                    className="mt-2 w-full rounded-full bg-accent py-2 text-xs font-semibold text-paper"
                  >
                    {refl ? "Resume your 60-second debrief" : "60-second debrief — help your friends"}
                  </button>
                );
              })()}
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
