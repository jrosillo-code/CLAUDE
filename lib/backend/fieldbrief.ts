"use client";

// Field brief: scout notes and field reports.

import { sb, must, op } from "./core";
import type { FieldReport, ScoutNote } from "../types";

const saveScoutNote = op<{ n: ScoutNote; userId: string }>("saveScoutNote", async ({ n, userId }) => {
  must(await sb().from("scout_notes").upsert({
    pin_id: n.pinId,
    user_id: userId,
    bearing_deg: n.bearingDeg ?? null,
    focal_mm: n.focalMm ?? null,
    camera: n.camera ?? "",
    drone: n.drone ?? "",
    time_of_day: n.timeOfDay ?? null,
    note: n.note,
    updated_at: new Date().toISOString(),
  }));
});
export function syncSaveScoutNote(n: ScoutNote, userId: string): void {
  saveScoutNote({ n, userId });
}

const deleteScoutNote = op<{ pinId: string }>("deleteScoutNote", async ({ pinId }) => {
  must(await sb().from("scout_notes").delete().eq("pin_id", pinId));
});
export function syncDeleteScoutNote(pinId: string): void {
  deleteScoutNote({ pinId });
}

const saveFieldReport = op<FieldReport>("saveFieldReport", async (r) => {
  must(await sb().from("field_reports").upsert({
    id: r.id,
    user_id: r.userId,
    pin_id: r.pinId ?? null,
    country_code: r.countryCode,
    flown_on: r.flownOn,
    outcome: r.outcome,
    drone_class: r.droneClass,
    quote: r.quote,
    visibility: r.visibility,
    status: r.status,
    created_at: r.createdAt,
  }));
});
export function syncSaveFieldReport(r: FieldReport): void {
  saveFieldReport(r);
}

const deleteFieldReport = op<{ id: string }>("deleteFieldReport", async ({ id }) => {
  must(await sb().from("field_reports").delete().eq("id", id));
});
export function syncDeleteFieldReport(id: string): void {
  deleteFieldReport({ id });
}
