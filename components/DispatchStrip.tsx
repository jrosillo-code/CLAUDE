"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useVisiblePins } from "@/lib/hooks";
import { liveDispatchesByUser, agoLabel } from "@/lib/dispatches";

// The strip: one bubble per traveler in your circle who dropped a pin while
// they were there in the last three days. Tap one and the map flies to them
// and plays their dispatches. Only pins you may already see are in it.
export default function DispatchStrip({ onOpen }: { onOpen: (userId: string) => void }) {
  const pins = useVisiblePins();
  const viewerId = useStore((s) => s.viewerId);
  const groups = useMemo(() => liveDispatchesByUser(pins, viewerId), [pins, viewerId]);
  if (groups.length === 0) return null;
  return (
    <div
      className="fixed left-1/2 top-[60px] z-20 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full bg-paper/80 px-2.5 py-1.5 shadow-float backdrop-blur no-scrollbar sm:top-[80px]"
      data-testid="dispatch-strip"
      aria-label="Live dispatches"
    >
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
