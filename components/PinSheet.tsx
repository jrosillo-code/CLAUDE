"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { friendsWhoVisited, visibilityLabel } from "@/lib/data";
import { formatDates } from "@/lib/format";
import { ACTIVITY_LABELS } from "@/lib/types";
import type { PinMedia } from "@/lib/types";
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl } from "@/lib/directions";
import { CreatorBadge, formatFollowers } from "./CreatorsPanel";
import { RatingBadge, RatingScale } from "./RatingScale";
import { backendEnabled } from "@/lib/supabase";
import { uploadPinMedia } from "@/lib/backend";
import { downscaleImage } from "@/lib/image";
import { useViewer } from "@/lib/hooks";
import { SAMPLE_VIDEOS, photo } from "@/lib/seed";
import { ScoutDetailsFields, scoutFromNote, scoutToNote, type ScoutDraft } from "./ScoutDetails";
import { REPORT_OUTCOME_LABELS, TIME_OF_DAY_LABELS, type ReportOutcome } from "@/lib/types";

// Immersive pin view: a large modal with a photo collage (click any photo to
// open it full-screen), the story of the place, likes/saves, and who else has
// been there. Replaces the old arrow-carousel sheet.
export default function PinSheet() {
  const selectedPinId = useStore((s) => s.selectedPinId);
  const selectPin = useStore((s) => s.selectPin);
  const pins = useStore((s) => s.pins);
  const users = useStore((s) => s.users);
  const viewerId = useStore((s) => s.viewerId);
  const likeCounts = useStore((s) => s.likeCounts);
  const likedPinIds = useStore((s) => s.likedPinIds);
  const toggleLike = useStore((s) => s.toggleLike);
  const savedPinIds = useStore((s) => s.savedPinIds);
  const toggleSave = useStore((s) => s.toggleSave);
  const ratePin = useStore((s) => s.ratePin);
  const updatePin = useStore((s) => s.updatePin);
  const deletePin = useStore((s) => s.deletePin);
  const openBrief = useStore((s) => s.openBrief);
  const scoutNotes = useStore((s) => s.scoutNotes);
  const setScoutNote = useStore((s) => s.setScoutNote);
  const fieldReports = useStore((s) => s.fieldReports);
  const addFieldReport = useStore((s) => s.addFieldReport);
  const deleteFieldReport = useStore((s) => s.deleteFieldReport);
  const viewer = useViewer();
  const [scoutEditing, setScoutEditing] = useState(false);
  const [scoutDraft, setScoutDraft] = useState<ScoutDraft | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState({ flownOn: new Date().toISOString().slice(0, 10), outcome: "flew" as ReportOutcome, droneClass: "", quote: "", visibility: "friends" as "public" | "friends" | "private" });
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editVisibility, setEditVisibility] = useState<"public" | "friends" | "private">("friends");
  const [editMedia, setEditMedia] = useState<PinMedia[]>([]);
  const [uploadingEdit, setUploadingEdit] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const newMediaId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `m-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

  async function handleEditFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 8 - editMedia.length)) {
      const isVideo = file.type.startsWith("video/");
      setUploadingEdit((n) => n + 1);
      try {
        if (isVideo) {
          const url = backendEnabled
            ? await uploadPinMedia(viewer.id, file, file.name.split(".").pop() || "mp4")
            : URL.createObjectURL(file);
          if (url) setEditMedia((p) => [...p, { id: newMediaId(), kind: "video" as const, url }].slice(0, 8));
        } else {
          const dataUrl = await downscaleImage(file, 1600);
          let url: string | null = dataUrl;
          if (backendEnabled) {
            const blob = await (await fetch(dataUrl)).blob();
            url = await uploadPinMedia(viewer.id, blob, "jpg");
          }
          if (url) setEditMedia((p) => [...p, { id: newMediaId(), kind: "photo" as const, url }].slice(0, 8));
        }
      } finally {
        setUploadingEdit((n) => n - 1);
      }
    }
  }

  const [lightbox, setLightbox] = useState<number | null>(null);

  const pin = pins.find((p) => p.id === selectedPinId);
  const close = () => selectPin(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightbox !== null) setLightbox(null);
        else close();
      }
      if (lightbox !== null && pin) {
        if (e.key === "ArrowRight") setLightbox((i) => ((i ?? 0) + 1) % pin.media.length);
        if (e.key === "ArrowLeft")
          setLightbox((i) => ((i ?? 0) - 1 + pin.media.length) % pin.media.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, pin?.id]);

  if (!pin) return null;
  const owner = users.find((u) => u.id === pin.userId)!;
  const alsoHere = friendsWhoVisited(pins, users, pin);
  const isOwner = pin.userId === viewerId;
  const liked = likedPinIds.has(pin.id);
  const saved = savedPinIds.has(pin.id);
  const likeCount = likeCounts[pin.id] ?? 0;
  // Send the maps apps a real place name — raw coordinates snap to whatever
  // address is nearest, which reads as a random location.
  const pinPlace = pin.countryCode ? `${pin.placeName}, ${pin.countryCode}` : pin.placeName;
  const scout = scoutNotes.find((n) => n.pinId === pin.id);
  const pinReports = fieldReports.filter((r) => r.pinId === pin.id);
  const bearingWord = (deg: number) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];

  return (
    <>
      {/* Scrim */}
      <div
        onClick={close}
        className="fixed inset-0 z-40 animate-fade bg-ink/45 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
        <div className="animate-sheet pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-paper shadow-float sm:max-h-[88dvh] sm:max-w-4xl sm:rounded-[22px]">
          <div className="scroll-thin overflow-y-auto">
            {/* Collage */}
            <div className="relative">
              <Collage media={pin.media} onOpen={(i) => setLightbox(i)} />
              <button
                onClick={close}
                aria-label="Close"
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-ink/45 text-paper backdrop-blur transition-colors hover:bg-ink/65"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
              <span className="absolute left-3 top-3 rounded-full bg-ink/45 px-2.5 py-1 text-xs font-medium text-paper backdrop-blur">
                {visibilityLabel[pin.visibility]}
              </span>
            </div>

            <div className="px-5 py-5 sm:px-8 sm:py-6">
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm text-ink-3">
                    <span>{pin.placeName}</span>
                    {pin.countryCode && <span>· {pin.countryCode}</span>}
                    {(pin.startedOn || pin.endedOn) && (
                      <span>· {formatDates(pin.startedOn, pin.endedOn)}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-3xl leading-tight">{pin.title}</h2>
                    {!isOwner && pin.rating != null && <RatingBadge value={pin.rating} />}
                  </div>
                  {pin.activities && pin.activities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pin.activities.map((a) => (
                        <span key={a} className="rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-2">
                          {ACTIVITY_LABELS[a]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Like + Save */}
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggleLike(pin.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                      liked ? "bg-accent text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
                    }`}
                    aria-pressed={liked}
                  >
                    <HeartIcon filled={liked} />
                    {likeCount.toLocaleString()}
                  </button>
                  <button
                    onClick={() => toggleSave(pin.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                      saved ? "bg-ink text-paper" : "bg-paper-2 text-ink-2 hover:bg-line"
                    }`}
                    aria-pressed={saved}
                    title="Save for later"
                  >
                    <BookmarkIcon filled={saved} />
                    {saved ? "Saved" : "Save"}
                  </button>
                </div>
              </div>

              {pin.note && (
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">{pin.note}</p>
              )}

              {/* Your own score for the place — tap to set, tap again to clear */}
              {isOwner && (
                <div className="mt-5">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-3">
                    Your rating
                  </span>
                  <div className="mt-2">
                    <RatingScale value={pin.rating ?? null} onChange={(v) => ratePin(pin.id, v)} />
                  </div>
                </div>
              )}

              {/* Scout details: where to stand, which way, what glass, what time.
                  Visible to whoever can see the pin; only the owner edits. */}
              {(scout || isOwner) && (
                <div className="mt-5 rounded-2xl border border-line bg-paper-2/60 p-4" data-testid="scout-section">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-3">Scout details</span>
                    {isOwner && !scoutEditing && (
                      <button
                        onClick={() => { setScoutDraft(scoutFromNote(scout)); setScoutEditing(true); }}
                        className="text-xs font-semibold text-accent"
                        data-testid="button-scout-edit"
                      >
                        {scout ? "Edit" : "Add"}
                      </button>
                    )}
                  </div>
                  {scoutEditing && scoutDraft ? (
                    <div className="mt-2">
                      <ScoutDetailsFields value={scoutDraft} onChange={setScoutDraft} />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => { setScoutNote(pin.id, scoutToNote(scoutDraft)); setScoutEditing(false); }}
                          className="flex-1 rounded-full bg-ink py-2 text-xs font-semibold text-paper"
                          data-testid="button-scout-save"
                        >
                          Save
                        </button>
                        <button onClick={() => setScoutEditing(false)} className="flex-1 rounded-full bg-paper py-2 text-xs font-semibold text-ink-2">Cancel</button>
                      </div>
                    </div>
                  ) : scout ? (
                    <div className="mt-2 text-sm" data-testid="scout-view">
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        {scout.timeOfDay && <span className="rounded-full bg-paper px-2.5 py-1 font-medium text-ink-2">{TIME_OF_DAY_LABELS[scout.timeOfDay]}</span>}
                        {scout.bearingDeg != null && <span className="rounded-full bg-paper px-2.5 py-1 font-medium text-ink-2">facing {bearingWord(scout.bearingDeg)} · {scout.bearingDeg}°</span>}
                        {scout.focalMm != null && <span className="rounded-full bg-paper px-2.5 py-1 font-medium text-ink-2">{scout.focalMm} mm</span>}
                        {scout.camera && <span className="rounded-full bg-paper px-2.5 py-1 font-medium text-ink-2">{scout.camera}</span>}
                        {scout.drone && <span className="rounded-full bg-paper px-2.5 py-1 font-medium text-ink-2">{scout.drone}</span>}
                      </div>
                      {scout.note && <p className="mt-2 leading-relaxed text-ink-2">{scout.note}</p>}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-xs text-ink-3">Add where you stood, which way you faced and the time of day — it shows up in friends&apos; field briefs.</p>
                  )}
                </div>
              )}

              {/* Field reports on this pin: first-hand, verbatim, attributed. */}
              {(pinReports.length > 0 || isOwner) && (
                <div className="mt-4" data-testid="report-section">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-ink-3">Field reports</span>
                    {isOwner && !reportOpen && (
                      <button onClick={() => setReportOpen(true)} className="text-xs font-semibold text-accent" data-testid="button-report-add">Add</button>
                    )}
                  </div>
                  {pinReports.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {pinReports.map((r) => (
                        <li key={r.id} className="rounded-xl bg-paper-2/60 p-2.5 text-sm" data-testid={`report-${r.id}`}>
                          <p className="italic leading-relaxed text-ink-2">“{r.quote}”</p>
                          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-3">
                            <span>{REPORT_OUTCOME_LABELS[r.outcome]} · {r.flownOn}{r.droneClass ? ` · ${r.droneClass}` : ""} · {visibilityLabel[r.visibility]}</span>
                            {r.userId === viewerId && (
                              <button onClick={() => deleteFieldReport(r.id)} className="ml-auto text-accent">Delete</button>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isOwner && reportOpen && (
                    <div className="mt-2 space-y-2 rounded-2xl border border-line bg-paper-2/60 p-3" data-testid="report-form">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-ink-3">
                          Flown on
                          <input type="date" value={report.flownOn} onChange={(e) => setReport({ ...report, flownOn: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm" data-testid="report-date" />
                        </label>
                        <label className="text-xs text-ink-3">
                          Outcome
                          <select value={report.outcome} onChange={(e) => setReport({ ...report, outcome: e.target.value as ReportOutcome })} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm" data-testid="report-outcome">
                            {(Object.keys(REPORT_OUTCOME_LABELS) as ReportOutcome[]).map((o) => <option key={o} value={o}>{REPORT_OUTCOME_LABELS[o]}</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-ink-3">
                          Drone class
                          <input value={report.droneClass} onChange={(e) => setReport({ ...report, droneClass: e.target.value })} placeholder="sub-250 g, C1…" className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
                        </label>
                        <label className="text-xs text-ink-3">
                          Who can see it
                          <select value={report.visibility} onChange={(e) => setReport({ ...report, visibility: e.target.value as typeof report.visibility })} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm">
                            <option value="private">Only me</option>
                            <option value="friends">Friends</option>
                            <option value="public">Public (also on /fly)</option>
                          </select>
                        </label>
                      </div>
                      <label className="block text-xs text-ink-3">
                        What happened, in your words
                        <textarea value={report.quote} onChange={(e) => setReport({ ...report, quote: e.target.value })} rows={3} maxLength={1000} placeholder="Quoted verbatim, attributed to you — never paraphrased." className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm" data-testid="report-quote" />
                      </label>
                      <div className="flex gap-2">
                        <button
                          disabled={!report.quote.trim() || !pin.countryCode}
                          onClick={() => {
                            const saved = addFieldReport({ pinId: pin.id, countryCode: pin.countryCode.toUpperCase(), flownOn: report.flownOn, outcome: report.outcome, droneClass: report.droneClass.trim(), quote: report.quote, visibility: report.visibility });
                            if (saved) { setReportOpen(false); setReport({ ...report, quote: "", droneClass: "" }); }
                          }}
                          className="flex-1 rounded-full bg-ink py-2 text-xs font-semibold text-paper disabled:opacity-40"
                          data-testid="button-report-save"
                        >
                          Save report
                        </button>
                        <button onClick={() => setReportOpen(false)} className="flex-1 rounded-full bg-paper py-2 text-xs font-semibold text-ink-2">Cancel</button>
                      </div>
                      {!pin.countryCode && <p className="text-[11px] text-ink-3">This pin has no country code, so a report can&apos;t be filed against a country page.</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Directions hand-off */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-3">
                  Get there
                </span>
                <a
                  href={googleMapsDirectionsUrl(pin.lat, pin.lng, pinPlace)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-line"
                >
                  <DirectionsIcon />
                  Google Maps
                </a>
                <a
                  href={appleMapsDirectionsUrl(pin.lat, pin.lng, pinPlace)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-line"
                >
                  <DirectionsIcon />
                  Apple Maps
                </a>
                <button
                  onClick={() => openBrief({ lat: pin.lat, lng: pin.lng, placeName: pin.placeName, countryCode: pin.countryCode || undefined, pinId: pin.id, origin: "pin" })}
                  className="flex items-center gap-1.5 rounded-full bg-paper-2 px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-line"
                  data-testid="button-field-brief"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent"><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2.2" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  Field brief
                </button>
              </div>

              {/* Owner */}
              <Link
                href={`/u/${owner.handle}`}
                onClick={close}
                className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-paper-2/60 px-4 py-3 transition-colors hover:bg-paper-2"
              >
                <img src={owner.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: owner.color }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{owner.displayName}</span>
                    {owner.isCreator && <CreatorBadge />}
                  </div>
                  <div className="truncate text-xs text-ink-3">
                    @{owner.handle}
                    {owner.isCreator && owner.followerCount
                      ? ` · ${formatFollowers(owner.followerCount)} followers`
                      : ""}
                  </div>
                </div>
                <span className="ml-auto text-ink-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </Link>

              {/* Friends who've also been here */}
              {alsoHere.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-3">Also been here</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {alsoHere.map((u) => (
                      <Link key={u.id} href={`/u/${u.handle}`} onClick={close} className="flex items-center gap-1.5 rounded-full bg-paper-2 py-1 pl-1 pr-2.5 hover:bg-line">
                        <img src={u.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover ring-2" style={{ ["--tw-ring-color" as string]: u.color }} />
                        <span className="text-xs">{u.displayName.split(" ")[0]}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {isOwner && !editing && (
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => {
                      setEditTitle(pin.title);
                      setEditNote(pin.note);
                      setEditVisibility(pin.visibility);
                      setEditMedia(pin.media);
                      setEditing(true);
                      setConfirmDelete(false);
                    }}
                    className="flex-1 rounded-full bg-paper-2 py-2.5 text-sm font-medium text-ink-2 hover:bg-line"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDelete) {
                        deletePin(pin.id);
                      } else {
                        setConfirmDelete(true);
                      }
                    }}
                    onBlur={() => setConfirmDelete(false)}
                    className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-colors ${
                      confirmDelete ? "bg-accent text-paper" : "bg-paper-2 text-accent hover:bg-line"
                    }`}
                  >
                    {confirmDelete ? "Really delete?" : "Delete"}
                  </button>
                </div>
              )}

              {isOwner && editing && (
                <div className="mt-6 rounded-2xl border border-line bg-paper-2/60 p-4">
                  <label className="text-xs font-medium uppercase tracking-wide text-ink-3">Photos &amp; videos</label>
                  <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                    {editMedia.map((m, i) => (
                      <div key={m.id} className="relative h-20 w-20 shrink-0">
                        {m.kind === "video" ? (
                          <div className="h-full w-full overflow-hidden rounded-xl bg-ink">
                            <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-80" />
                            <span className="absolute inset-0 grid place-items-center text-paper">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
                            </span>
                          </div>
                        ) : (
                          <img src={m.url} alt="" className="h-full w-full rounded-xl object-cover" />
                        )}
                        <button
                          onClick={() => setEditMedia((p) => p.filter((_, j) => j !== i))}
                          aria-label="Remove"
                          className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-paper shadow ring-2 ring-paper"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                        </button>
                      </div>
                    ))}
                    {editMedia.length < 8 && (
                      <label
                        title="Add photos or videos"
                        className="grid h-20 w-20 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line text-ink-3 hover:border-ink-3 hover:text-ink-2"
                      >
                        {uploadingEdit > 0 ? (
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
                            void handleEditFiles(e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    {!backendEnabled && editMedia.length < 8 && (
                      <button
                        onClick={() =>
                          setEditMedia((p) =>
                            [...p, { id: newMediaId(), kind: "photo" as const, url: photo(`edit-${Date.now()}-${p.length}`, 1200, 800) }].slice(0, 8)
                          )
                        }
                        title="Add a sample photo (demo)"
                        className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border-2 border-dashed border-line text-ink-3 hover:border-ink-3 hover:text-ink-2"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="m4 16 4.5-4.5 3.5 3.5 3-3 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="9" cy="9.5" r="1.4" fill="currentColor" /></svg>
                      </button>
                    )}
                  </div>

                  <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ink-3">Title</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1.5 w-full rounded-2xl bg-paper px-3.5 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-ink/30"
                  />
                  <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ink-3">Note</label>
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full resize-none rounded-2xl bg-paper px-3.5 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-ink/30"
                  />
                  <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ink-3">Who can see this</label>
                  <div className="mt-1.5 flex gap-1.5">
                    {(["public", "friends", "private"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setEditVisibility(v)}
                        className={`flex-1 rounded-full px-2 py-2 text-xs font-medium ${
                          editVisibility === v ? "bg-ink text-paper" : "bg-paper text-ink-2 ring-1 ring-line"
                        }`}
                      >
                        {visibilityLabel[v]}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-full bg-paper px-4 py-2 text-xs font-semibold text-ink-2 ring-1 ring-line"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        updatePin(pin.id, {
                          title: editTitle.trim() || pin.title,
                          note: editNote.trim(),
                          visibility: editVisibility,
                          media: editMedia,
                        });
                        setEditing(false);
                      }}
                      className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-paper"
                    >
                      Save changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && pin.media[lightbox] && (
        <div
          className="fixed inset-0 z-[60] flex animate-fade items-center justify-center bg-ink/95"
          onClick={() => setLightbox(null)}
        >
          {pin.media[lightbox].kind === "video" ? (
            <video
              src={pin.media[lightbox].url}
              controls
              autoPlay
              playsInline
              className="max-h-[88dvh] max-w-[92vw] rounded-lg shadow-float"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={pin.media[lightbox].url}
              alt=""
              className="max-h-[88dvh] max-w-[92vw] rounded-lg object-contain shadow-float"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close photo"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-paper/15 text-paper backdrop-blur hover:bg-paper/25"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          {pin.media.length > 1 && (
            <>
              <LightboxArrow dir="left" onClick={(e) => { e.stopPropagation(); setLightbox((i) => ((i ?? 0) - 1 + pin.media.length) % pin.media.length); }} />
              <LightboxArrow dir="right" onClick={(e) => { e.stopPropagation(); setLightbox((i) => ((i ?? 0) + 1) % pin.media.length); }} />
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-paper/15 px-3 py-1 text-xs text-paper backdrop-blur">
                {lightbox + 1} / {pin.media.length}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// Airbnb-style collage: one hero tile plus a grid, "+N" overlay when there are
// more than fit. Photos and videos mix freely; video tiles preview muted and
// carry a play badge. Every tile opens the lightbox.
function Collage({ media, onOpen }: { media: PinMedia[]; onOpen: (i: number) => void }) {
  const n = media.length;
  const visible = Math.min(n, 5);
  if (n === 0) return <div className="h-40 bg-paper-2" />;

  const Tile = ({ i, className }: { i: number; className?: string }) => (
    <button onClick={() => onOpen(i)} className={`group relative overflow-hidden ${className ?? ""}`}>
      {media[i].kind === "video" ? (
        <>
          <video
            src={media[i].url}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            className="h-full w-full object-cover"
          />
          <span className="pointer-events-none absolute bottom-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-ink/60 text-paper backdrop-blur">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
          </span>
        </>
      ) : (
        <img
          src={media[i].url}
          alt=""
          loading={i > 0 ? "lazy" : "eager"}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          draggable={false}
        />
      )}
      {/* "+N more" overlay on the last visible tile */}
      {i === visible - 1 && n > visible && (
        <span className="absolute inset-0 grid place-items-center bg-ink/50 font-display text-2xl text-paper">
          +{n - visible}
        </span>
      )}
    </button>
  );

  if (n === 1) {
    return (
      <div className="h-[280px] sm:h-[380px]">
        <Tile i={0} className="h-full w-full" />
      </div>
    );
  }
  if (n === 2) {
    return (
      <div className="grid h-[280px] grid-cols-2 gap-1 sm:h-[380px]">
        <Tile i={0} /><Tile i={1} />
      </div>
    );
  }
  if (n === 3) {
    return (
      <div className="grid h-[280px] grid-cols-3 grid-rows-2 gap-1 sm:h-[380px]">
        <Tile i={0} className="col-span-2 row-span-2" />
        <Tile i={1} /><Tile i={2} />
      </div>
    );
  }
  if (n === 4) {
    return (
      <div className="grid h-[280px] grid-cols-4 grid-rows-2 gap-1 sm:h-[380px]">
        <Tile i={0} className="col-span-2 row-span-2" />
        <Tile i={1} /><Tile i={2} />
        <Tile i={3} className="col-span-2" />
      </div>
    );
  }
  return (
    <div className="grid h-[280px] grid-cols-4 grid-rows-2 gap-1 sm:h-[380px]">
      <Tile i={0} className="col-span-2 row-span-2" />
      <Tile i={1} /><Tile i={2} />
      <Tile i={3} /><Tile i={4} />
    </div>
  );
}

function LightboxArrow({ dir, onClick }: { dir: "left" | "right"; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Previous photo" : "Next photo"}
      className={`absolute top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-paper/15 text-paper backdrop-blur transition-colors hover:bg-paper/25 ${
        dir === "left" ? "left-4" : "right-4"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={dir === "left" ? "" : "rotate-180"}>
        <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function DirectionsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.8 21.2 12 12 21.2 2.8 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 13.5v-2a1 1 0 0 1 1-1h4M12.5 8.5l2 2-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}>
      <path
        d="M12 21s-7.5-4.7-10-9.3C.5 8.6 2.5 4.5 6.4 4.5c2.2 0 3.9 1.2 5.6 3.3 1.7-2.1 3.4-3.3 5.6-3.3 3.9 0 5.9 4.1 4.4 7.2C19.5 16.3 12 21 12 21z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}>
      <path
        d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}
