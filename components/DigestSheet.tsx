"use client";

import { useEffect, useMemo, useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { useDispatchPins } from "@/lib/hooks";
import { coverUrl } from "@/lib/data";
import { flagEmoji } from "@/lib/passport";
import { buildDigest, digestSeenKey, digestSubtitle, digestTitle, isEvening, type DigestPick, type DigestWindow } from "@/lib/digest";
import { listPlacesNear, loadWorldLists, useWorldLists, LIST_META } from "@/lib/lists";

// The evening digest: five places from your friends' latest pins that are
// worth a look, each with the reasons it was picked. Computed on the device
// from what the store already holds.

export function useDigest(withLists: boolean): { window: DigestWindow; picks: DigestPick[] } {
  const pins = useDispatchPins();
  const viewerId = useStore((s) => s.viewerId);
  const likeCounts = useStore((s) => s.likeCounts);
  const lists = useWorldLists();
  useEffect(() => {
    if (withLists) void loadWorldLists();
  }, [withLists]);
  return useMemo(() => {
    const listNear = withLists && lists.length
      ? (lat: number, lng: number) => {
          const near = listPlacesNear(lat, lng, 15, 1)[0];
          return near ? { name: near.name, list: LIST_META[near.list]?.label ?? near.list } : null;
        }
      : undefined;
    return buildDigest({ pins, viewerId, likeCounts, listNear });
  }, [pins, viewerId, likeCounts, lists, withLists]);
}

/** Whether tonight's digest should announce itself: evening, unseen, and
 *  with at least two picks. Resolved after mount so storage is readable. */
export function useDigestDue(pickCount: number): boolean {
  const [due, setDue] = useState(false);
  useEffect(() => {
    const check = () => {
      let seen = false;
      try {
        seen = !!window.localStorage.getItem(digestSeenKey());
      } catch {
        /* private mode: announce anyway */
      }
      setDue(isEvening() && !seen && pickCount >= 2);
    };
    check();
    const t = window.setInterval(check, 60_000);
    return () => window.clearInterval(t);
  }, [pickCount]);
  return due;
}

export function markDigestSeen(): void {
  try {
    window.localStorage.setItem(digestSeenKey(), "1");
  } catch {
    /* ignore */
  }
}

export default function DigestSheet({ onClose }: { onClose: () => void }) {
  const { window: win, picks } = useDigest(true);
  const viewerId = useStore((s) => s.viewerId);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectPin = useStore((s) => s.selectPin);
  const setMapMode = useStore((s) => s.setMapMode);
  const activeUserIds = useStore((s) => s.activeUserIds);
  const showEveryone = useStore((s) => s.showEveryone);

  useEffect(() => {
    markDigestSeen();
  }, []);

  function go(p: DigestPick) {
    setMapMode("pins");
    if (activeUserIds && !activeUserIds.has(p.pin.userId)) showEveryone();
    onClose();
    requestFlyTo(p.pin.lng, p.pin.lat, 8, { flat: true });
    window.setTimeout(() => selectPin(p.pin.id), 900);
  }

  return (
    <Sheet onClose={onClose} side="left">
      <div className="border-b border-line px-5 pb-3.5 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl" data-testid="digest-title">{digestTitle(win)}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-3">{digestSubtitle(win)}</p>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-3" data-testid="digest-list">
        {picks.length === 0 && (
          <p className="px-2 py-10 text-center text-sm text-ink-3">Nothing new from your friends yet. When they pin, the best of it lands here every evening.</p>
        )}
        <ol className="space-y-1.5">
          {picks.map((p, i) => (
            <li key={p.pin.id}>
              <button onClick={() => go(p)} className="flex w-full items-start gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-paper-2" data-testid={`digest-pick-${i}`}>
                <span className="relative mt-0.5 shrink-0">
                  {coverUrl(p.pin) ? (
                    <img src={coverUrl(p.pin)!} alt="" loading="lazy" className="h-16 w-16 rounded-xl object-cover" />
                  ) : (
                    <span className="grid h-16 w-16 place-items-center rounded-xl bg-paper-2 text-2xl">{p.pin.countryCode ? flagEmoji(p.pin.countryCode) : "📍"}</span>
                  )}
                  <img src={p.pin.owner.avatarUrl} alt="" className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full object-cover ring-2 ring-paper" />
                  <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] font-bold text-paper">{i + 1}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.pin.title}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {p.pin.countryCode ? `${flagEmoji(p.pin.countryCode)} ` : ""}{p.pin.placeName} · {p.pin.userId === viewerId ? "you" : p.pin.owner.displayName.split(" ")[0]}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {p.reasons.map((r) => (
                      <span key={r} className="rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-medium text-accent">{r}</span>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {picks.length > 0 && (
          <p className="mt-4 px-2 text-center text-[11px] text-ink-3">
            Picked by distance from your home base, countries new to your circle, world lists, likes and ratings — never by a model.
          </p>
        )}
      </div>
    </Sheet>
  );
}
