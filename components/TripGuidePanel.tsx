"use client";

import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import type { Trip } from "@/lib/types";

// AI route guide: opens alongside "View route" and briefs every stop on the
// trip — what the place is, best hotels/hostels, and things to do.

interface GuideStop {
  placeName: string;
  overview: string;
  stay: { name: string; kind: "hotel" | "hostel"; note: string }[];
  activities: string[];
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; source: "ai" | "demo"; stops: GuideStop[] };

export default function TripGuidePanel({
  trip,
  onClose,
}: {
  trip: Trip;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetch("/api/trip-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: trip.title,
        stops: trip.stops.map((s) => ({
          placeName: s.placeName,
          lat: s.lat,
          lng: s.lng,
        })),
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((g) => {
        if (alive) setState({ status: "ready", source: g.source, stops: g.stops });
      })
      .catch(() => {
        if (alive) setState({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [trip.id, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl">Route guide</h2>
            <p className="mt-0.5 truncate text-sm text-ink-3">
              {trip.title} · {trip.stops.length} stops
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-paper-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {state.status === "ready" && state.source === "demo" && (
          <p className="mt-2 rounded-xl bg-paper-2 px-3 py-2 text-xs text-ink-3">
            Demo guide — add <code className="font-mono">ANTHROPIC_API_KEY</code> to{" "}
            <code className="font-mono">.env</code> for real AI briefs on each stop.
          </p>
        )}
      </div>

      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {state.status === "loading" && (
          <>
            <div className="flex items-center gap-2 px-1 text-sm text-ink-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              Writing your guide…
            </div>
            {trip.stops.map((s) => (
              <div key={s.id} className="animate-pulse rounded-2xl border border-line bg-paper-2/60 p-4">
                <div className="text-sm font-medium">{s.placeName}</div>
                <div className="mt-2 h-3 w-11/12 rounded bg-paper" />
                <div className="mt-1.5 h-3 w-8/12 rounded bg-paper" />
                <div className="mt-3 h-3 w-5/12 rounded bg-paper" />
              </div>
            ))}
          </>
        )}

        {state.status === "error" && (
          <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
            <div className="text-2xl">🧭</div>
            <p className="mt-2 font-display text-lg">Couldn&apos;t write the guide</p>
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-3 rounded-full bg-ink px-5 py-2 text-xs font-semibold text-paper"
            >
              Try again
            </button>
          </div>
        )}

        {state.status === "ready" &&
          state.stops.map((g, i) => (
            <div key={i} className="rounded-2xl border border-line bg-paper-2/60 p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-paper">
                  {i + 1}
                </span>
                <h3 className="min-w-0 truncate font-display text-lg">{g.placeName}</h3>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-ink-2">{g.overview}</p>

              {g.stay.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    Where to stay
                  </div>
                  <ul className="mt-1.5 space-y-1.5">
                    {g.stay.map((st, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <span
                          className={`mt-0.5 shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${
                            st.kind === "hostel"
                              ? "bg-accent/15 text-accent"
                              : "bg-ink/10 text-ink-2"
                          }`}
                        >
                          {st.kind === "hostel" ? "Hostel" : "Hotel"}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium">{st.name}</span>
                          {st.note && <span className="text-ink-3"> — {st.note}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {g.activities.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    Things to do
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {g.activities.map((a, j) => (
                      <span key={j} className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-2">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
    </Sheet>
  );
}
