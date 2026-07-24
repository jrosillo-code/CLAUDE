"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useFollowedCreators, useFriends, useViewer } from "@/lib/hooks";
import { findCountryAt } from "@/lib/focus";
import WorldProgress from "./WorldProgress";

// Me / individual friends / Everyone toggles (plan §6). Collapses to a pill on
// mobile; expands to a left rail of avatars.
export default function LayerRail({
  onOpenFriends,
  onOpenCreators,
  onOpenTravelers,
  onOpenTrips,
}: {
  onOpenFriends: () => void;
  onOpenCreators: () => void;
  /** Phones open the full Travelers sheet instead of the floating popover. */
  onOpenTravelers: () => void;
  /** Desktop: Trips sits right under the Travelers card. */
  onOpenTrips: () => void;
}) {
  const [open, setOpen] = useState(false);
  const viewer = useViewer();
  const friends = useFriends();
  const creators = useFollowedCreators();
  const activeUserIds = useStore((s) => s.activeUserIds);
  const follows = useStore((s) => s.follows);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const pendingIncoming = friendships.filter(
    (f) =>
      f.status === "pending" &&
      f.requestedBy !== viewerId &&
      (f.userA === viewerId || f.userB === viewerId)
  ).length;
  const showOnlyMe = useStore((s) => s.showOnlyMe);
  const showEveryone = useStore((s) => s.showEveryone);
  const showOnlyCreators = useStore((s) => s.showOnlyCreators);
  const toggleUser = useStore((s) => s.toggleUser);

  const isEveryone = activeUserIds === null;
  const isOn = (id: string) => isEveryone || activeUserIds!.has(id);
  const onlyMe = !isEveryone && activeUserIds!.size === 1 && activeUserIds!.has(viewer.id);
  const onlyCreators =
    !isEveryone &&
    follows.size > 0 &&
    activeUserIds!.size === follows.size &&
    [...follows].every((id) => activeUserIds!.has(id));

  return (
    <div className={`fixed flex flex-col gap-2 max-sm:bottom-[calc(72px+env(safe-area-inset-bottom))] max-sm:left-[18px] sm:left-3 sm:top-1/2 sm:-translate-y-1/2 ${open ? "z-40" : "z-30"}`}>
      <div className="max-sm:relative sm:w-[220px] sm:rounded-3xl sm:bg-paper/90 sm:p-2 sm:shadow-float sm:backdrop-blur">
        <button
          onClick={() =>
            window.innerWidth < 640 ? onOpenTravelers() : setOpen((o) => !o)
          }
          title="Travelers"
          className="flex items-center text-left max-sm:relative max-sm:h-9 max-sm:w-9 max-sm:justify-center max-sm:rounded-full max-sm:bg-paper/85 max-sm:shadow-float max-sm:backdrop-blur sm:w-full sm:justify-between sm:rounded-2xl sm:px-3 sm:py-2"
        >
          <span className="flex items-center gap-2 font-display text-base">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="text-accent">
              <circle cx="9" cy="7.2" r="3.2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.2 19.5c.6-3.4 2.9-5.3 5.8-5.3s5.2 1.9 5.8 5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="17.5" cy="8.6" r="2.4" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
              <path d="M15.4 14.9c1.6-.8 3.9-.4 5.2 1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
            </svg>
            <span className="max-sm:hidden">Travelers</span>
            {pendingIncoming > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-paper max-sm:absolute max-sm:-right-1 max-sm:-top-1 max-sm:h-4 max-sm:min-w-4 max-sm:text-[9px]">
                {pendingIncoming}
              </span>
            )}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`text-ink-3 transition-transform max-sm:hidden ${open ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div
          className={`${open ? "block" : "hidden"} px-1 pb-1 max-sm:absolute max-sm:bottom-0 max-sm:left-11 max-sm:max-h-[62vh] max-sm:w-[248px] max-sm:overflow-y-auto max-sm:rounded-3xl max-sm:bg-paper/90 max-sm:p-3 max-sm:shadow-float max-sm:backdrop-blur`}
        >
          <div className="mb-2 flex gap-1">
            <Segment active={isEveryone} onClick={showEveryone}>Everyone</Segment>
            <Segment active={onlyCreators} onClick={showOnlyCreators}>Creators</Segment>
            <Segment active={onlyMe} onClick={showOnlyMe}>Just me</Segment>
          </div>

          <ul className="space-y-0.5 max-sm:hidden">
            <Row
              user={viewer}
              label="You"
              on={isOn(viewer.id)}
              onToggle={() => toggleUser(viewer.id)}
            />
            {friends.map((f) => (
              <Row
                key={f.id}
                user={f}
                label={f.displayName}
                on={isOn(f.id)}
                onToggle={() => toggleUser(f.id)}
              />
            ))}
          </ul>

          {/* Add friends — with the requests badge when someone's waiting */}
          <button
            onClick={() => {
              setOpen(false); // the sheet takes over — don't leave this floating behind it
              onOpenFriends();
            }}
            className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-ink-2 hover:bg-paper-2"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-dashed border-line text-ink-3">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            </span>
            Add friends
            {pendingIncoming > 0 && (
              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-paper">
                {pendingIncoming}
              </span>
            )}
          </button>

          {/* Creators discovery lives with the rest of the people controls. */}
          <button
            onClick={() => {
              setOpen(false);
              onOpenCreators();
            }}
            className="mt-0.5 flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-ink-2 hover:bg-paper-2"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-dashed border-line text-accent">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2.5 14.3 5l3.4-.3.6 3.3 3 1.6-1.4 3.1 1.4 3.1-3 1.6-.6 3.3-3.4-.3L12 22.7 9.7 20l-3.4.3-.6-3.3-3-1.6 1.4-3.1L2.7 9.2l3-1.6.6-3.3 3.4.3z"
                  fill="currentColor"
                />
              </svg>
            </span>
            Add creators
          </button>

          <WorldProgress />

          {creators.length > 0 && (
            <div className="max-sm:hidden">
              <div className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                Creators
              </div>
              <ul className="mt-0.5 space-y-0.5">
                {creators.map((c) => (
                  <Row
                    key={c.id}
                    user={c}
                    label={c.displayName}
                    on={isOn(c.id)}
                    onToggle={() => toggleUser(c.id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Trips — under Travelers on desktop (220px pill); phones get an icon
          in the same left column, sitting above the Layers substack */}
      <button
        onClick={onOpenTrips}
        title="Trips"
        className="flex items-center rounded-full shadow-float backdrop-blur transition-colors max-sm:h-9 max-sm:w-9 max-sm:justify-center max-sm:bg-paper/85 sm:w-[220px] sm:gap-2 sm:bg-paper/90 sm:py-2.5 sm:pl-5 sm:pr-4 sm:text-left sm:font-display sm:text-base sm:text-ink sm:hover:bg-paper"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-accent-2">
          <circle cx="5" cy="19" r="2.4" fill="currentColor" />
          <circle cx="19" cy="5" r="2.4" fill="currentColor" />
          <path d="M6.8 17.2C10 14 8.5 11 12 8.5c2.4-1.7 4-1.5 5.4-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="0.5 3.4" />
        </svg>
        <span className="max-sm:hidden">Trips</span>
      </button>
    </div>
  );
}

// "Focus": frames the country you're standing in. Asks for location permission,
// finds your country offline via the bundled geometry, and fits the map to it —
// correct framing whether that's Afghanistan or Fiji.
// `bubbleLeft`: the phone feedback bubble opens leftwards when the button sits
// in the right-edge column.
export function FocusButton({ bubbleLeft = false }: { bubbleLeft?: boolean }) {
  const requestFitBounds = useStore((s) => s.requestFitBounds);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const setUserLocation = useStore((s) => s.setUserLocation);
  const [state, setState] = useState<"idle" | "locating" | "off">("idle");
  const [countryName, setCountryName] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(next: "idle" | "off", name: string | null = null) {
    setState(next === "off" ? "off" : "idle");
    setCountryName(name);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setState("idle");
      setCountryName(null);
    }, 2600);
  }

  function focus() {
    if (state === "locating") return;
    if (!("geolocation" in navigator)) {
      flash("off");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lng: longitude, lat: latitude });
        const country = await findCountryAt(longitude, latitude);
        if (country) {
          requestFitBounds(country);
          flash("idle", country.name);
        } else {
          // At sea / not in the dataset — just go to the location itself.
          requestFlyTo(longitude, latitude, 5.5);
          flash("idle");
        }
      },
      () => flash("off"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  const label =
    state === "locating"
      ? "Locating…"
      : state === "off"
        ? "Location off"
        : countryName ?? "Focus";

  return (
    <button
      onClick={focus}
      title="Frame the country you're in"
      aria-label="Focus on the country you're in"
      className="relative grid h-9 w-9 place-items-center rounded-full bg-paper/85 shadow-float backdrop-blur transition-colors hover:bg-paper sm:h-11 sm:w-11 sm:bg-paper/90"
    >
      {/* Icon-only everywhere, so feedback floats beside the button — without
          this, a denied location permission looked like a dead button. */}
      {(state !== "idle" || countryName) && (
        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-ink/90 px-3 py-1.5 font-sans text-xs font-medium text-paper shadow-float ${
            bubbleLeft ? "right-11 sm:right-[52px]" : "left-11 sm:left-[52px]"
          }`}
        >
          {state === "off" ? "Location unavailable — allow access" : label}
        </span>
      )}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className={state === "locating" ? "animate-pulse text-accent" : "text-accent"}
      >
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded-full px-1.5 py-1.5 text-[11px] font-medium transition-colors ${
        active ? "bg-ink text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

export function Row({
  user,
  label,
  on,
  onToggle,
}: {
  user: { avatarUrl: string; color: string; handle: string };
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-paper-2">
      {/* Avatar opens the profile; the rest of the row toggles map visibility. */}
      <Link href={`/u/${user.handle}`} title="View profile" className="shrink-0">
        <img
          src={user.avatarUrl}
          alt=""
          className="h-7 w-7 rounded-full object-cover ring-2 transition-transform hover:scale-110"
          style={{ ["--tw-ring-color" as string]: user.color, opacity: on ? 1 : 0.35 }}
        />
      </Link>
      <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className={`truncate text-sm ${on ? "text-ink" : "text-ink-3"}`}>{label}</span>
        <span
          className="ml-auto h-4 w-4 shrink-0 rounded-full border-2"
          style={{
            borderColor: user.color,
            background: on ? user.color : "transparent",
          }}
        />
      </button>
    </li>
  );
}
