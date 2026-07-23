"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useFollowedCreators, useFriends, useViewer } from "@/lib/hooks";
import { findCountryAt } from "@/lib/focus";
import WorldProgress from "./WorldProgress";

// Me / individual friends / Everyone toggles (plan §6). Collapses to a pill on
// mobile; expands to a left rail of avatars.
export default function LayerRail({ onOpenFriends }: { onOpenFriends: () => void }) {
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
    <div className="fixed z-30 flex flex-col gap-2 max-sm:left-2 max-sm:top-[60px] max-sm:scale-[0.88] max-sm:[transform-origin:top_left] sm:left-3 sm:top-1/2 sm:-translate-y-1/2">
      <div className="w-[220px] rounded-3xl bg-paper/90 p-2 shadow-float backdrop-blur">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left"
        >
          <span className="flex items-center gap-2 font-display text-base">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="text-accent">
              <circle cx="9" cy="7.2" r="3.2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.2 19.5c.6-3.4 2.9-5.3 5.8-5.3s5.2 1.9 5.8 5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="17.5" cy="8.6" r="2.4" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
              <path d="M15.4 14.9c1.6-.8 3.9-.4 5.2 1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
            </svg>
            Travelers
            {pendingIncoming > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-paper">
                {pendingIncoming}
              </span>
            )}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className={`${open ? "block" : "hidden"} px-1 pb-1`}>
          <div className="mb-2 flex gap-1">
            <Segment active={isEveryone} onClick={showEveryone}>Everyone</Segment>
            <Segment active={onlyCreators} onClick={showOnlyCreators}>Creators</Segment>
            <Segment active={onlyMe} onClick={showOnlyMe}>Just me</Segment>
          </div>

          <ul className="space-y-0.5">
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
            onClick={onOpenFriends}
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

          <WorldProgress />

          {creators.length > 0 && (
            <>
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
            </>
          )}
        </div>
      </div>

      <FocusButton />
    </div>
  );
}

// "Focus": frames the country you're standing in. Asks for location permission,
// finds your country offline via the bundled geometry, and fits the map to it —
// correct framing whether that's Afghanistan or Fiji.
function FocusButton() {
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
      className="flex w-[220px] items-center gap-2 rounded-full bg-paper/90 py-2.5 pl-5 pr-4 text-left font-display text-base text-ink shadow-float backdrop-blur transition-colors hover:bg-paper"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        className={state === "locating" ? "animate-pulse text-accent" : "text-accent"}
      >
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="truncate">{label}</span>
    </button>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function Row({
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
