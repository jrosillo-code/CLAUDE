"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useDispatchPins } from "@/lib/hooks";
import { coverUrl } from "@/lib/data";
import { liveDispatchesByUser, agoLabel } from "@/lib/dispatches";
import { weatherSummary } from "@/lib/fieldbrief/weather";
import type { FieldBrief } from "@/lib/fieldbrief/assemble";
import type { PinWithOwner } from "@/lib/types";

// Playback of one traveler's live dispatches, story by story.
//
// The clock starts when the picture is on screen, not when the story is
// chosen: a photo counts from its load, a clip counts from its first frame
// and runs for the clip's own length, and buffering holds the bar. The
// next story's media is fetched while this one plays, so the switch is a
// cut, not a wait. Tap the right half for the next, the left for the
// previous, hold to pause; the map flies along.

const PHOTO_MS = 6000;
const CLIP_MAX_S = 20;
const CLIP_MIN_S = 2;

type Media = { kind: "photo"; url: string } | { kind: "video"; url: string } | { kind: "none" };

function mediaOf(pin: PinWithOwner): Media {
  const cover = coverUrl(pin);
  if (cover) return { kind: "photo", url: cover };
  const clip = pin.media.find((m) => m.kind === "video")?.url;
  if (clip) return { kind: "video", url: clip };
  return { kind: "none" };
}

// Warm the browser cache for a story that is about to play.
const warmed = new Set<string>();
function warm(m: Media) {
  if (m.kind === "none" || warmed.has(m.url)) return;
  warmed.add(m.url);
  if (m.kind === "photo") {
    const img = new Image();
    img.decoding = "async";
    img.src = m.url;
  } else {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.src = m.url;
    // Ask for the first seconds; the element is dropped once it has them.
    v.load();
    const drop = () => { v.removeAttribute("src"); v.load(); };
    v.addEventListener("canplaythrough", drop, { once: true });
    setTimeout(drop, 15_000);
  }
}

export default function DispatchPlayer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const pins = useDispatchPins();
  const viewerId = useStore((s) => s.viewerId);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const selectPin = useStore((s) => s.selectPin);
  const groups = useMemo(() => liveDispatchesByUser(pins, viewerId), [pins, viewerId]);
  // Whose story is playing: starts with the bubble that was tapped and moves
  // on to the next traveler when theirs ends, like stories do.
  const [activeUser, setActiveUser] = useState(userId);
  const gi = Math.max(0, groups.findIndex((g) => g.owner.id === activeUser));
  const group = groups[gi];
  const [idx, setIdx] = useState(0);
  const [brief, setBrief] = useState<FieldBrief | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const pin = group?.pins[idx];
  const media = useMemo(() => (pin ? mediaOf(pin) : ({ kind: "none" } as Media)), [pin]);

  // Progress of the current story, 0..1, and whether its media is on screen.
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const elapsedRef = useRef(0); // ms of photo time already counted
  const lastTickRef = useRef<number | null>(null);
  const advancedRef = useRef(false);
  // A hold (to pause) must not also count as the tap that ends it.
  const holdStartRef = useRef(0);
  const wasHold = () => Date.now() - holdStartRef.current > 250;

  const next = useCallback(() => {
    if (!group) return;
    if (advancedRef.current) return;
    advancedRef.current = true;
    if (idx < group.pins.length - 1) setIdx(idx + 1);
    else if (gi < groups.length - 1) { setActiveUser(groups[gi + 1].owner.id); setIdx(0); }
    else onClose();
  }, [group, groups, gi, idx, onClose]);
  const prev = useCallback(() => {
    if (idx > 0) setIdx(idx - 1);
    else if (gi > 0) { const g = groups[gi - 1]; setActiveUser(g.owner.id); setIdx(g.pins.length - 1); }
  }, [groups, gi, idx]);

  // A new story: reset the clock and wait for its media.
  useEffect(() => {
    setProgress(0);
    setReady(media.kind === "none");
    setStalled(false);
    elapsedRef.current = 0;
    lastTickRef.current = null;
    advancedRef.current = false;
  }, [pin?.id, media.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to each dispatch as it plays.
  useEffect(() => {
    if (pin) requestFlyTo(pin.lng, pin.lat, 6, { flat: true });
  }, [pin?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warm the next story (this traveler's next, or the next traveler's first)
  // as soon as this one is on screen.
  useEffect(() => {
    if (!group) return;
    const upcoming = group.pins[idx + 1] ?? groups[gi + 1]?.pins[0];
    if (upcoming) warm(mediaOf(upcoming));
    const after = group.pins[idx + 2] ?? (group.pins[idx + 1] ? groups[gi + 1]?.pins[0] : groups[gi + 1]?.pins[1]);
    if (after) warm(mediaOf(after));
  }, [group, groups, gi, idx]);

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

  // Photo (and empty) stories: a clock that only runs while the picture is
  // on screen and nobody is holding the story.
  useEffect(() => {
    if (media.kind === "video" || !ready || paused) { lastTickRef.current = null; return; }
    const tick = (t: number) => {
      if (lastTickRef.current != null) elapsedRef.current += t - lastTickRef.current;
      lastTickRef.current = t;
      const f = Math.min(1, elapsedRef.current / PHOTO_MS);
      setProgress(f);
      if (f >= 1) { next(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastTickRef.current = null; };
  }, [media.kind, ready, paused, next]);

  // Video stories: the clip is the clock. Pause holds it; buffering holds
  // the bar; the end (or the cap) moves on.
  useEffect(() => {
    const v = videoRef.current;
    if (media.kind !== "video" || !v) return;
    if (paused) v.pause();
    else void v.play().catch(() => {});
  }, [media.kind, paused, pin?.id]);

  function onTime() {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const len = Math.max(CLIP_MIN_S, Math.min(CLIP_MAX_S, v.duration));
    const f = Math.min(1, v.currentTime / len);
    setProgress(f);
    if (v.currentTime >= len) next();
  }

  if (!group || !pin) return null;

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
        onPointerDown={() => { holdStartRef.current = Date.now(); setPaused(true); }}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
        data-ready={ready ? "1" : "0"}
      >
        {/* progress segments — driven by the media, not a fixed clock */}
        <div className="absolute inset-x-3 top-2.5 z-10 flex gap-1" data-testid="dispatch-progress">
          {group.pins.map((p, i) => (
            <span key={p.id} className="h-1 flex-1 overflow-hidden rounded-full bg-paper/50">
              <span
                className="block h-full rounded-full bg-paper"
                style={{ width: i < idx ? "100%" : i === idx ? `${Math.round(progress * 1000) / 10}%` : "0%" }}
                data-testid={i === idx ? "dispatch-progress-current" : undefined}
              />
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
          {media.kind === "video" && (
            <button
              onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={muted ? "Unmute" : "Mute"}
              className="grid h-8 w-8 place-items-center rounded-full bg-ink/30 text-paper"
              data-testid="dispatch-mute"
            >
              {muted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="m16 9 5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              )}
            </button>
          )}
          <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-ink/30 text-paper">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        {/* the picture */}
        <div className="relative aspect-[4/5] w-full bg-ink">
          {media.kind === "photo" ? (
            <img
              key={media.url}
              src={media.url}
              alt=""
              decoding="async"
              onLoad={() => setReady(true)}
              onError={() => setReady(true)}
              className={`h-full w-full object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
            />
          ) : media.kind === "video" ? (
            <video
              key={media.url}
              ref={videoRef}
              src={media.url}
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onLoadedData={() => setReady(true)}
              onPlaying={() => { setReady(true); setStalled(false); }}
              onWaiting={() => setStalled(true)}
              onStalled={() => setStalled(true)}
              onTimeUpdate={onTime}
              onEnded={next}
              onError={() => { setReady(true); next(); }}
              className={`h-full w-full object-cover transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
              data-testid="dispatch-video"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-b from-ink to-paper-2 text-6xl">📍</div>
          )}
          {(!ready || stalled) && media.kind !== "none" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center" data-testid="dispatch-loading">
              <span className="h-9 w-9 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
            </div>
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
          <button aria-label="Previous" onClick={() => { if (!wasHold()) prev(); }} className="absolute inset-y-0 left-0 w-1/3" />
          <button aria-label="Next" onClick={() => { if (!wasHold()) next(); }} className="absolute inset-y-0 right-0 w-2/3" data-testid="dispatch-next" />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-ink-3">{idx + 1} of {group.pins.length}{gi < groups.length - 1 ? " · then " + (groups[gi + 1].owner.displayName.split(" ")[0]) : ""}</span>
          <button onClick={() => { selectPin(pin.id); onClose(); }} onPointerDown={(e) => e.stopPropagation()} className="rounded-full bg-paper-2 px-3.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line">Open pin</button>
        </div>
      </div>
    </div>
  );
}
