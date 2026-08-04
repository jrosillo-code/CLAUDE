"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { askFriends, evidenceForApi, type AskAnswer } from "@/lib/askFriends";
import { coverUrl } from "@/lib/data";
import { flagEmoji } from "@/lib/passport";

// "Ask your friends": natural-language questions answered only from the
// people you trust — their pins, ratings, Top 5s and trips. The deterministic
// answer renders instantly; when ANTHROPIC_API_KEY is configured the API
// rewrites it in a warmer voice from the same evidence. Every claim stays
// tappable: evidence cards jump to the friend's actual pin on the map.

export default function AskPanel({
  initialQuestion,
  onClose,
}: {
  initialQuestion?: string;
  onClose: () => void;
}) {
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const friendships = useStore((s) => s.friendships);
  const follows = useStore((s) => s.follows);
  const topPlaces = useStore((s) => s.topPlaces);
  const trips = useStore((s) => s.trips);
  const likeCounts = useStore((s) => s.likeCounts);
  const viewerId = useStore((s) => s.viewerId);
  const selectPin = useStore((s) => s.selectPin);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const requestFitBounds = useStore((s) => s.requestFitBounds);
  const setMapMode = useStore((s) => s.setMapMode);
  const toggleTripShown = useStore((s) => s.toggleTripShown);
  const shownTripIds = useStore((s) => s.shownTripIds);

  const [q, setQ] = useState(initialQuestion ?? "");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const aiAbort = useRef<AbortController | null>(null);

  // Suggested questions come from the graph itself, so they always hit.
  const suggestions = useMemo(() => {
    const out: string[] = [];
    const friendPins = pins.filter((p) => p.userId !== viewerId);
    const country = friendPins.find((p) => p.countryCode === "JP")
      ? "Japan"
      : friendPins[0]
        ? friendPins[0].placeName
        : null;
    if (country) out.push(`Who's been to ${country}?`);
    out.push("Where do my friends surf?");
    out.push("What's the highest-rated place in my circle?");
    return out;
  }, [pins, viewerId]);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQ(trimmed);
    setAsked(trimmed);
    const a = askFriends({
      question: trimmed,
      viewerId,
      users,
      pins,
      friendships,
      follows,
      topPlaces,
      trips,
      likeCounts,
    });
    setAnswer(a);
    setAiText(null);

    // Optional AI voice on top of the same evidence.
    aiAbort.current?.abort();
    if (!a.empty) {
      const ac = new AbortController();
      aiAbort.current = ac;
      setAiLoading(true);
      fetch("/api/ask-friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, ...evidenceForApi(a) }),
        signal: ac.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!ac.signal.aborted && j?.source === "ai" && j.answer) setAiText(j.answer);
        })
        .catch(() => {})
        .finally(() => {
          if (!ac.signal.aborted) setAiLoading(false);
        });
    } else {
      setAiLoading(false);
    }
  }

  // Ask immediately when opened from the search bar with a question.
  useEffect(() => {
    if (initialQuestion?.trim()) ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPin(pinId: string, lng: number, lat: number) {
    selectPin(pinId);
    requestFlyTo(lng, lat, 9, { flat: true });
    onClose();
  }

  function viewTrip(tripId: string) {
    const t = trips.find((x) => x.id === tripId);
    if (!t || t.stops.length === 0) return;
    setMapMode("trips");
    if (!shownTripIds.has(tripId)) toggleTripShown(tripId);
    const lngs = t.stops.map((s) => s.lng);
    const lats = t.stops.map((s) => s.lat);
    requestFitBounds({
      w: Math.min(...lngs) - 0.5,
      s: Math.min(...lats) - 0.5,
      e: Math.max(...lngs) + 0.5,
      n: Math.max(...lats) + 0.5,
    });
    onClose();
  }

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate font-display text-2xl">Ask your friends</h2>
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
        <p className="mt-1 text-sm text-ink-3">
          Answers come only from people you trust — their pins, ratings and trips. Not the internet.
        </p>
        <form
          className="mt-3 flex items-center gap-2 rounded-full bg-paper-2 px-4 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-accent">
            <path d="M12 2.5c1 3.4 2.2 5 5.5 5.5-3.3.5-4.5 2.1-5.5 5.5-1-3.4-2.2-5-5.5-5.5 3.3-.5 4.5-2.1 5.5-5.5z" fill="currentColor" />
          </svg>
          <input
            autoFocus={!initialQuestion}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Who's been to… / Where should I…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-paper"
          >
            Ask
          </button>
        </form>
      </div>

      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!asked && (
          <>
            <div className="rounded-2xl border border-line bg-paper-2/50 p-7 text-center">
              <div className="text-2xl">🧭</div>
              <p className="mt-2 font-display text-lg">Your circle knows things</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-3">
                Ask about a place, a country, or a kind of trip — the answer is built from your
                friends&apos; actual pins and ratings.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full bg-paper-2 px-3 py-1.5 text-xs text-ink-2 transition-colors hover:bg-line"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {asked && answer && (
          <>
            {/* The answer — AI voice when available, deterministic otherwise */}
            <div className="rounded-2xl border border-line bg-paper-2/60 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
                {answer.people.slice(0, 4).map((p) => (
                  <img
                    key={p.id}
                    src={p.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover ring-1 ring-paper"
                  />
                ))}
                <span className="ml-1">
                  {answer.empty
                    ? "No answer in your circle yet"
                    : `From ${answer.people.length === 1 ? answer.people[0].displayName : `${answer.people.length} people you trust`}`}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{aiText ?? answer.text}</p>
              {aiLoading && !aiText && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-3">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  polishing the answer…
                </div>
              )}
            </div>

            {/* Evidence: real pins behind every claim */}
            {answer.evidence.map((e) => {
              const cover = coverUrl(e.pin);
              return (
                <button
                  key={e.pin.id}
                  onClick={() => openPin(e.pin.id, e.pin.lng, e.pin.lat)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper-2/60 p-2.5 text-left transition-colors hover:bg-paper-2"
                >
                  <img
                    src={cover || e.pin.owner.avatarUrl}
                    alt=""
                    className="h-14 w-16 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <img
                        src={e.pin.owner.avatarUrl}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover"
                      />
                      <span className="truncate text-sm font-medium">
                        {e.pin.owner.displayName}
                      </span>
                      {e.topRank && (
                        <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                          Top 5 · #{e.topRank}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-ink-2">
                      {flagEmoji(e.pin.countryCode)} {e.pin.placeName}
                      {e.pin.note ? ` — ${e.pin.note}` : ""}
                    </div>
                  </div>
                  {e.pin.rating != null && (
                    <span className="shrink-0 rounded-full bg-ink px-2 py-1 text-[11px] font-bold text-paper">
                      {e.pin.rating}/10
                    </span>
                  )}
                </button>
              );
            })}

            {/* Matching friend trips — view or use as a starting point */}
            {answer.trips.map((t) => (
              <div
                key={t.trip.id}
                className="rounded-2xl border border-line bg-paper-2/60 p-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={t.owner.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-2"
                    style={{ ["--tw-ring-color" as string]: t.owner.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.trip.title}</div>
                    <div className="truncate text-xs text-ink-3">
                      {t.owner.displayName} · {t.trip.stops.map((s) => s.placeName).join(" → ")}
                    </div>
                  </div>
                  <button
                    onClick={() => viewTrip(t.trip.id)}
                    className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-paper"
                  >
                    View route
                  </button>
                </div>
              </div>
            ))}

            {answer.empty && (
              <div className="rounded-2xl border border-line bg-paper-2/50 p-7 text-center">
                <div className="text-2xl">🌱</div>
                <p className="mt-2 font-display text-lg">You&apos;d be the first</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-3">
                  Nobody in your circle has been there yet. Go — and your pin becomes the answer
                  for the next friend who asks.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
