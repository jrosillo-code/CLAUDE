"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { friendshipStatus } from "@/lib/data";
import type { User } from "@/lib/types";

// Add friends: incoming requests up top (accept/decline), your sent requests,
// then discoverable travelers with search. Friendship gates pin visibility, so
// accepting someone literally reveals their map.
export default function FriendsPanel({ onClose }: { onClose: () => void }) {
  const users = useStore((s) => s.users);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const sendFriendRequest = useStore((s) => s.sendFriendRequest);
  const respondFriendRequest = useStore((s) => s.respondFriendRequest);
  const cancelFriendRequest = useStore((s) => s.cancelFriendRequest);

  const [q, setQ] = useState("");

  const { incoming, outgoing, discover, current } = useMemo(() => {
    const inc: User[] = [];
    const out: User[] = [];
    const disc: User[] = [];
    const cur: User[] = [];
    for (const u of users) {
      if (u.id === viewerId || u.isCreator) continue;
      const f = friendshipStatus(friendships, viewerId, u.id);
      if (!f) disc.push(u);
      else if (f.status === "accepted") cur.push(u);
      else if (f.status === "pending" && f.requestedBy === u.id) inc.push(u);
      else if (f.status === "pending" && f.requestedBy === viewerId) out.push(u);
    }
    return { incoming: inc, outgoing: out, discover: disc, current: cur };
  }, [users, friendships, viewerId]);

  const needle = q.trim().toLowerCase();
  const filteredDiscover = needle
    ? discover.filter(
        (u) =>
          u.displayName.toLowerCase().includes(needle) ||
          u.handle.toLowerCase().includes(needle) ||
          u.homeCity.toLowerCase().includes(needle)
      )
    : discover;

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Add friends</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          Friends see your friends-only pins — accepting someone reveals their map to you.
        </p>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4">
        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div className="mb-5">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Requests
            </div>
            <ul className="mt-2 space-y-2">
              {incoming.map((u) => (
                <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-line bg-paper-2/60 p-3">
                  <PersonInfo user={u} onClose={onClose} />
                  <div className="ml-auto flex shrink-0 gap-1.5">
                    <button
                      onClick={() => respondFriendRequest(u.id, true)}
                      className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-paper"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondFriendRequest(u.id, false)}
                      className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink-3 ring-1 ring-line"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sent */}
        {outgoing.length > 0 && (
          <div className="mb-5">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Sent
            </div>
            <ul className="mt-2 space-y-2">
              {outgoing.map((u) => (
                <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                  <PersonInfo user={u} onClose={onClose} />
                  <button
                    onClick={() => cancelFriendRequest(u.id)}
                    title="Withdraw request"
                    className="ml-auto shrink-0 rounded-full bg-paper-2 px-3.5 py-1.5 text-xs font-semibold text-ink-3 hover:bg-line"
                  >
                    Requested ·✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Discover */}
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          Find travelers
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-full bg-paper-2 px-4 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-3">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, handle, or city"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
        </div>
        <ul className="mt-2 space-y-2">
          {filteredDiscover.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <PersonInfo user={u} onClose={onClose} />
              <button
                onClick={() => sendFriendRequest(u.id)}
                className="ml-auto shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper"
              >
                Add friend
              </button>
            </li>
          ))}
          {filteredDiscover.length === 0 && (
            <li className="rounded-2xl border border-line bg-paper-2/50 p-6 text-center text-sm text-ink-3">
              {needle ? "No travelers match that search." : "No new travelers to add right now."}
            </li>
          )}
        </ul>

        {/* Current friends — tap through to profiles, or remove */}
        {current.length > 0 && (
          <div className="mt-5">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Your friends · {current.length}
            </div>
            <ul className="mt-2 space-y-2">
              {current.map((u) => (
                <RemovableFriend key={u.id} user={u} onClose={onClose} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// A friend row with a two-tap remove (first tap arms, second confirms) so a
// stray click can't sever a friendship.
function RemovableFriend({ user, onClose }: { user: User; onClose: () => void }) {
  const respondFriendRequest = useStore((s) => s.respondFriendRequest);
  const [arming, setArming] = useState(false);
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line p-3">
      <PersonInfo user={user} onClose={onClose} />
      <button
        onClick={() => (arming ? respondFriendRequest(user.id, false) : setArming(true))}
        onBlur={() => setArming(false)}
        className={`ml-auto shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
          arming ? "bg-accent text-paper" : "bg-paper-2 text-ink-3 ring-1 ring-line hover:text-accent"
        }`}
      >
        {arming ? "Confirm remove" : "Remove"}
      </button>
    </li>
  );
}

function PersonInfo({ user, onClose }: { user: User; onClose: () => void }) {
  return (
    <Link href={`/u/${user.handle}`} onClick={onClose} className="flex min-w-0 items-center gap-3">
      <img
        src={user.avatarUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2"
        style={{ ["--tw-ring-color" as string]: user.color }}
      />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{user.displayName}</div>
        <div className="truncate text-xs text-ink-3">@{user.handle} · {user.homeCity}</div>
      </div>
    </Link>
  );
}
