"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { friendshipStatus } from "@/lib/data";
import type { User } from "@/lib/types";

// Add friends — one clean segmented view instead of four stacked sections:
// Requests (incoming + sent), Find (search + discover), Friends (with remove).
// Friendship gates pin visibility, so accepting someone reveals their map.
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

  const [view, setView] = useState<"requests" | "find" | "friends">(
    incoming.length > 0 ? "requests" : "find"
  );

  const needle = q.trim().toLowerCase();
  const filteredDiscover = needle
    ? discover.filter(
        (u) =>
          u.displayName.toLowerCase().includes(needle) ||
          u.handle.toLowerCase().includes(needle) ||
          u.homeCity.toLowerCase().includes(needle)
      )
    : discover;

  const requestCount = incoming.length + outgoing.length;

  return (
    <Sheet onClose={onClose} side="left">
      <div className="border-b border-line px-5 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Friends</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        {/* One segmented control instead of four stacked sections */}
        <div className="mt-3 flex rounded-full bg-paper-2 p-1">
          <Seg active={view === "requests"} onClick={() => setView("requests")}>
            Requests{requestCount > 0 ? ` · ${requestCount}` : ""}
          </Seg>
          <Seg active={view === "find"} onClick={() => setView("find")}>Find</Seg>
          <Seg active={view === "friends"} onClick={() => setView("friends")}>
            Friends{current.length > 0 ? ` · ${current.length}` : ""}
          </Seg>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        {view === "requests" && (
          <>
            {incoming.length === 0 && outgoing.length === 0 && (
              <Empty>No open requests. Find travelers to add.</Empty>
            )}
            {incoming.length > 0 && (
              <>
                <SectionLabel>Waiting on you</SectionLabel>
                <ul>
                  {incoming.map((u) => (
                    <Row key={u.id} user={u} onClose={onClose}>
                      <button
                        onClick={() => respondFriendRequest(u.id, true)}
                        className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-paper"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respondFriendRequest(u.id, false)}
                        aria-label={`Decline ${u.displayName}`}
                        className="grid h-7 w-7 place-items-center rounded-full text-ink-3 ring-1 ring-line hover:text-ink"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                      </button>
                    </Row>
                  ))}
                </ul>
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <SectionLabel>Sent</SectionLabel>
                <ul>
                  {outgoing.map((u) => (
                    <Row key={u.id} user={u} onClose={onClose}>
                      <button
                        onClick={() => cancelFriendRequest(u.id)}
                        title="Withdraw request"
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-3 ring-1 ring-line hover:text-ink"
                      >
                        Pending ✕
                      </button>
                    </Row>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {view === "find" && (
          <>
            <div className="mx-1 flex items-center gap-2 rounded-full bg-paper-2 px-4 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-3">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, handle, or city"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
              />
            </div>
            <ul className="mt-2">
              {filteredDiscover.map((u) => (
                <Row key={u.id} user={u} onClose={onClose}>
                  <button
                    onClick={() => sendFriendRequest(u.id)}
                    className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper"
                  >
                    Add
                  </button>
                </Row>
              ))}
              {filteredDiscover.length === 0 && (
                <Empty>{needle ? "No travelers match that search." : "No new travelers right now."}</Empty>
              )}
            </ul>
            <p className="mt-3 px-2 text-center text-xs text-ink-3">
              Friends see your friends-only pins — accepting someone reveals their map.
            </p>
          </>
        )}

        {view === "friends" && (
          <ul>
            {current.map((u) => (
              <RemovableFriend key={u.id} user={u} onClose={onClose} />
            ))}
            {current.length === 0 && <Empty>No friends yet — send a request from Find.</Empty>}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="list-none px-2 py-8 text-center text-sm text-ink-3">{children}</li>;
}

// A friend row with a two-tap remove (first tap arms, second confirms) so a
// stray click can't sever a friendship.
function RemovableFriend({ user, onClose }: { user: User; onClose: () => void }) {
  const respondFriendRequest = useStore((s) => s.respondFriendRequest);
  const [arming, setArming] = useState(false);
  return (
    <Row user={user} onClose={onClose}>
      <button
        onClick={() => (arming ? respondFriendRequest(user.id, false) : setArming(true))}
        onBlur={() => setArming(false)}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          arming ? "bg-accent text-paper" : "text-ink-3 ring-1 ring-line hover:text-accent"
        }`}
      >
        {arming ? "Confirm" : "Remove"}
      </button>
    </Row>
  );
}

// One light row: avatar + name link, actions on the right. No card borders —
// the list breathes instead of stacking boxes.
function Row({ user, onClose, children }: { user: User; onClose: () => void; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper-2">
      <Link href={`/u/${user.handle}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
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
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </li>
  );
}
