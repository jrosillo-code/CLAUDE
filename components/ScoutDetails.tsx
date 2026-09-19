"use client";

import { TIME_OF_DAY_LABELS, type ScoutNote, type TimeOfDay } from "@/lib/types";

// The scout-details fields, shared by the add-pin sheet and the pin sheet's
// edit mode: where you stood, which way you faced, what glass, what time.
// All optional; the note is the part friends actually read.

export type ScoutDraft = {
  bearingDeg: string;
  focalMm: string;
  camera: string;
  drone: string;
  timeOfDay: TimeOfDay | "";
  note: string;
};

export const EMPTY_SCOUT: ScoutDraft = { bearingDeg: "", focalMm: "", camera: "", drone: "", timeOfDay: "", note: "" };

export function scoutFromNote(n: ScoutNote | undefined): ScoutDraft {
  if (!n) return EMPTY_SCOUT;
  return {
    bearingDeg: n.bearingDeg != null ? String(n.bearingDeg) : "",
    focalMm: n.focalMm != null ? String(n.focalMm) : "",
    camera: n.camera ?? "",
    drone: n.drone ?? "",
    timeOfDay: n.timeOfDay ?? "",
    note: n.note,
  };
}

/** Null when every field is empty — nothing worth saving. */
export function scoutToNote(d: ScoutDraft): Omit<ScoutNote, "pinId"> | null {
  const bearing = d.bearingDeg.trim() === "" ? undefined : Math.max(0, Math.min(359, Math.round(Number(d.bearingDeg))));
  const focal = d.focalMm.trim() === "" ? undefined : Math.max(1, Math.round(Number(d.focalMm)));
  const note: Omit<ScoutNote, "pinId"> = {
    bearingDeg: Number.isFinite(bearing as number) ? bearing : undefined,
    focalMm: Number.isFinite(focal as number) ? focal : undefined,
    camera: d.camera.trim() || undefined,
    drone: d.drone.trim() || undefined,
    timeOfDay: d.timeOfDay || undefined,
    note: d.note.trim(),
  };
  const empty = note.bearingDeg == null && note.focalMm == null && !note.camera && !note.drone && !note.timeOfDay && !note.note;
  return empty ? null : note;
}

const field = "w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-3";

export function ScoutDetailsFields({ value, onChange }: { value: ScoutDraft; onChange: (d: ScoutDraft) => void }) {
  const set = (k: keyof ScoutDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div className="space-y-2" data-testid="scout-fields">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-3">
          Bearing (°)
          <input type="number" min={0} max={359} inputMode="numeric" value={value.bearingDeg} onChange={set("bearingDeg")} placeholder="0–359" className={`mt-1 ${field}`} data-testid="scout-bearing" />
        </label>
        <label className="text-xs text-ink-3">
          Focal length (mm)
          <input type="number" min={1} inputMode="numeric" value={value.focalMm} onChange={set("focalMm")} placeholder="24" className={`mt-1 ${field}`} data-testid="scout-focal" />
        </label>
        <label className="text-xs text-ink-3">
          Camera
          <input value={value.camera} onChange={set("camera")} placeholder="Body or phone" className={`mt-1 ${field}`} />
        </label>
        <label className="text-xs text-ink-3">
          Drone
          <input value={value.drone} onChange={set("drone")} placeholder="Model, if flown" className={`mt-1 ${field}`} />
        </label>
      </div>
      <label className="block text-xs text-ink-3">
        Time of day
        <select value={value.timeOfDay} onChange={set("timeOfDay")} className={`mt-1 ${field}`} data-testid="scout-time">
          <option value="">—</option>
          {(Object.keys(TIME_OF_DAY_LABELS) as TimeOfDay[]).map((t) => (
            <option key={t} value={t}>{TIME_OF_DAY_LABELS[t]}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-ink-3">
        Scout note
        <textarea value={value.note} onChange={set("note")} rows={2} maxLength={2000} placeholder="Where to stand, when to come back, what to bring." className={`mt-1 ${field}`} data-testid="scout-note" />
      </label>
    </div>
  );
}
