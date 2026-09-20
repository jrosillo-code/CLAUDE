"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useDispatchPins } from "@/lib/hooks";
import { liveDispatchesByUser, agoLabel } from "@/lib/dispatches";

// The strip hangs under the Me button at the top right, like stories under
// a profile: one bubble per traveler in your circle who dropped a pin while
// they were there in the last three days. Tap one and the map flies to them
// and plays their dispatches. Only pins you may already see are in it.
export default function DispatchStrip({
  onOpen,
  digest,
}: {
  onOpen: (userId: string) => void;
  /** Tonight's digest, when it is due: a sparkle bubble at the head of the row. */
  digest?: { count: number; onOpen: () => void } | null;
}) {
  const pins = useDispatchPins();
  const viewerId = useStore((s) => s.viewerId);
  const groups = useMemo(() => liveDispatchesByUser(pins, viewerId), [pins, viewerId]);
  const [expanded, setExpanded] = useState(false);
  if (groups.length === 0 && !digest) return null;
  const digestBubble = digest ? (
    <button
      onClick={digest.onOpen}
      title={`Tonight's picks · ${digest.count} places your friends pinned`}
      className="group relative flex shrink-0 flex-col items-center gap-0.5"
      data-testid="digest-bubble"
    >
      <span className="relative grid h-11 w-11 place-items-center">
        <span className="wp-brief-glow absolute inset-0 rounded-full" />
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-ink text-paper ring-2 ring-accent ring-offset-2 ring-offset-paper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6-5.6-1.9 5.6-1.9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9zM5 15l.9 2.6 2.6.9-2.6.9L5 22l-.9-2.6-2.6-.9 2.6-.9z" /></svg>
        </span>
        <span className="absolute -right-0.5 -top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-paper" style={{ height: 18, minWidth: 18 }}>{digest.count}</span>
      </span>
      <span className="max-w-[56px] truncate text-[10px] font-medium text-ink-2">Tonight</span>
    </button>
  ) : null;
  if (groups.length === 0) {
    return (
      <div className="wp-chrome fixed right-2 top-[60px] z-20 flex items-center gap-2 rounded-full bg-paper/80 px-2.5 py-1.5 shadow-float backdrop-blur sm:right-4 sm:top-[80px]" data-testid="dispatch-strip" aria-label="Tonight's picks">
        {digestBubble}
      </div>
    );
  }
  // More than three people live: one stacked bubble with the count; a tap
  // unfolds the full row.
  if (groups.length > 3 && !expanded) {
    return (
      <div className="wp-chrome fixed right-2 top-[60px] z-20 flex items-center gap-2 sm:right-4 sm:top-[80px]">
      {digestBubble && <div className="rounded-full bg-paper/80 px-2 py-1 shadow-float backdrop-blur">{digestBubble}</div>}
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 rounded-full bg-paper/80 py-1.5 pl-2 pr-3.5 shadow-float backdrop-blur"
        data-testid="dispatch-strip-collapsed"
        aria-label={`${groups.length} people are here now — show them`}
      >
        <span className="relative flex h-9 items-center">
          {groups.slice(0, 3).map((g, i) => (
            <span key={g.owner.id} className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-paper" style={{ marginLeft: i ? -10 : 0, zIndex: 3 - i }}>
              <img src={g.owner.avatarUrl} alt="" className="h-full w-full object-cover" />
            </span>
          ))}
          <span className="wp-live-pulse absolute left-3 top-1/2 h-8 w-8 rounded-full bg-accent opacity-30" />
        </span>
        <span className="text-xs font-semibold text-ink-2">{groups.length} here now</span>
      </button>
      </div>
    );
  }
  return (
    <div
      className="wp-chrome fixed right-2 top-[60px] z-20 flex max-w-[calc(100vw-16px)] items-center gap-2 overflow-x-auto rounded-full bg-paper/80 px-2.5 py-1.5 shadow-float backdrop-blur no-scrollbar sm:right-4 sm:top-[80px] sm:max-w-[60vw]"
      data-testid="dispatch-strip"
      aria-label="Live dispatches"
    >
      {groups.length > 3 && (
        <button onClick={() => setExpanded(false)} aria-label="Collapse" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
      {digestBubble}
      {groups.map((g) => (
        <button
          key={g.owner.id}
          onClick={() => onOpen(g.owner.id)}
          title={`${g.owner.displayName} · ${g.pins[0].placeName} · ${agoLabel(g.latestAt)}`}
          className="group relative flex shrink-0 flex-col items-center gap-0.5"
          data-testid={`dispatch-bubble-${g.owner.id}`}
        >
          <span className="relative grid h-11 w-11 place-items-center">
            <span className="wp-live-pulse absolute left-1/2 top-1/2 h-11 w-11 rounded-full bg-accent opacity-40" />
            <span className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-accent ring-offset-2 ring-offset-paper">
              <img src={g.owner.avatarUrl} alt="" className="h-full w-full object-cover" />
            </span>
          </span>
          <span className="max-w-[56px] truncate text-[10px] font-medium text-ink-2">
            {g.owner.id === viewerId ? "You" : g.owner.displayName.split(" ")[0]}
          </span>
        </button>
      ))}
    </div>
  );
}
