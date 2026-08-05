"use client";

import { useEffect, useState } from "react";
import { readEvents, type ProductEventName } from "@/lib/analytics";
import { useStore } from "@/lib/store";

// The guided first-use flow: a small dismissible checklist, not a tutorial.
// Steps complete themselves from the real event log — the user is never
// forced through anything, and each hint says where to click, not what to
// think. Collapsed to a pill after first render; ✕ dismisses it for good
// (localStorage). Hidden entirely once every step is done.

interface Step {
  label: string;
  hint: string;
  events: ProductEventName[];
}

const STEPS: Step[] = [
  {
    label: "See a friend's trip",
    hint: "Left rail → Trips. Finished trips carry their debrief.",
    events: ["reflection_viewed"],
  },
  {
    label: "Read a full debrief",
    hint: "On a friend's trip card, tap “Read full debrief”.",
    events: ["reflection_expanded", "quote_selected"],
  },
  {
    label: "Ask your friends something",
    hint: "Type in the search bar, pick “Ask your friends”.",
    events: ["ask_question_submitted"],
  },
  {
    label: "Clone a friend's trip",
    hint: "Any friend trip card → “Clone trip” makes it your draft.",
    events: ["trip_cloned"],
  },
  {
    label: "Debrief a trip of your own",
    hint: "Your trip card → “Mark trip completed”. Under a minute.",
    events: ["debrief_completed"],
  },
  {
    label: "See where your words help",
    hint: "The save screen shows exactly where your answers surface.",
    events: ["reward_viewed"],
  },
];

const DISMISS_KEY = "wp-guided-start-dismissed";

export default function GuidedStart() {
  const session = useStore((s) => s.session);
  const viewerId = useStore((s) => s.viewerId);
  const [dismissed, setDismissed] = useState(true); // resolved after mount
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Steps complete from the live event log; poll lightly while visible.
  useEffect(() => {
    if (dismissed) return;
    const refresh = () => {
      const events = readEvents().filter((e) => e.meta.viewerId === viewerId);
      setDone(STEPS.map((s) => events.some((e) => s.events.includes(e.name))));
    };
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [dismissed, viewerId]);

  const completed = done.filter(Boolean).length;
  if (!session || dismissed || completed === STEPS.length) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* session-only dismissal */
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 z-40 flex items-center gap-2 rounded-full bg-paper/95 px-3.5 py-2 text-xs font-semibold shadow-float backdrop-blur max-sm:bottom-[calc(3.4rem+env(safe-area-inset-bottom))] sm:bottom-20"
      >
        <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-paper" style={{ height: 18, minWidth: 18 }}>
          {completed}
        </span>
        Getting started · {completed}/{STEPS.length}
      </button>
    );
  }

  return (
    <div className="fixed left-3 z-40 w-[min(88vw,320px)] rounded-3xl bg-paper/95 p-4 shadow-float backdrop-blur max-sm:bottom-[calc(3.4rem+env(safe-area-inset-bottom))] sm:bottom-20">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-lg">Getting started</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOpen(false)}
            aria-label="Collapse"
            className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-paper-2"
          >
            –
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss for good"
            title="Dismiss — won't show again"
            className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-paper-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
      <ol className="mt-2 space-y-1.5">
        {STEPS.map((s, i) => (
          <li key={s.label} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                done[i] ? "bg-accent text-paper" : "bg-line text-ink-3"
              }`}
            >
              {done[i] ? "✓" : i + 1}
            </span>
            <span className="min-w-0">
              <span className={done[i] ? "text-ink-3 line-through" : "font-medium"}>
                {s.label}
              </span>
              {!done[i] && <span className="block text-[11px] text-ink-3">{s.hint}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
