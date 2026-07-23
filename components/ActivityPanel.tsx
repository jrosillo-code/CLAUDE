"use client";

import Link from "next/link";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import type { AppNotification } from "@/lib/types";

// The bell: likes on your pins, friend requests, accepts. Opening the panel
// marks everything read.
export default function ActivityPanel({ onClose }: { onClose: () => void }) {
  const notifications = useStore((s) => s.notifications);
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const markAllRead = useStore((s) => s.markNotificationsRead);
  const markOneRead = useStore((s) => s.markNotificationRead);
  const selectPin = useStore((s) => s.selectPin);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const unread = notifications.filter((n) => !n.read).length;

  const usersById = new Map(users.map((u) => [u.id, u]));
  const pinsById = new Map(pins.map((p) => [p.id, p]));

  function line(n: AppNotification): string {
    const pin = n.pinId ? pinsById.get(n.pinId) : undefined;
    switch (n.type) {
      case "like":
        return pin ? `liked your pin in ${pin.placeName}` : "liked one of your pins";
      case "friend_request":
        return "sent you a friend request";
      case "friend_accept":
        return "accepted your friend request";
    }
  }

  function open(n: AppNotification) {
    const pin = n.pinId ? pinsById.get(n.pinId) : undefined;
    if (pin) {
      selectPin(pin.id);
      requestFlyTo(pin.lng, pin.lat, 7);
      onClose();
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Activity</h2>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="rounded-full bg-paper-2 px-3 py-1.5 text-xs font-medium text-ink-3 hover:text-ink"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
        {notifications.length === 0 && (
          <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
            <div className="text-2xl">🔔</div>
            <p className="mt-2 font-display text-lg">All quiet</p>
            <p className="mt-1 text-sm text-ink-3">
              Likes on your pins and friend requests land here.
            </p>
          </div>
        )}
        <ul className="space-y-1">
          {notifications.map((n) => {
            const actor = usersById.get(n.actorId);
            if (!actor) return null;
            const clickable = !!(n.pinId && pinsById.get(n.pinId));
            return (
              // hover lives on the li — disabled buttons swallow mouse events
              <li key={n.id} onMouseEnter={() => markOneRead(n.id)}>
                <button
                  onClick={() => {
                    markOneRead(n.id); // touch has no hover — tapping reads it
                    open(n);
                  }}
                  disabled={!clickable && n.type === "like"}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left ${
                    clickable ? "hover:bg-paper-2" : ""
                  } ${n.read ? "opacity-70" : ""}`}
                >
                  <Link href={`/u/${actor.handle}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <img
                      src={actor.avatarUrl}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover ring-2"
                      style={{ ["--tw-ring-color" as string]: actor.color }}
                    />
                  </Link>
                  <span className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="font-medium">{actor.displayName}</span>{" "}
                    <span className="text-ink-2">{line(n)}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                </button>
              </li>
            );
          })}
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
  return d === 1 ? "yesterday" : `${d}d ago`;
}
