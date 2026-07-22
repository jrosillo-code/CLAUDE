"use client";

import Link from "next/link";
import Sheet from "./Sheet";
import PhotoCarousel from "./PhotoCarousel";
import { useStore } from "@/lib/store";
import { friendsWhoVisited, visibilityLabel } from "@/lib/data";
import { formatDates } from "@/lib/format";

export default function PinSheet() {
  const selectedPinId = useStore((s) => s.selectedPinId);
  const selectPin = useStore((s) => s.selectPin);
  const pins = useStore((s) => s.pins);
  const users = useStore((s) => s.users);
  const viewerId = useStore((s) => s.viewerId);

  const pin = pins.find((p) => p.id === selectedPinId);
  if (!pin) return null;
  const owner = users.find((u) => u.id === pin.userId)!;
  const alsoHere = friendsWhoVisited(pins, users, pin);
  const isOwner = pin.userId === viewerId;

  return (
    <Sheet onClose={() => selectPin(null)}>
      <div className="relative">
        <PhotoCarousel photos={pin.photos} />
        <button
          onClick={() => selectPin(null)}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink/40 text-paper backdrop-blur hover:bg-ink/60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium text-paper backdrop-blur"
          style={{ background: "rgba(26,23,20,.45)" }}
        >
          {visibilityLabel[pin.visibility]}
        </span>
      </div>

      <div className="scroll-thin overflow-y-auto px-5 py-4">
        <div className="flex items-center gap-1.5 text-sm text-ink-3">
          <span>{pin.placeName}</span>
          {pin.countryCode && <span>· {pin.countryCode}</span>}
        </div>
        <h2 className="mt-0.5 font-display text-2xl leading-tight">{pin.title}</h2>
        {(pin.startedOn || pin.endedOn) && (
          <p className="mt-1 text-sm text-ink-3">{formatDates(pin.startedOn, pin.endedOn)}</p>
        )}

        {pin.note && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{pin.note}</p>}

        {/* Owner */}
        <Link
          href={`/u/${owner.handle}`}
          className="mt-4 flex items-center gap-2.5 rounded-2xl bg-paper-2 px-3 py-2.5 transition-colors hover:bg-line"
        >
          <img src={owner.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: owner.color }} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{owner.displayName}</div>
            <div className="truncate text-xs text-ink-3">@{owner.handle}</div>
          </div>
          <span className="ml-auto text-ink-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </Link>

        {/* Friends who've also been here */}
        {alsoHere.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-3">Also been here</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {alsoHere.map((u) => (
                <Link key={u.id} href={`/u/${u.handle}`} className="flex items-center gap-1.5 rounded-full bg-paper-2 py-1 pl-1 pr-2.5 hover:bg-line">
                  <img src={u.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: u.color }} />
                  <span className="text-xs">{u.displayName.split(" ")[0]}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isOwner && (
          <div className="mt-5 flex gap-2">
            <button className="flex-1 rounded-full bg-paper-2 py-2.5 text-sm font-medium text-ink-2 hover:bg-line">Edit</button>
            <button className="flex-1 rounded-full bg-paper-2 py-2.5 text-sm font-medium text-accent hover:bg-line">Delete</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
