"use client";

import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { useFollowedCreators, useFriends, useViewer } from "@/lib/hooks";
import { Row, Segment } from "./LayerRail";
import WorldProgress from "./WorldProgress";

// The Travelers page (phones): same controls as the desktop rail popover —
// visibility segments, per-person toggles, Add friends, shared world
// progress — but presented as a proper sheet like Creators and Trips,
// instead of a translucent card floating over the globe.
export default function TravelersSheet({
  onClose,
  onOpenFriends,
  onOpenCreators,
}: {
  onClose: () => void;
  onOpenFriends: () => void;
  onOpenCreators: () => void;
}) {
  const viewer = useViewer();
  const friends = useFriends();
  const creators = useFollowedCreators();
  const activeUserIds = useStore((s) => s.activeUserIds);
  const follows = useStore((s) => s.follows);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const showOnlyMe = useStore((s) => s.showOnlyMe);
  const showEveryone = useStore((s) => s.showEveryone);
  const showOnlyCreators = useStore((s) => s.showOnlyCreators);
  const toggleUser = useStore((s) => s.toggleUser);

  const pendingIncoming = friendships.filter(
    (f) =>
      f.status === "pending" &&
      f.requestedBy !== viewerId &&
      (f.userA === viewerId || f.userB === viewerId)
  ).length;

  const isEveryone = activeUserIds === null;
  const isOn = (id: string) => isEveryone || activeUserIds!.has(id);
  const onlyMe = !isEveryone && activeUserIds!.size === 1 && activeUserIds!.has(viewer.id);
  const onlyCreators =
    !isEveryone &&
    follows.size > 0 &&
    activeUserIds!.size === follows.size &&
    [...follows].every((id) => activeUserIds!.has(id));

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Travelers</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          Choose whose pins light up your map.
        </p>
        <div className="mt-3 flex gap-1.5">
          <Segment active={isEveryone} onClick={showEveryone}>Everyone</Segment>
          <Segment active={onlyCreators} onClick={showOnlyCreators}>Creators</Segment>
          <Segment active={onlyMe} onClick={showOnlyMe}>Just me</Segment>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
        <ul className="space-y-0.5">
          <Row user={viewer} label="You" on={isOn(viewer.id)} onToggle={() => toggleUser(viewer.id)} />
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

        <button
          onClick={() => {
            onClose();
            onOpenFriends();
          }}
          className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-ink-2 hover:bg-paper-2"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-dashed border-line text-ink-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </span>
          Add friends
          {pendingIncoming > 0 && (
            <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-paper">
              {pendingIncoming}
            </span>
          )}
        </button>

        {/* Creators merged in: discovery lives here, not as its own map button */}
        <button
          onClick={() => {
            onClose();
            onOpenCreators();
          }}
          className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-ink-2 hover:bg-paper-2"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-dashed border-line text-accent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2.5 14.3 5l3.4-.3.6 3.3 3 1.6-1.4 3.1 1.4 3.1-3 1.6-.6 3.3-3.4-.3L12 22.7 9.7 20l-3.4.3-.6-3.3-3-1.6 1.4-3.1L2.7 9.2l3-1.6.6-3.3 3.4.3z"
                fill="currentColor"
              />
            </svg>
          </span>
          Add creators
          <span className="ml-auto text-xs text-ink-3">browse ›</span>
        </button>

        <div className="mt-1 px-1">
          <WorldProgress />
        </div>

        {creators.length > 0 && (
          <>
            <div className="mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Creators you follow
            </div>
            <ul className="mt-1 space-y-0.5">
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
    </Sheet>
  );
}
