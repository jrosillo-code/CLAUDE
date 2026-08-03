"use client";

import { useMemo, useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { acceptedFriendIds, canView, coverUrl } from "@/lib/data";
import type { PinWithOwner } from "@/lib/types";

// The Living Guide: your map, compiled into something you can hand to anyone.
// For a country you've pinned, it gathers your places plus tips from the people
// you trust into one shareable guide — "Guillermo's Portugal" — and renders a
// downloadable card. This is Waypoint's outbound artifact: a non-user receives
// a real, personal travel guide and comes to make their own.
export default function GuidePanel({ onClose }: { onClose: () => void }) {
  const viewerId = useStore((s) => s.viewerId);
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const friendships = useStore((s) => s.friendships);
  const follows = useStore((s) => s.follows);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectPin = useStore((s) => s.selectPin);
  const setMapMode = useStore((s) => s.setMapMode);

  const me = users.find((u) => u.id === viewerId);
  const [country, setCountry] = useState<string | null>(null);

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      return null;
    }
  }, []);
  const countryName = (code: string) => {
    try {
      return regionNames?.of(code) ?? code;
    } catch {
      return code;
    }
  };

  // Countries where YOU have pins — the guides you can make.
  const myCountries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pins) {
      if (p.userId !== viewerId || !p.countryCode) continue;
      counts.set(p.countryCode, (counts.get(p.countryCode) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [pins, viewerId]);

  // The guide itself: your pins + trusted friends'/creators' pins in a country.
  const entries = useMemo<PinWithOwner[]>(() => {
    if (!country) return [];
    const friendIds = acceptedFriendIds(friendships, viewerId);
    const trusted = new Set<string>([viewerId, ...friendIds, ...follows]);
    const usersById = new Map(users.map((u) => [u.id, u]));
    const out: PinWithOwner[] = [];
    for (const p of pins) {
      if (p.countryCode !== country || !trusted.has(p.userId)) continue;
      if (!canView(p, viewerId, friendIds, false)) continue;
      const owner = usersById.get(p.userId);
      if (owner) out.push({ ...p, owner });
    }
    // Highest-rated first; your own places lead a tie.
    return out.sort(
      (a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (a.userId === viewerId ? -1 : 0) - (b.userId === viewerId ? -1 : 0)
    );
  }, [country, pins, users, friendships, follows, viewerId]);

  function downloadGuideCard() {
    if (!country || !me) return;
    const W = 1080, H = 1350;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "#c65d3b";
    const paper = "#f6f2ea", ink = "#181a20", faint = "#8b8578";
    const SERIF = "Georgia, 'Times New Roman', serif";
    const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    // Accent header band.
    ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 12);

    ctx.textAlign = "left";
    ctx.fillStyle = accent; ctx.font = `600 26px ${MONO}`;
    ctx.letterSpacing = "6px";
    ctx.fillText("A WAYPOINT GUIDE", 84, 130);
    ctx.letterSpacing = "0px";

    const first = me.displayName.split(" ")[0];
    ctx.fillStyle = ink; ctx.font = `700 92px ${SERIF}`;
    ctx.fillText(`${first}'s`, 82, 240);
    ctx.fillText(countryName(country), 82, 340);

    ctx.fillStyle = faint; ctx.font = `400 30px ${SERIF}`;
    ctx.fillText(`${entries.length} ${entries.length === 1 ? "place" : "places"} worth your time`, 84, 400);

    // Entries.
    let y = 500;
    for (const p of entries.slice(0, 8)) {
      ctx.fillStyle = ink; ctx.font = `600 40px ${SERIF}`;
      const name = p.placeName.length > 26 ? p.placeName.slice(0, 25) + "…" : p.placeName;
      ctx.fillText(name, 84, y);
      if (p.rating != null) {
        ctx.fillStyle = accent; ctx.font = `700 30px ${MONO}`;
        ctx.textAlign = "right";
        ctx.fillText(`${p.rating}/10`, W - 84, y);
        ctx.textAlign = "left";
      }
      const note = (p.note || p.title || "").trim();
      if (note) {
        ctx.fillStyle = faint; ctx.font = `400 26px ${SERIF}`;
        const clip = note.length > 60 ? note.slice(0, 58) + "…" : note;
        ctx.fillText(clip, 84, y + 38);
      }
      ctx.fillStyle = "#c9c2b4"; ctx.font = `400 20px ${MONO}`;
      ctx.fillText(`— ${p.owner.displayName}`, 84, y + 74);
      y += 108;
      if (y > H - 140) break;
    }

    ctx.fillStyle = ink; ctx.font = `600 28px ${MONO}`;
    ctx.letterSpacing = "4px";
    ctx.textAlign = "center";
    ctx.fillText("✦  WAYPOINT", W / 2, H - 70);
    ctx.letterSpacing = "0px";

    const a = document.createElement("a");
    a.download = `waypoint-guide-${countryName(country).toLowerCase().replace(/\s+/g, "-")}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  }

  function openPin(p: PinWithOwner) {
    setMapMode("pins");
    selectPin(p.id);
    requestFlyTo(p.lng, p.lat, 9, { flat: true });
    onClose();
  }

  return (
    <Sheet onClose={onClose}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {country && (
              <button onClick={() => setCountry(null)} aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
            <h2 className="font-display text-2xl">{country ? `${(me?.displayName ?? "Your")}'s ${countryName(country)}` : "City guides"}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        {!country && (
          <p className="mt-1 text-sm text-ink-3">
            Turn a country you&apos;ve pinned into a shareable guide — your places plus
            tips from the people you trust. Send it to anyone.
          </p>
        )}
      </div>

      <div className="scroll-thin flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {!country &&
          (myCountries.length === 0 ? (
            <div className="rounded-2xl border border-line bg-paper-2/50 p-8 text-center">
              <div className="text-2xl">📍</div>
              <p className="mt-2 font-display text-lg">No guides yet</p>
              <p className="mt-1 text-sm text-ink-3">Drop a few pins and each country becomes a guide you can share.</p>
            </div>
          ) : (
            myCountries.map(([code, n]) => (
              <button
                key={code}
                onClick={() => setCountry(code)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper-2/60 p-4 text-left transition-colors hover:bg-paper-2"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="10" r="2.4" fill="currentColor" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg leading-tight">{countryName(code)}</div>
                  <div className="text-xs text-ink-3">{n} of your places</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-ink-3"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))
          ))}

        {country && (
          <>
            <button
              onClick={downloadGuideCard}
              className="mb-1 w-full rounded-full bg-accent py-3 text-sm font-semibold text-paper"
            >
              Download guide card ↓
            </button>
            {entries.map((p) => {
              const cover = coverUrl(p);
              const mine = p.userId === viewerId;
              return (
                <button
                  key={p.id}
                  onClick={() => openPin(p)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper-2/60 p-3 text-left transition-colors hover:bg-paper-2"
                >
                  <img src={cover || p.owner.avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{p.placeName}</span>
                      {p.rating != null && (
                        <span className="ml-auto shrink-0 rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold text-paper">{p.rating}/10</span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-ink-2">{p.note || p.title}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-3">
                      <img src={p.owner.avatarUrl} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                      {mine ? "You" : p.owner.displayName}
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>
    </Sheet>
  );
}
