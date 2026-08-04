"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { acceptedFriendIds, canView, coverUrl, distanceKm } from "@/lib/data";
import { dontMissPicks } from "@/lib/regret";
import type { PinWithOwner } from "@/lib/types";

// The trust graph, at the moment of intent: right after you search a place,
// show which people you actually know have been there — with their pin as the
// tip. This is the anti-Google-reviews: recommendations you can trust because
// you know who made them.
const NEAR_KM = 25;

export default function SearchPlaceCard() {
  const place = useStore((s) => s.searchedPlace);
  const setSearchedPlace = useStore((s) => s.setSearchedPlace);
  const viewerId = useStore((s) => s.viewerId);
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const friendships = useStore((s) => s.friendships);
  const follows = useStore((s) => s.follows);
  const selectPin = useStore((s) => s.selectPin);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const tripDraft = useStore((s) => s.tripDraft);
  const addTripStop = useStore((s) => s.addTripStop);

  const topPlaces = useStore((s) => s.topPlaces);

  // The regret minimizer at the moment of intent: friend-endorsed spots in the
  // wider area (day-trip range) you haven't been to yet. Max three, honest.
  const dontMiss = useMemo(() => {
    if (!place) return { picks: [], alreadyCovered: false };
    return dontMissPicks({
      anchor: { lat: place.lat, lng: place.lng },
      viewerId,
      users,
      pins,
      friendships,
      follows,
      topPlaces,
    });
  }, [place, pins, users, friendships, follows, topPlaces, viewerId]);

  const tips = useMemo<PinWithOwner[]>(() => {
    if (!place) return [];
    const friendIds = acceptedFriendIds(friendships, viewerId);
    const trusted = new Set<string>([...friendIds, ...follows]);
    const usersById = new Map(users.map((u) => [u.id, u]));
    const best = new Map<string, PinWithOwner>();
    for (const p of pins) {
      if (p.userId === viewerId || !trusted.has(p.userId)) continue;
      if (!canView(p, viewerId, friendIds, false)) continue;
      if (distanceKm(p.lat, p.lng, place.lat, place.lng) > NEAR_KM) continue;
      const owner = usersById.get(p.userId);
      if (!owner) continue;
      const prev = best.get(p.userId);
      if (!prev || (p.rating ?? 0) > (prev.rating ?? 0)) best.set(p.userId, { ...p, owner });
    }
    return [...best.values()].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }, [place, pins, users, friendships, follows, viewerId]);

  if (!place || (tips.length === 0 && dontMiss.picks.length === 0)) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-30 w-[min(92vw,420px)] -translate-x-1/2 sm:bottom-8">
      <div className="animate-sheet rounded-3xl bg-paper/95 p-4 shadow-float backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              {tips.length > 0
                ? `${tips.length} ${tips.length === 1 ? "traveler you trust has" : "travelers you trust have"} been here`
                : "Your friends know this area"}
            </div>
            <h3 className="mt-0.5 truncate font-display text-lg leading-tight">{place.name}</h3>
          </div>
          <button
            onClick={() => setSearchedPlace(null)}
            aria-label="Close"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="mt-2.5 space-y-2">
          {tips.slice(0, 4).map((pin) => {
            const cover = coverUrl(pin);
            return (
              <button
                key={pin.id}
                onClick={() => {
                  selectPin(pin.id);
                  requestFlyTo(pin.lng, pin.lat, 10, { flat: true });
                }}
                className="flex w-full items-center gap-3 rounded-xl bg-paper-2/60 p-2 text-left transition-colors hover:bg-paper-2"
              >
                <img
                  src={cover || pin.owner.avatarUrl}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <img src={pin.owner.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                    <span className="truncate text-sm font-medium">{pin.owner.displayName}</span>
                    {pin.rating != null && (
                      <span className="ml-auto shrink-0 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold text-paper">
                        {pin.rating}/10
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-2">{pin.note || pin.title}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Don't miss: friend-endorsed spots in day-trip range you haven't
            done. Capped at three, no fake urgency — just the real gap. */}
        {dontMiss.picks.length > 0 && (
          <div className="mt-3 border-t border-line pt-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              Don&apos;t leave without
            </div>
            <div className="mt-1.5 space-y-1.5">
              {dontMiss.picks.map((p) => (
                <button
                  key={p.pin.id}
                  onClick={() => {
                    selectPin(p.pin.id);
                    requestFlyTo(p.pin.lng, p.pin.lat, 10, { flat: true });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-paper-2/60 p-2 text-left transition-colors hover:bg-paper-2"
                >
                  <img
                    src={coverUrl(p.pin) || p.pin.owner.avatarUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="truncate font-medium">{p.pin.placeName}</span>
                      <span className="tnum shrink-0 text-[10px] text-ink-3">
                        {p.distanceKm < 10
                          ? `${p.distanceKm.toFixed(1)} km`
                          : `${Math.round(p.distanceKm)} km`}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-ink-3">{p.reason}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {dontMiss.alreadyCovered && (
          <p className="mt-3 border-t border-line pt-2.5 text-[11px] leading-relaxed text-ink-3">
            You&apos;ve already been to the spots your friends rate around here. Nothing you&apos;d
            regret skipping.
          </p>
        )}

        {tripDraft && (
          <button
            onClick={() => {
              addTripStop({ lng: place.lng, lat: place.lat, placeName: place.name });
              setSearchedPlace(null);
            }}
            className="mt-2.5 w-full rounded-full bg-accent py-2 text-xs font-semibold text-paper"
          >
            + Add {place.name} to trip
          </button>
        )}
      </div>
    </div>
  );
}
