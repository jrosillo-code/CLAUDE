"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { acceptedFriendIds, canView, coverUrl, distanceKm } from "@/lib/data";
import { googleMapsDirectionsUrl } from "@/lib/directions";
import { reverseGeocode, searchPlaces, type GeoResult } from "@/lib/geocode";
import type { Pin, User } from "@/lib/types";

// "Top spots": the most-liked places near a real location — your current one
// (browser geolocation, asked politely) or any region you search (a province,
// a city). Built for "what's actually good around here?" while traveling.
// A map-view mode remains as the fallback when location is unavailable.

type Mode = "near" | "search" | "view";
type GeoStatus = "idle" | "asking" | "ok" | "denied";
const RADIUS_KM = 250; // roughly a province / day-trip range

interface Anchor {
  lat: number;
  lng: number;
  label: string;
}

export default function TopSpotsPanel({ onClose }: { onClose: () => void }) {
  const pins = useStore((s) => s.pins);
  const users = useStore((s) => s.users);
  const friendships = useStore((s) => s.friendships);
  const viewerId = useStore((s) => s.viewerId);
  const likeCounts = useStore((s) => s.likeCounts);
  const viewBounds = useStore((s) => s.viewBounds);
  const selectPin = useStore((s) => s.selectPin);
  const requestFlyTo = useStore((s) => s.requestFlyTo);

  const [mode, setMode] = useState<Mode>("near");
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoAnchor, setGeoAnchor] = useState<Anchor | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searchAnchor, setSearchAnchor] = useState<Anchor | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  // Ask for the user's location when the panel opens in "Near me" (the browser
  // shows its permission prompt — we never read location without it).
  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("asking");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const anchor: Anchor = { lat: latitude, lng: longitude, label: "your location" };
        setGeoAnchor(anchor);
        setGeoStatus("ok");
        // Best-effort friendly label ("near Porto"). reverseGeocode falls back
        // to a raw coordinate string when offline (countryCode empty) — keep
        // the friendlier "your location" in that case.
        try {
          const place = await reverseGeocode(longitude, latitude);
          if (place.placeName && place.countryCode) {
            setGeoAnchor({ ...anchor, label: place.placeName });
          }
        } catch {
          /* label stays generic */
        }
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  useEffect(() => {
    if (mode === "near" && geoStatus === "idle") requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Region search (Nominatim, debounced).
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      searchAbort.current?.abort();
      const ac = new AbortController();
      searchAbort.current = ac;
      setResults(await searchPlaces(query, ac.signal));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const anchor: Anchor | null =
    mode === "near" ? geoAnchor : mode === "search" ? searchAnchor : null;

  const ranked = useMemo(() => {
    const friendIds = acceptedFriendIds(friendships, viewerId);
    const usersById = new Map(users.map((u) => [u.id, u]));
    const eligible = (p: Pin) =>
      p.visibility === "public" || canView(p, viewerId, friendIds, false);

    let candidates: { pin: Pin; dist: number | null }[];
    if (anchor) {
      candidates = pins
        .filter(eligible)
        .map((p) => ({ pin: p, dist: distanceKm(anchor.lat, anchor.lng, p.lat, p.lng) }))
        .filter((c) => (c.dist as number) <= RADIUS_KM);
    } else if (mode === "view" && viewBounds) {
      const { w, s, e, n } = viewBounds;
      const inB = (p: Pin) =>
        p.lat >= s && p.lat <= n && (w <= e ? p.lng >= w && p.lng <= e : p.lng >= w || p.lng <= e);
      candidates = pins.filter((p) => eligible(p) && inB(p)).map((p) => ({ pin: p, dist: null }));
    } else {
      candidates = [];
    }

    return candidates
      .map((c) => ({
        ...c,
        owner: usersById.get(c.pin.userId),
        likes: likeCounts[c.pin.id] ?? 0,
      }))
      .filter((c): c is { pin: Pin; dist: number | null; owner: User; likes: number } =>
        Boolean(c.owner)
      )
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 12);
  }, [pins, users, friendships, viewerId, likeCounts, anchor, mode, viewBounds]);

  function open(pin: Pin) {
    selectPin(pin.id);
    requestFlyTo(pin.lng, pin.lat, 8);
    onClose();
  }

  const title =
    mode === "near"
      ? geoAnchor
        ? `Top spots near ${geoAnchor.label}`
        : "Top spots near you"
      : mode === "search"
        ? searchAnchor
          ? `Top spots near ${searchAnchor.label}`
          : "Search a region"
        : "Top spots in this map view";

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate font-display text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          The most-liked places within {RADIUS_KM} km, from all travelers.
        </p>
        <div className="mt-3 flex gap-1.5">
          <Chip active={mode === "near"} onClick={() => setMode("near")}>Near me</Chip>
          <Chip active={mode === "search"} onClick={() => setMode("search")}>Search region</Chip>
          <Chip active={mode === "view"} onClick={() => setMode("view")}>Map view</Chip>
        </div>

        {/* Region search box */}
        {mode === "search" && (
          <div className="relative mt-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try a province, city, or region…"
              className="w-full rounded-full bg-paper-2 px-4 py-2.5 text-sm outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ink/15"
            />
            {results.length > 0 && !searchAnchor && (
              <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl bg-paper shadow-float">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      onClick={() => {
                        setSearchAnchor({ lat: r.lat, lng: r.lng, label: r.placeName });
                        setQuery(r.placeName);
                        setResults([]);
                      }}
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
            {searchAnchor && (
              <button
                onClick={() => {
                  setSearchAnchor(null);
                  setQuery("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                aria-label="Clear region"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {/* Location permission states */}
        {mode === "near" && geoStatus === "asking" && (
          <StatusCard emoji="📍" title="Requesting your location…">
            Allow location access in the browser prompt so we can rank what&apos;s around you.
          </StatusCard>
        )}
        {mode === "near" && geoStatus === "denied" && (
          <StatusCard emoji="🙈" title="Location unavailable">
            No problem — search a region instead, or rank what the map is showing.
            <span className="mt-3 flex justify-center gap-2">
              <button onClick={() => setMode("search")} className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-paper">Search region</button>
              <button onClick={requestLocation} className="rounded-full bg-paper px-4 py-2 text-xs font-semibold text-ink-2 ring-1 ring-line">Try again</button>
            </span>
          </StatusCard>
        )}
        {mode === "search" && !searchAnchor && (
          <StatusCard emoji="🗺️" title="Pick a region">
            Type a province, city, or area above — we&apos;ll rank the best-loved spots around it.
          </StatusCard>
        )}

        {(anchor || mode === "view") && ranked.length === 0 && !(mode === "near" && geoStatus !== "ok") && (
          <StatusCard emoji="🧭" title="No pins around here yet">
            Nothing within {RADIUS_KM} km — try a bigger region, or be the first to drop a pin.
          </StatusCard>
        )}

        {ranked.map((r, i) => (
          <div
            key={r.pin.id}
            className="flex items-center gap-3 rounded-2xl border border-line bg-paper-2/60 p-2.5"
          >
            <span className="w-6 shrink-0 text-center font-display text-xl text-ink-3">{i + 1}</span>
            <button onClick={() => open(r.pin)} className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-line">
              {coverUrl(r.pin) && (
                <img src={coverUrl(r.pin)} alt="" className="h-full w-full object-cover" />
              )}
            </button>
            <button onClick={() => open(r.pin)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-medium">{r.pin.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                <img src={r.owner.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                <span className="truncate">{r.pin.placeName}</span>
                {r.dist !== null && (
                  <span className="tnum shrink-0">
                    · {r.dist < 10 ? r.dist.toFixed(1) : Math.round(r.dist)} km
                  </span>
                )}
              </div>
            </button>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="tnum flex items-center gap-1 text-xs font-medium text-ink-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-accent">
                  <path d="M12 21s-7.5-4.7-10-9.3C.5 8.6 2.5 4.5 6.4 4.5c2.2 0 3.9 1.2 5.6 3.3 1.7-2.1 3.4-3.3 5.6-3.3 3.9 0 5.9 4.1 4.4 7.2C19.5 16.3 12 21 12 21z" />
                </svg>
                {r.likes.toLocaleString()}
              </span>
              <a
                href={googleMapsDirectionsUrl(r.pin.lat, r.pin.lng, r.pin.placeName)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper"
              >
                Directions ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-ink text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}

function StatusCard({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-2/50 p-7 text-center">
      <div className="text-2xl">{emoji}</div>
      <p className="mt-2 font-display text-lg">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-3">{children}</p>
    </div>
  );
}
