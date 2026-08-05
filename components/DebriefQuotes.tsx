"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { quotesFor, sortQuotesByPriority, type QuoteWithContext } from "@/lib/interview";
import { track, trackOnce } from "@/lib/analytics";

// A friend's debrief, on their trip card: at most two high-value quotes
// collapsed (don't-miss and skip first), expandable to the full set. Every
// quote is the friend's exact words in quotation marks, labeled with the
// question that produced it and whether it's about the whole trip or one
// place. Skipped questions simply don't exist here — no "3 of 5 answered"
// guilt. Drafts never reach this component (visibility is filtered upstream
// by the same rules RLS enforces server-side).

export default function DebriefQuotes({
  tripId,
  onNavigateToPin,
}: {
  tripId: string;
  /** Called after the map fly-to so the host panel can close. */
  onNavigateToPin?: () => void;
}) {
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const trips = useStore((s) => s.trips);
  const friendships = useStore((s) => s.friendships);
  const reflections = useStore((s) => s.reflections);
  const viewerId = useStore((s) => s.viewerId);
  const selectPin = useStore((s) => s.selectPin);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const setMapMode = useStore((s) => s.setMapMode);

  const [expanded, setExpanded] = useState(false);

  const quotes = useMemo(() => {
    const all = quotesFor(reflections, friendships, viewerId, users, trips, pins).filter(
      (q) => q.reflection.tripId === tripId && q.owner.id !== viewerId && q.answer.text.trim()
    );
    return sortQuotesByPriority(all);
  }, [reflections, friendships, viewerId, users, trips, pins, tripId]);

  // Funnel stage 1: the viewer saw a friend's debrief evidence.
  useEffect(() => {
    if (quotes.length === 0) return;
    trackOnce("reflection_viewed", {
      reflectionId: quotes[0].reflection.id,
      ownerId: quotes[0].owner.id,
      viewerId,
    });
  }, [quotes, viewerId]);

  if (quotes.length === 0) return null;
  const shown = expanded ? quotes : quotes.slice(0, 2);
  const owner = quotes[0].owner;

  function openPin(q: QuoteWithContext) {
    if (!q.pin) return;
    track("quote_selected", {
      reflectionId: q.reflection.id,
      ownerId: q.owner.id,
      viewerId,
      questionId: q.answer.questionId,
    });
    track("reflection_pin_nav", {
      reflectionId: q.reflection.id,
      pinId: q.pin.id,
      ownerId: q.owner.id,
      viewerId,
    });
    setMapMode("pins");
    selectPin(q.pin.id);
    requestFlyTo(q.pin.lng, q.pin.lat, 10, { flat: true });
    onNavigateToPin?.();
  }

  return (
    <div className="mt-2.5 border-t border-line pt-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        {owner.displayName.split(" ")[0]}&apos;s debrief
      </div>
      <div className="mt-1.5 space-y-2">
        {shown.map((q) => (
          <div key={q.answer.questionId} className="text-sm">
            <div className="text-[11px] text-ink-3">
              {q.answer.prompt}
              <span className="mx-1">·</span>
              {q.pin ? (
                <button
                  onClick={() => openPin(q)}
                  className="font-medium text-accent underline-offset-2 hover:underline"
                  title={`Fly to ${q.pin.placeName}`}
                >
                  {q.pin.placeName} ↗
                </button>
              ) : (
                <span>whole trip</span>
              )}
            </div>
            <p className="mt-0.5 border-l-2 border-accent/50 pl-2.5 italic leading-relaxed text-ink-2">
              “{q.answer.text}”
              <span className="not-italic text-ink-3"> — {owner.displayName.split(" ")[0]}</span>
              {q.answer.scale && (
                <span className="ml-1.5 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold capitalize not-italic text-paper">
                  {q.answer.scale}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
      {quotes.length > 2 && (
        <button
          onClick={() => {
            const next = !expanded;
            setExpanded(next);
            if (next)
              trackOnce("reflection_expanded", {
                reflectionId: quotes[0].reflection.id,
                ownerId: owner.id,
                viewerId,
              });
          }}
          className="mt-1.5 text-xs font-semibold text-ink-3 underline-offset-2 hover:text-ink hover:underline"
        >
          {expanded ? "Show less" : `Read full debrief (${quotes.length} answers)`}
        </button>
      )}
    </div>
  );
}
