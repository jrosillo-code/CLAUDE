"use client";

import { useMemo } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { visiblePins, coverUrl } from "@/lib/data";
import { flagEmoji } from "@/lib/passport";
import type { PinWithOwner } from "@/lib/types";

// The pin feed: the latest drops from you, your friends, and creators you
// follow — newest first, opened from the Waypoint logo. "Take me there" flies
// the map straight to the pin.
export default function PinFeed({ onClose }: { onClose: () => void }) {
  const pins = useStore((s) => s.pins);
  const users = useStore((s) => s.users);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const follows = useStore((s) => s.follows);
  const activeUserIds = useStore((s) => s.activeUserIds);
  const showEveryone = useStore((s) => s.showEveryone);
  const setMapMode = useStore((s) => s.setMapMode);
  const requestFlyTo = useStore((s) => s.requestFlyTo);

  const feed = useMemo(
    () =>
      visiblePins({
        pins,
        users,
        friendships,
        viewerId,
        follows,
        // The feed ignores the map's layer toggles — it's everything you're
        // allowed to see, newest post first.
        activeUserIds: null,
        explore: false,
      })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 40),
    [pins, users, friendships, viewerId, follows]
  );

  function takeMeThere(p: PinWithOwner) {
    setMapMode("pins");
    // If the owner's layer is toggled off the pin wouldn't render — widen.
    if (activeUserIds && !activeUserIds.has(p.userId)) showEveryone();
    onClose();
    requestFlyTo(p.lng, p.lat, 7);
  }

  return (
    <Sheet onClose={onClose} side="left">
      <div className="border-b border-line px-5 pb-3.5 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Latest pins</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          Fresh drops from you, your friends, and creators you follow.
        </p>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        {feed.length === 0 && (
          <p className="px-2 py-10 text-center text-sm text-ink-3">
            Nothing yet — add friends or follow creators and their pins land here.
          </p>
        )}
        <ul className="space-y-1">
          {feed.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => takeMeThere(p)}
                className="flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-paper-2"
              >
                <img
                  src={p.owner.avatarUrl}
                  alt=""
                  className="mt-0.5 h-10 w-10 shrink-0 rounded-full object-cover ring-2"
                  style={{ ["--tw-ring-color" as string]: p.owner.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {p.userId === viewerId ? "You" : p.owner.displayName}
                    </span>
                    <span className="shrink-0 text-xs text-ink-3">{timeAgo(p.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-2">{p.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {p.countryCode ? `${flagEmoji(p.countryCode)} ` : "📍 "}
                    {p.placeName}
                  </span>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-semibold text-accent">
                    Take me there
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </span>
                {coverUrl(p) && (
                  <img
                    src={coverUrl(p)!}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return d === 1 ? "yesterday" : `${d}d ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(mo / 12)}y ago`;
}
