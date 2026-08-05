"use client";

import { useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { acceptedFriendIds, canView, coverUrl, distanceKm } from "@/lib/data";
import { dontMissPicks } from "@/lib/regret";
import {
  quoteStance,
  quotesFor,
  quotesNearPlace,
  sortQuotesByPriority,
  type QuoteWithContext,
} from "@/lib/interview";
import { track, trackOnce } from "@/lib/analytics";
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
  const noteCitation = useStore((s) => s.noteCitation);
  const pins = useStore((s) => s.pins);
  const friendships = useStore((s) => s.friendships);
  const follows = useStore((s) => s.follows);
  const selectPin = useStore((s) => s.selectPin);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const tripDraft = useStore((s) => s.tripDraft);
  const addTripStop = useStore((s) => s.addTripStop);
  const setMapMode = useStore((s) => s.setMapMode);
  const shownTripIds = useStore((s) => s.shownTripIds);
  const toggleTripShown = useStore((s) => s.toggleTripShown);
  const requestFitBounds = useStore((s) => s.requestFitBounds);

  const topPlaces = useStore((s) => s.topPlaces);
  const reflections = useStore((s) => s.reflections);
  const trips = useStore((s) => s.trips);

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
      reflections,
      trips,
    });
  }, [place, pins, users, friendships, follows, topPlaces, reflections, trips, viewerId]);

  // "What friends said": authorized debrief quotes about this area, matched
  // by geography. Trust surface — friends and followed creators only; a
  // stranger's public debrief never appears here. Disagreement stays visible:
  // endorsements and warnings render side by side, no consensus is invented.
  const friendVoices = useMemo(() => {
    if (!place) return { endorsements: [], warnings: [], neutral: [] };
    const friendIds = acceptedFriendIds(friendships, viewerId);
    const trusted = new Set<string>([...friendIds, ...follows]);
    const near = quotesNearPlace(
      quotesFor(reflections, friendships, viewerId, users, trips, pins).filter(
        (q) => q.owner.id !== viewerId && trusted.has(q.owner.id) && q.answer.text.trim()
      ),
      { lat: place.lat, lng: place.lng }
    );
    const sorted = sortQuotesByPriority(near);
    return {
      endorsements: sorted.filter((q) => quoteStance(q.answer) === "endorsement"),
      warnings: sorted.filter((q) => quoteStance(q.answer) === "warning"),
      neutral: sorted.filter((q) => quoteStance(q.answer) === "neutral"),
    };
  }, [place, reflections, friendships, follows, users, trips, pins, viewerId]);

  const voicesShown =
    friendVoices.endorsements.length + friendVoices.warnings.length + friendVoices.neutral.length;

  // Evidence provenance events (ids only, deduped per session).
  useEffect(() => {
    for (const q of [
      ...friendVoices.endorsements,
      ...friendVoices.warnings,
      ...friendVoices.neutral,
    ]) {
      trackOnce("reflection_place_evidence", {
        reflectionId: q.reflection.id,
        ownerId: q.owner.id,
        viewerId,
        questionId: q.answer.questionId,
      });
      noteCitation(q.reflection.id, q.owner.id, "place");
    }
    for (const p of dontMiss.picks) {
      if (p.fromDebrief && p.sourceReflectionId) {
        trackOnce("reflection_dontmiss_evidence", {
          reflectionId: p.sourceReflectionId,
          ownerId: p.sourceOwnerId,
          pinId: p.pin.id,
          viewerId,
        });
        if (p.sourceOwnerId) noteCitation(p.sourceReflectionId, p.sourceOwnerId, "dontmiss");
      }
    }
  }, [friendVoices, dontMiss, viewerId]);

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

  if (!place || (tips.length === 0 && dontMiss.picks.length === 0 && voicesShown === 0))
    return null;

  function openQuote(q: QuoteWithContext) {
    if (q.pin) {
      track("reflection_pin_nav", {
        reflectionId: q.reflection.id,
        pinId: q.pin.id,
        ownerId: q.owner.id,
        viewerId,
      });
      selectPin(q.pin.id);
      requestFlyTo(q.pin.lng, q.pin.lat, 10, { flat: true });
    } else if (q.trip) {
      const t = q.trip;
      setMapMode("trips");
      if (!shownTripIds.has(t.id)) toggleTripShown(t.id);
      const lngs = t.stops.map((s) => s.lng);
      const lats = t.stops.map((s) => s.lat);
      requestFitBounds({
        w: Math.min(...lngs) - 0.5,
        s: Math.min(...lats) - 0.5,
        e: Math.max(...lngs) + 0.5,
        n: Math.max(...lats) + 0.5,
      });
      setSearchedPlace(null);
    }
  }

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
        {/* What friends said: verbatim debrief quotes about this area, split
            by stance. Mixed evidence stays mixed — both sides render. */}
        {voicesShown > 0 && (
          <div className="mt-3 border-t border-line pt-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              What friends said
            </div>
            <div className="mt-1.5 space-y-1.5">
              {friendVoices.endorsements.map((q) => (
                <VoiceRow key={`e-${q.reflection.id}-${q.answer.questionId}`} q={q} stance="endorsement" onOpen={openQuote} />
              ))}
              {friendVoices.warnings.map((q) => (
                <VoiceRow key={`w-${q.reflection.id}-${q.answer.questionId}`} q={q} stance="warning" onOpen={openQuote} />
              ))}
              {friendVoices.neutral.map((q) => (
                <VoiceRow key={`n-${q.reflection.id}-${q.answer.questionId}`} q={q} stance="neutral" onOpen={openQuote} />
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

// One friend's verbatim statement about the area, with its stance made
// visible instead of averaged into a score.
function VoiceRow({
  q,
  stance,
  onOpen,
}: {
  q: QuoteWithContext;
  stance: "endorsement" | "warning" | "neutral";
  onOpen: (q: QuoteWithContext) => void;
}) {
  const first = q.owner.displayName.split(" ")[0];
  const mark =
    stance === "endorsement" ? (
      <span className="mt-0.5 shrink-0 text-accent" title="Recommends">✓</span>
    ) : stance === "warning" ? (
      <span className="mt-0.5 shrink-0" title="Would skip">⚠️</span>
    ) : (
      <span className="mt-0.5 shrink-0 text-ink-3" title="Observation">✦</span>
    );
  return (
    <button
      onClick={() => onOpen(q)}
      className="flex w-full items-start gap-2 rounded-xl bg-paper-2/60 p-2 text-left transition-colors hover:bg-paper-2"
      title={
        q.pin ? `Fly to ${q.pin.placeName}` : q.trip ? `View route: ${q.trip.title}` : undefined
      }
    >
      {mark}
      <span className="min-w-0 flex-1">
        <span className="block text-xs italic leading-relaxed text-ink-2">
          “{q.answer.text}”
        </span>
        <span className="mt-0.5 block text-[11px] text-ink-3">
          — {first}
          {q.trip ? `, after “${q.trip.title}”` : ""}
          {q.pin ? ` · ${q.pin.placeName} ↗` : ""}
          {q.answer.scale ? ` · would return: ${q.answer.scale}` : ""}
        </span>
      </span>
    </button>
  );
}
