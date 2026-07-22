"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useViewer } from "@/lib/hooks";
import { searchPlaces, type GeoResult } from "@/lib/geocode";

export default function TopBar({
  onOpenCreators,
  onOpenTrips,
  tripsActive,
}: {
  onOpenCreators: () => void;
  onOpenTrips: () => void;
  tripsActive: boolean;
}) {
  const viewer = useViewer();
  const requestFlyTo = useStore((s) => s.requestFlyTo);

  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
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
    setOpen(false);
    setQ(r.placeName);
    requestFlyTo(r.lng, r.lat, 9);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
      {/* Brand */}
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-full bg-paper/85 px-3.5 py-2 shadow-float backdrop-blur"
      >
        <Compass />
        <span className="font-display text-lg leading-none">Waypoint</span>
      </Link>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <div className="flex items-center gap-2 rounded-full bg-paper/85 px-4 py-2.5 shadow-float backdrop-blur">
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
          <ul className="absolute mt-2 w-full overflow-hidden rounded-2xl bg-paper shadow-float">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => pick(r)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-paper-2"
                >
                  <span className="text-ink-3">📍</span>
                  <span className="truncate">{r.placeName}</span>
                  {r.countryCode && <span className="ml-auto text-xs text-ink-3">{r.countryCode}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Trips */}
        <button
          onClick={onOpenTrips}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 shadow-float backdrop-blur ${
            tripsActive ? "bg-ink text-paper" : "bg-paper/85"
          }`}
          title="Trips"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent-2">
            <circle cx="5" cy="19" r="2.4" fill="currentColor" />
            <circle cx="19" cy="5" r="2.4" fill="currentColor" />
            <path d="M6.8 17.2C10 14 8.5 11 12 8.5c2.4-1.7 4-1.5 5.4-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="0.5 3.4" />
          </svg>
          <span className="hidden text-sm font-medium sm:block">Trips</span>
        </button>

        {/* Creators */}
        <button
          onClick={onOpenCreators}
          className="flex items-center gap-1.5 rounded-full bg-paper/85 px-3 py-2 shadow-float backdrop-blur"
          title="Creators"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent">
            <path
              d="M12 2.5 14.3 5l3.4-.3.6 3.3 3 1.6-1.4 3.1 1.4 3.1-3 1.6-.6 3.3-3.4-.3L12 22.7 9.7 20l-3.4.3-.6-3.3-3-1.6 1.4-3.1L2.7 9.2l3-1.6.6-3.3 3.4.3z"
              fill="currentColor"
            />
          </svg>
          <span className="hidden text-sm font-medium sm:block">Creators</span>
        </button>

        {/* Viewer / profile */}
        <Link
          href={`/u/${viewer.handle}`}
          className="flex items-center gap-2 rounded-full bg-paper/85 py-1.5 pl-1.5 pr-3 shadow-float backdrop-blur"
        >
          <img
            src={viewer.avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover ring-2"
            style={{ ["--tw-ring-color" as string]: viewer.color }}
          />
          <span className="hidden text-sm font-medium sm:block">Me</span>
        </Link>
      </div>
    </header>
  );
}

function Compass() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.5 8.5-2.2 5.3-5.3 2.2 2.2-5.3z" fill="currentColor" />
    </svg>
  );
}
