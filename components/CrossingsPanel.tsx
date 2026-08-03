"use client";

import { useMemo } from "react";
import Link from "next/link";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { computeCrossings, type Crossing } from "@/lib/crossings";
import { coverUrl } from "@/lib/data";

// Crossings: the serendipity surface. Two kinds of "your paths are about to
// cross" — friends planning where you're planning, and trusted travelers who've
// already been where you're headed (their pin is the tip).
export default function CrossingsPanel({ onClose }: { onClose: () => void }) {
  const viewerId = useStore((s) => s.viewerId);
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const trips = useStore((s) => s.trips);
  const friendships = useStore((s) => s.friendships);
  const follows = useStore((s) => s.follows);
  const savedPinIds = useStore((s) => s.savedPinIds);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectPin = useStore((s) => s.selectPin);
  const setMapMode = useStore((s) => s.setMapMode);
  const tripDraft = useStore((s) => s.tripDraft);
  const addTripStop = useStore((s) => s.addTripStop);

  const crossings = useMemo(
    () =>
      computeCrossings({
        viewerId,
        users,
        pins,
        trips,
        friendships,
        follows,
        savedPinIds,
      }),
    [viewerId, users, pins, trips, friendships, follows, savedPinIds]
  );

  const planning = crossings.filter((c) => c.kind === "planning");
  const intel = crossings.filter((c) => c.kind === "intel");

  function flyThere(lng: number, lat: number, zoom = 8) {
    setMapMode("pins");
    requestFlyTo(lng, lat, zoom, { flat: true });
    onClose();
  }
  function openPin(id: string, lng: number, lat: number) {
    setMapMode("pins");
    selectPin(id);
    requestFlyTo(lng, lat, 9, { flat: true });
    onClose();
  }

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Crossings</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          Where your plans meet the people you trust — friends heading the same way,
          and tips from travelers who&apos;ve already been.
        </p>
      </div>

      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {crossings.length === 0 && (
          <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
            <div className="text-2xl">✷</div>
            <p className="mt-2 font-display text-lg">No crossings yet</p>
            <p className="mt-1 text-sm text-ink-3">
              Save places you want to go or plan a trip, and Waypoint will surface
              friends heading there and tips from people who&apos;ve been.
            </p>
          </div>
        )}

        {planning.length > 0 && (
          <section>
            <SectionLabel icon="✷" text="Your paths are about to cross" />
            <div className="mt-2 space-y-2.5">
              {planning.map((c) => (
                <PlanningCard key={c.id} c={c} onFly={() => flyThere(c.lng, c.lat)} />
              ))}
            </div>
          </section>
        )}

        {intel.length > 0 && (
          <section>
            <SectionLabel icon="◎" text="Been there — tips for where you're headed" />
            <div className="mt-2 space-y-2.5">
              {intel.map((c) => (
                <IntelCard
                  key={c.id}
                  c={c}
                  onFly={() => flyThere(c.lng, c.lat)}
                  onOpenPin={openPin}
                  tripDraft={!!tripDraft}
                  onAddToTrip={() => {
                    addTripStop({ lng: c.lng, lat: c.lat, placeName: c.placeName });
                    onClose();
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </Sheet>
  );
}

function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
      <span className="text-accent">{icon}</span>
      {text}
    </div>
  );
}

function PlaceHead({ c, onFly }: { c: Crossing; onFly: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="truncate font-display text-lg leading-tight">{c.placeName}</div>
        <div className="mt-0.5 text-xs text-ink-3">{c.mySource}</div>
      </div>
      <button
        onClick={onFly}
        className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper"
      >
        Take me there
      </button>
    </div>
  );
}

function PlanningCard({ c, onFly }: { c: Crossing; onFly: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-2/60 p-3.5">
      <PlaceHead c={c} onFly={onFly} />
      <div className="mt-2.5 space-y-1.5">
        {c.people.map((p) => (
          <Link
            key={p.user.id}
            href={`/u/${p.user.handle}`}
            className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-paper-2"
          >
            <img src={p.user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: p.user.color }} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{p.user.displayName}</div>
              <div className="truncate text-xs text-accent">planning · {p.tripTitle}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function IntelCard({
  c,
  onFly,
  onOpenPin,
  tripDraft,
  onAddToTrip,
}: {
  c: Crossing;
  onFly: () => void;
  onOpenPin: (id: string, lng: number, lat: number) => void;
  tripDraft: boolean;
  onAddToTrip: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper-2/60 p-3.5">
      <PlaceHead c={c} onFly={onFly} />
      <div className="mt-2.5 space-y-2">
        {c.people.map((p) => {
          const pin = p.pin!;
          const cover = coverUrl(pin);
          return (
            <button
              key={p.user.id}
              onClick={() => onOpenPin(pin.id, pin.lng, pin.lat)}
              className="flex w-full items-center gap-3 rounded-xl bg-paper p-2 text-left ring-1 ring-line transition-colors hover:bg-paper-2"
            >
              {cover ? (
                <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <img src={p.user.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <img src={p.user.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                  <span className="truncate text-sm font-medium">{p.user.displayName}</span>
                  {pin.rating != null && (
                    <span className="ml-auto shrink-0 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold text-paper">
                      {pin.rating}/10
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-2">
                  {pin.note || pin.title}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {tripDraft && (
        <button
          onClick={onAddToTrip}
          className="mt-2.5 w-full rounded-full bg-accent py-2 text-xs font-semibold text-paper"
        >
          + Add {c.placeName} to trip
        </button>
      )}
    </div>
  );
}
