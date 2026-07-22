"use client";

import { useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { useViewer } from "@/lib/hooks";
import { photo } from "@/lib/seed";
import type { Visibility } from "@/lib/types";
import { visibilityLabel } from "@/lib/data";

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
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  function addDemoPhotos() {
    const base = photoUrls.length;
    const more = Array.from({ length: 3 }, (_, i) =>
      photo(`new-${Date.now()}-${base + i}`, 1200, 800)
    );
    setPhotoUrls((p) => [...p, ...more].slice(0, 8));
  }

  function submit() {
    const pin = addPin({
      lng: draft.lng,
      lat: draft.lat,
      placeName: draft.placeName,
      countryCode: draft.countryCode,
      title: title.trim() || draft.placeName,
      note: note.trim(),
      visibility,
      photoUrls,
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

        {/* Photos */}
        <div className="mt-4">
          <label className="text-xs font-medium uppercase tracking-wide text-ink-3">Photos</label>
          <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
            {photoUrls.map((u) => (
              <img key={u} src={u} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
            ))}
            <button
              onClick={addDemoPhotos}
              className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border-2 border-dashed border-line text-ink-3 hover:border-ink-3 hover:text-ink-2"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
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
