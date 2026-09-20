"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { useViewer } from "@/lib/hooks";
import { SAMPLE_VIDEOS, photo } from "@/lib/seed";
import type { MediaKind } from "@/lib/types";
import type { Visibility } from "@/lib/types";
import { visibilityLabel } from "@/lib/data";
import { suggestHereNow } from "@/lib/dispatches";
import { RatingScale } from "./RatingScale";
import { backendEnabled } from "@/lib/supabase";
import { uploadPinMedia, MAX_MEDIA_BYTES } from "@/lib/backend";
import { toast } from "@/lib/toast";
import { downscaleImage } from "@/lib/image";
import { EMPTY_SCOUT, ScoutDetailsFields, scoutToNote, type ScoutDraft } from "./ScoutDetails";
import { track } from "@/lib/analytics";

// Add-pin flow (plan §6): crosshair drop → bottom-sheet form → optimistic render.
// Photo upload is mocked here (Supabase Storage in production); tapping "Add
// photos" attaches seeded demo shots so the marker renders immediately.

export default function AddPinSheet() {
  const draft = useStore((s) => s.addDraft)!;
  const cancelAddPin = useStore((s) => s.cancelAddPin);
  const addPin = useStore((s) => s.addPin);
  const setScoutNote = useStore((s) => s.setScoutNote);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const viewer = useViewer();
  const [scoutOpen, setScoutOpen] = useState(false);
  const [scout, setScout] = useState<ScoutDraft>(EMPTY_SCOUT);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(viewer.defaultPinVisibility);
  const [mediaItems, setMediaItems] = useState<{ kind: MediaKind; url: string; path?: string }[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  // A dispatch: on by default when the device is at the place today.
  const userLocation = useStore((s) => s.userLocation);
  const [hereNow, setHereNow] = useState<boolean>(() => suggestHereNow(draft, userLocation, undefined));
  const [uploading, setUploading] = useState(0);

  // Real uploads: photos are downscaled client-side; with the live backend
  // they go to Supabase Storage, in demo mode they live as data/object URLs.
  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 8 - mediaItems.length)) {
      const isVideo = file.type.startsWith("video/");
      setUploading((n) => n + 1);
      try {
        if (isVideo) {
          if (!/^video\/(mp4|quicktime|webm)$/.test(file.type)) {
            toast("That video format isn't supported — MP4, MOV or WebM work.", { kind: "error" });
            continue;
          }
          if (file.size > MAX_MEDIA_BYTES) {
            toast(`That video is ${Math.round(file.size / 1048576)} MB; the limit is 100 MB.`, { kind: "error" });
            continue;
          }
          const up = backendEnabled
            ? await uploadPinMedia(viewer.id, file, file.name.split(".").pop()?.toLowerCase() || "mp4")
            : { url: URL.createObjectURL(file), path: undefined };
          if (up) setMediaItems((p) => [...p, { kind: "video" as const, url: up.url, path: up.path }].slice(0, 8));
        } else {
          const dataUrl = await downscaleImage(file, 1600);
          let url: string | null = dataUrl;
          let path: string | undefined;
          if (backendEnabled) {
            const blob = await (await fetch(dataUrl)).blob();
            const up = await uploadPinMedia(viewer.id, blob, "jpg");
            url = up?.url ?? null;
            path = up?.path;
          }
          if (url) setMediaItems((p) => [...p, { kind: "photo" as const, url, path }].slice(0, 8));
        }
      } catch (e) {
        console.error("[waypoint] media pick failed", e);
        toast("That file couldn't be read. Try another photo or video.", { kind: "error" });
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  // Demo-world helpers (hidden when the real backend is live).
  function addDemoPhotos() {
    const base = mediaItems.length;
    const more = Array.from({ length: 3 }, (_, i) => ({
      kind: "photo" as const,
      url: photo(`new-${Date.now()}-${base + i}`, 1200, 800),
    }));
    setMediaItems((p) => [...p, ...more].slice(0, 8));
  }

  function addDemoVideo() {
    setMediaItems((p) =>
      [...p, { kind: "video" as const, url: SAMPLE_VIDEOS[p.length % SAMPLE_VIDEOS.length] }].slice(0, 8)
    );
  }

  function submit() {
    const pin = addPin({
      lng: draft.lng,
      lat: draft.lat,
      placeName: draft.placeName,
      countryCode: draft.countryCode,
      region: draft.region,
      title: title.trim() || draft.placeName,
      note: note.trim(),
      visibility,
      media: mediaItems,
      rating: rating ?? undefined,
      hereNow,
    });
    const scoutNote = scoutToNote(scout);
    if (scoutNote) {
      setScoutNote(pin.id, scoutNote);
      track("scout_pin_create", { pinId: pin.id, visibility });
    }
    requestFlyTo(pin.lng, pin.lat, 7, { flat: true });
  }

  return (
    <Sheet onClose={cancelAddPin}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-display text-xl">New pin</h2>
        <button onClick={cancelAddPin} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-paper-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="scroll-thin overflow-y-auto px-5 py-4">
        {/* Place */}
        <div className="flex items-center gap-2 rounded-2xl bg-paper-2 px-3 py-2.5">
          <span>📍</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{draft.placeName}</div>
            <div className="text-xs text-ink-3">
              {draft.lat.toFixed(3)}, {draft.lng.toFixed(3)}
              {draft.countryCode ? ` · ${draft.countryCode}` : ""}
            </div>
          </div>
        </div>

        {/* Photos & videos */}
        <div className="mt-4">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-3">Photos & videos</label>
          <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
            {mediaItems.map((m, i) =>
              m.kind === "video" ? (
                <div key={`${m.url}-${i}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink">
                  <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-80" />
                  <span className="absolute inset-0 grid place-items-center text-paper">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                  </span>
                </div>
              ) : (
                <img key={`${m.url}-${i}`} src={m.url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              )
            )}
            {/* Real upload — photos and videos from the device */}
            <label
              title="Upload photos or videos"
              className="grid h-20 w-20 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-ink-3 hover:border-ink-3 hover:text-ink-2"
            >
              {uploading > 0 ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ink-2" />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              )}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {!backendEnabled && (
              <>
                <button
                  onClick={addDemoPhotos}
                  title="Add sample photos (demo)"
                  className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border-2 border-dashed border-line text-ink-3 hover:border-ink-3 hover:text-ink-2"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="m4 16 4.5-4.5 3.5 3.5 3-3 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="9" cy="9.5" r="1.4" fill="currentColor" /></svg>
                </button>
                <button
                  onClick={addDemoVideo}
                  title="Add a sample video (demo)"
                  className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border-2 border-dashed border-line text-ink-3 hover:border-ink-3 hover:text-ink-2"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="6" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="m16 10 5-2.5v9L16 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="mt-4">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-3">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={draft.placeName}
            className="mt-1.5 w-full rounded-2xl bg-paper-2 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ink/15"
          />
        </div>

        {/* Note */}
        <div className="mt-3">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-3">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What made this place worth pinning?"
            className="mt-1.5 w-full resize-none rounded-2xl bg-paper-2 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ink/15"
          />
        </div>

        {/* Your rating */}
        <div className="mt-3">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-3">
            Your rating
          </label>
          <div className="mt-1.5">
            <RatingScale value={rating} onChange={setRating} />
          </div>
        </div>

        {/* Scout details — optional, for the photographers. Same visibility
            as the pin; nothing here is shown to anyone who can't see the pin. */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setScoutOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl bg-paper-2/60 px-3 py-2 text-left text-sm"
            aria-expanded={scoutOpen}
            data-testid="button-scout-toggle"
          >
            <span className="font-medium">Scout details <span className="font-normal text-ink-3">(optional)</span></span>
            <span className="text-ink-3">{scoutOpen ? "−" : "+"}</span>
          </button>
          {scoutOpen && (
            <div className="mt-2">
              <ScoutDetailsFields value={scout} onChange={setScout} />
            </div>
          )}
        </div>

        {/* Here now: the pin becomes a dispatch — a glowing ring on the map
            and a bubble in friends' strip for three days. The pin itself
            stays forever like any other. */}
        <button
          type="button"
          onClick={() => setHereNow((v) => !v)}
          aria-pressed={hereNow}
          data-testid="here-now-toggle"
          className={`mt-3 flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left ring-1 ${hereNow ? "bg-accent/10 ring-accent/50" : "bg-paper-2/60 ring-line"}`}
        >
          <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full ${hereNow ? "bg-accent text-paper" : "bg-paper text-ink-3"}`}>
            {hereNow && <span className="wp-live-pulse absolute left-1/2 top-1/2 h-8 w-8 rounded-full bg-accent opacity-50" />}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="relative"><circle cx="12" cy="12" r="3.2" fill="currentColor" /><circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">I&apos;m here now</span>
            <span className="block text-[11px] text-ink-3">{hereNow ? "Shows as a live dispatch to your circle for 3 days." : "Off — a normal pin, dated whenever you like."}</span>
          </span>
        </button>

        {/* Visibility */}
        <div className="mt-3">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-3">Who can see this</label>
          <div className="mt-1.5 flex gap-1.5">
            {(["public", "friends", "private"] as Visibility[]).map((v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={`flex-1 rounded-full px-2 py-2 text-xs font-medium transition-colors ${
                  visibility === v ? "bg-ink text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
                }`}
              >
                {visibilityLabel[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-line p-4">
        <button
          onClick={submit}
          className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
        >
          Drop pin
        </button>
      </div>
    </Sheet>
  );
}
