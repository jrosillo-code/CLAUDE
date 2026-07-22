"use client";

// "A map should never feel empty" — when the active layers surface nothing,
// give an escape hatch rather than a blank globe.
import { useStore } from "@/lib/store";

export default function EmptyHint() {
  const showEveryone = useStore((s) => s.showEveryone);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-20 flex justify-center">
      <div className="pointer-events-auto mx-4 max-w-sm rounded-3xl bg-paper/90 p-5 text-center shadow-float backdrop-blur">
        <div className="text-3xl">🗺️</div>
        <p className="mt-2 font-display text-lg">Nothing on the map here</p>
        <p className="mt-1 text-sm text-ink-2">
          Turn a friend&apos;s layer back on, or drop your first pin with the + button.
        </p>
        <button
          onClick={showEveryone}
          className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
        >
          Show everyone
        </button>
      </div>
    </div>
  );
}
