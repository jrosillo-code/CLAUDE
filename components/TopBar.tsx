"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useViewer } from "@/lib/hooks";
import { computeCrossings } from "@/lib/crossings";
import { searchPlaces, type GeoResult } from "@/lib/geocode";
import WaypointLogo from "./Logo";
import { FocusButton } from "./LayerRail";

export default function TopBar({
  onOpenActivity,
  onOpenFeed,
  onOpenCrossings,
}: {
  onOpenActivity: () => void;
  onOpenFeed: () => void;
  onOpenCrossings: () => void;
}) {
  const viewer = useViewer();
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length);

  // Crossings badge: how many "your paths cross" moments are live right now.
  const viewerId = useStore((s) => s.viewerId);
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const trips = useStore((s) => s.trips);
  const friendships = useStore((s) => s.friendships);
  const follows = useStore((s) => s.follows);
  const savedPinIds = useStore((s) => s.savedPinIds);
  const crossingCount = useMemo(
    () => computeCrossings({ viewerId, users, pins, trips, friendships, follows, savedPinIds }).length,
    [viewerId, users, pins, trips, friendships, follows, savedPinIds]
  );

  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Picking a result writes its name into the input — that programmatic change
  // must not re-run the search and pop the dropdown back open.
  const suppressSearchRef = useRef(false);

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const r = await searchPlaces(q, ac.signal);
      setResults(r);
      setOpen(true);
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  function pick(r: GeoResult) {
    suppressSearchRef.current = true;
    setOpen(false);
    setResults([]);
    setQ(r.placeName);
    requestFlyTo(r.lng, r.lat, 9);
  }

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-30 flex items-start gap-1.5 p-2 sm:gap-3 sm:p-4">
      {/* Brand — on desktop the side groups share flex-1/basis-0 so the search
          stays truly centered; on phones they collapse so search gets the room */}
      <div className="flex min-w-0 shrink-0 justify-start sm:flex-1 sm:basis-0">
        {/* Tapping the brand opens the pin feed — the latest drops from your
            travelers, each with a "take me there" jump to the map. */}
        <button
          onClick={onOpenFeed}
          title="Latest pins"
          className="flex shrink-0 items-center gap-2 rounded-full bg-paper/85 px-2.5 py-2 shadow-float backdrop-blur sm:px-3.5"
        >
          <WaypointLogo size={20} />
          <span className="hidden font-display text-lg leading-none sm:block">Waypoint</span>
        </button>
      </div>

      {/* Search — its own centered row on phones, underneath the icon row */}
      {/* Search — lives in the top row on phones too: only the bell and avatar
          stay beside it (Trips/Creators move to the bottom-right column) */}
      <div className="relative max-sm:min-w-0 max-sm:flex-1 sm:w-full sm:max-w-sm sm:shrink">
        <div className="flex items-center gap-2 rounded-full bg-paper/85 px-3 py-2 shadow-float backdrop-blur sm:px-4 sm:py-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-3">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="Search a place…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
          {q && (
            <button onClick={() => { setQ(""); setResults([]); }} className="text-ink-3 hover:text-ink">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
        {open && results.length > 0 && (
          <ul className="absolute z-10 mt-2 max-h-[55dvh] w-full overflow-y-auto rounded-2xl bg-paper shadow-float max-sm:fixed max-sm:inset-x-2 max-sm:top-[52px] max-sm:mt-0 max-sm:w-auto">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => pick(r)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-paper-2"
                >
                  <span className="text-ink-3">
                    {r.kind === "place" ? "🏙" : r.kind === "address" ? "🛣" : "📍"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{r.placeName}</span>
                    {r.context && (
                      <span className="block truncate text-xs text-ink-3">{r.context}</span>
                    )}
                  </span>
                  {r.countryCode && <span className="ml-auto text-xs text-ink-3">{r.countryCode}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:ml-0 sm:flex-1 sm:basis-0 sm:gap-2">
        {/* Crossings — where your plans meet the people you trust */}
        <button
          onClick={onOpenCrossings}
          className="relative grid h-9 w-9 place-items-center rounded-full bg-paper/85 shadow-float backdrop-blur"
          title="Crossings"
          aria-label="Crossings"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
            <path d="M14.8 9.2 11 11l-1.8 3.8L13 13z" fill="currentColor" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          {crossingCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-paper" style={{ height: 18, minWidth: 18 }}>
              {crossingCount}
            </span>
          )}
        </button>

        {/* Activity bell */}
        <button
          onClick={onOpenActivity}
          className="relative grid h-9 w-9 place-items-center rounded-full bg-paper/85 shadow-float backdrop-blur"
          title="Activity"
          aria-label="Activity"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 3.5a6 6 0 0 0-6 6v3.2l-1.6 2.9a.8.8 0 0 0 .7 1.2h13.8a.8.8 0 0 0 .7-1.2L18 12.7V9.5a6 6 0 0 0-6-6zM10 19.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-paper" style={{ height: 18, minWidth: 18 }}>
              {unread}
            </span>
          )}
        </button>

        {/* Viewer / profile */}
        <Link
          href={`/u/${viewer.handle}`}
          prefetch
          className="flex items-center gap-2 rounded-full bg-paper/85 shadow-float backdrop-blur max-sm:h-9 max-sm:w-9 max-sm:justify-center sm:py-1.5 sm:pl-1.5 sm:pr-3"
        >
          <img
            src={viewer.avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover ring-2 sm:h-8 sm:w-8"
            style={{ ["--tw-ring-color" as string]: viewer.color }}
          />
          <span className="hidden text-sm font-medium sm:block">Me</span>
        </Link>
      </div>
    </header>

    {/* Focus floats above the add-pin FAB on every breakpoint — Trips lives
        with Travelers in the left column now. */}
    <div className="fixed z-30 flex flex-col items-center gap-2 max-sm:bottom-[calc(72px+env(safe-area-inset-bottom))] max-sm:right-[18px] sm:bottom-24 sm:right-4 sm:w-14">
      <FocusButton bubbleLeft />
    </div>
    </>
  );
}

