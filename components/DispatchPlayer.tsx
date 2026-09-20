"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useDispatchPins } from "@/lib/hooks";
import { coverUrl } from "@/lib/data";
import { liveDispatchesByUser, agoLabel } from "@/lib/dispatches";
import { weatherSummary } from "@/lib/fieldbrief/weather";
import type { FieldBrief } from "@/lib/fieldbrief/assemble";

// Playback of one traveler's live dispatches: photo, place, their line, and
// the field brief's light and weather for that spot right now. Tap the right
// half for the next, the left for the previous; the map flies along.
const STEP_MS = 6000;

export default function DispatchPlayer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const pins = useDispatchPins();
  const viewerId = useStore((s) => s.viewerId);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectPin = useStore((s) => s.selectPin);
  const groups = useMemo(() => liveDispatchesByUser(pins, viewerId), [pins, viewerId]);
  const gi = Math.max(0, groups.findIndex((g) => g.owner.id === userId));
  const group = groups[gi];
  const [idx, setIdx] = useState(0);
  const [brief, setBrief] = useState<FieldBrief | null>(null);
  const [paused, setPaused] = useState(false);
  const pin = group?.pins[idx];

  // Fly to each dispatch as it plays.
  useEffect(() => {
    if (pin) requestFlyTo(pin.lng, pin.lat, 6, { flat: true });
  }, [pin?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Light and weather for the spot, right now.
  useEffect(() => {
    if (!pin) return;
    let cancelled = false;
    setBrief(null);
    const date = new Date().toISOString().slice(0, 10);
    fetch("/api/field-brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: pin.lat, lng: pin.lng, date, countryCode: pin.countryCode || undefined, nearby: { scoutPins: [], reports: [] } }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (!cancelled && b) setBrief(b as FieldBrief); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pin?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance; the last dispatch closes the player.
  useEffect(() => {
    if (paused || !group) return;
    const t = window.setTimeout(() => next(), STEP_MS);
    return () => window.clearTimeout(t);
  }, [idx, paused, group?.owner.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!group || !pin) return null;

  function next() {
    if (!group) return;
    if (idx < group.pins.length - 1) setIdx(idx + 1);
    else onClose();
  }
  function prev() {
    if (idx > 0) setIdx(idx - 1);
  }

  const cover = coverUrl(pin);
  // A video-only dispatch plays its clip instead of a blank cover.
  const clip = cover ? undefined : pin.media.find((m) => m.kind === "video")?.url;
  const hhmm = (iso: string | null | undefined) => {
    if (!iso || !brief) return "—";
    const t = new Date(new Date(iso).getTime() + brief.clock.utcOffsetMinutes * 60_000);
    return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
  };
  const weather = brief && !("unavailable" in brief.wind) ? weatherSummary(brief.wind.hours) : null;
  const isMe = group.owner.id === viewerId;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" data-testid="dispatch-player" onClick={onClose}>
      <div
        className="animate-sheet relative w-full overflow-hidden rounded-t-[22px] bg-paper shadow-float sm:m-4 sm:w-[420px] sm:rounded-[22px]"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
      >
        {/* progress segments */}
        <div className="absolute inset-x-3 top-2.5 z-10 flex gap-1">
          {group.pins.map((p, i) => (
            <span key={p.id} className="h-1 flex-1 overflow-hidden rounded-full bg-paper/50">
              <span className={`block h-full rounded-full bg-paper ${i < idx ? "w-full" : i === idx ? "wp-dispatch-fill" : "w-0"}`} style={i === idx && paused ? { animationPlayState: "paused" } : undefined} />
            </span>
          ))}
        </div>
        {/* header */}
        <div className="absolute inset-x-3 top-6 z-10 flex items-center gap-2.5 text-paper drop-shadow">
          <img src={group.owner.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-paper/80" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{isMe ? "You" : group.owner.displayName}</span>
            <span className="block truncate text-[11px] opacity-90">{pin.placeName}{pin.countryCode ? `, ${pin.countryCode}` : ""} · {agoLabel(pin.createdAt)}</span>
          </span>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-ink/30 text-paper">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        {/* the picture */}
        <div className="relative aspect-[4/5] w-full bg-ink">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : clip ? (
            <>
              <video key={clip} src={clip} autoPlay muted loop playsInline preload="auto" className="h-full w-full object-cover" data-testid="dispatch-video" />
              <span className="absolute right-3 top-14 grid h-7 w-7 place-items-center rounded-full bg-ink/40 text-paper">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
              </span>
            </>
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-b from-ink to-paper-2 text-6xl">📍</div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-4 pb-4 pt-16 text-paper">
            <div className="font-display text-2xl leading-tight">{pin.title}</div>
            {pin.note && <p className="mt-1 line-clamp-3 text-sm leading-snug opacity-90">{pin.note}</p>}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-90" data-testid="dispatch-brief">
              {brief ? (
                <>
                  <span>☀ {hhmm(brief.light.sunrise)} – {hhmm(brief.light.sunset)}</span>
                  {brief.light.goldenPm && <span>golden {hhmm(brief.light.goldenPm[0])}</span>}
                  {weather && <span>{weather.dominant.glyph} {weather.dominant.label}{weather.tempMaxC != null ? ` · ${Math.round(weather.tempMaxC)}°` : ""}</span>}
                </>
              ) : (
                <span className="opacity-60">light & weather…</span>
              )}
            </div>
          </div>
          {/* tap zones */}
          <button aria-label="Previous" onClick={prev} className="absolute inset-y-0 left-0 w-1/3" />
          <button aria-label="Next" onClick={next} className="absolute inset-y-0 right-0 w-2/3" data-testid="dispatch-next" />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-ink-3">{idx + 1} of {group.pins.length}{gi < groups.length - 1 ? " · then " + (groups[gi + 1].owner.displayName.split(" ")[0]) : ""}</span>
          <button onClick={() => { selectPin(pin.id); onClose(); }} className="rounded-full bg-paper-2 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line">Open pin</button>
        </div>
      </div>
    </div>
  );
}
