"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { useViewer } from "@/lib/hooks";
import { SAMPLE_VIDEOS, photo } from "@/lib/seed";
import type { MediaKind } from "@/lib/types";
import type { Visibility } from "@/lib/types";
import { visibilityLabel } from "@/lib/data";
import { RatingScale } from "./RatingScale";
import { backendEnabled } from "@/lib/supabase";
import { uploadPinMedia } from "@/lib/backend";
import { downscaleImage } from "@/lib/image";

// Add-pin flow (plan §6): crosshair drop → bottom-sheet form → optimistic render.
// Photo upload is mocked here (Supabase Storage in production); tapping "Add
// photos" attaches seeded demo shots so the marker renders immediately.

export default function AddPinSheet() {
  const draft = useStore((s) => s.addDraft)!;
  const cancelAddPin = useStore((s) => s.cancelAddPin);
  const addPin = useStore((s) => s.addPin);
  const requestFlyTo = useStore((s) => s.requestFlyTo);
  const viewer = useViewer();

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(viewer.defaultPinVisibility);
  const [mediaItems, setMediaItems] = useState<{ kind: MediaKind; url: string }[]>([]);
  const [rating, setRating] = useState<number | null>(null);
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
          const url = backendEnabled
            ? await uploadPinMedia(viewer.id, file, file.name.split(".").pop() || "mp4")
            : URL.createObjectURL(file);
          if (url) setMediaItems((p) => [...p, { kind: "video" as const, url }].slice(0, 8));
        } else {
          const dataUrl = await downscaleImage(file, 1600);
          let url: string | null = dataUrl;
          if (backendEnabled) {
            const blob = await (await fetch(dataUrl)).blob();
            url = await uploadPinMedia(viewer.id, blob, "jpg");
          }
          if (url) setMediaItems((p) => [...p, { kind: "photo" as const, url }].slice(0, 8));
        }
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
    });
    requestFlyTo(pin.lng, pin.lat, 7);
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
