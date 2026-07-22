"use client";

import { useStore } from "@/lib/store";

// Floating toolbar while planning a trip: name it, choose who can see it,
// tap the map to add stops, undo, save.
export default function TripDraftBar() {
  const draft = useStore((s) => s.tripDraft)!;
  const setTitle = useStore((s) => s.setTripDraftTitle);
  const setVisibility = useStore((s) => s.setTripDraftVisibility);
  const undoStop = useStore((s) => s.undoTripStop);
  const cancel = useStore((s) => s.cancelTripDraft);
  const save = useStore((s) => s.saveTripDraft);

  const canSave = draft.stops.length >= 2;

  return (
    <div className="fixed bottom-6 left-1/2 z-30 w-[min(94vw,480px)] -translate-x-1/2">
      <div className="animate-sheet rounded-3xl bg-paper/95 p-4 shadow-float backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <input
            value={draft.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name this trip…"
            className="min-w-0 flex-1 bg-transparent font-display text-xl outline-none placeholder:text-ink-3"
          />
          <div className="flex shrink-0 gap-1 rounded-full bg-paper-2 p-1">
            <button
              onClick={() => setVisibility("private")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                draft.visibility === "private" ? "bg-ink text-paper" : "text-ink-3"
              }`}
            >
              Only me
            </button>
            <button
              onClick={() => setVisibility("friends")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                draft.visibility === "friends" ? "bg-ink text-paper" : "text-ink-3"
              }`}
            >
              Friends
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-ink-3">
          {draft.stops.length === 0
            ? "Tap the map to drop your first stop."
            : draft.stops.length === 1
              ? "1 stop — add at least one more to stitch the thread."
              : `${draft.stops.length} stops · ${draft.stops.map((s) => s.placeName).join(" → ")}`}
        </p>

        <div className="mt-3 flex gap-2">
          <button
            onClick={undoStop}
            disabled={draft.stops.length === 0}
            className="rounded-full bg-paper-2 px-4 py-2 text-xs font-semibold text-ink-2 disabled:opacity-40"
          >
            Undo stop
          </button>
          <button
            onClick={cancel}
            className="rounded-full bg-paper-2 px-4 py-2 text-xs font-semibold text-ink-2"
          >
            Cancel
          </button>
          <button
            onClick={() => save()}
            disabled={!canSave}
            className="ml-auto rounded-full bg-accent px-5 py-2 text-xs font-semibold text-paper disabled:opacity-40"
          >
            Save trip
          </button>
        </div>
      </div>
    </div>
  );
}
