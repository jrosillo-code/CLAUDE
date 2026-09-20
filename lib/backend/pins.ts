"use client";

// Pins: create, edit, delete, score, like, save — every one a retried op.

import { sb, must, op } from "./core";
import { notify } from "./social";
import type { Pin } from "../types";

const addPin = op<Pin>("addPin", async (pin) => {
  const row = {
    id: pin.id,
    user_id: pin.userId,
    lng: pin.lng,
    lat: pin.lat,
    place_name: pin.placeName,
    country_code: pin.countryCode || null,
    region: pin.region ?? null,
    title: pin.title,
    note: pin.note,
    started_on: pin.startedOn ?? null,
    ended_on: pin.endedOn ?? null,
    visibility: pin.visibility,
    rating: pin.rating ?? null,
    activities: pin.activities ?? [],
    here_now: pin.hereNow ?? false,
    created_at: pin.createdAt, // honors backdated imports
  };
  // Re-running after a retry must not fail on the row that did land.
  let { error } = await sb().from("pins").upsert(row, { onConflict: "id" });
  // A project that has not run migration 0021 yet has no here_now column:
  // save the pin as a normal pin rather than losing it, and say why.
  if (error && /here_now/.test(`${error.message} ${error.details ?? ""}`)) {
    console.warn("[waypoint] pins.here_now is missing — apply supabase/migrations/0021_pins_here_now.sql; saving without the dispatch flag.");
    const { here_now: _omit, ...withoutFlag } = row;
    void _omit;
    ({ error } = await sb().from("pins").upsert(withoutFlag, { onConflict: "id" }));
  }
  if (error) throw error;
  if (pin.media.length) {
    must(await sb().from("pin_photos").upsert(
      pin.media.map((m, i) => ({ id: m.id, pin_id: pin.id, storage_path: m.path ?? m.url, kind: m.kind, sort_order: i })),
      { onConflict: "id" }
    ));
  }
});
export function syncAddPin(pin: Pin): void {
  addPin(pin);
}

const updatePin = op<Pick<Pin, "id" | "title" | "note" | "visibility" | "rating">>("updatePin", async (pin) => {
  must(await sb().from("pins").update({ title: pin.title, note: pin.note, visibility: pin.visibility, rating: pin.rating ?? null }).eq("id", pin.id));
});
export function syncUpdatePin(pin: Pin): void {
  updatePin({ id: pin.id, title: pin.title, note: pin.note, visibility: pin.visibility, rating: pin.rating });
}

/** Replace a pin's photos/videos wholesale (edit flow). */
const replacePinMedia = op<{ pinId: string; media: Pin["media"] }>("updatePin media", async ({ pinId, media }) => {
  must(await sb().from("pin_photos").delete().eq("pin_id", pinId));
  if (media.length) {
    must(await sb().from("pin_photos").insert(
      media.map((m, i) => ({ id: m.id, pin_id: pinId, storage_path: m.path ?? m.url, kind: m.kind, sort_order: i }))
    ));
  }
});
export function syncReplacePinMedia(pinId: string, media: Pin["media"]): void {
  replacePinMedia({ pinId, media });
}

const deletePin = op<{ pinId: string }>("deletePin", async ({ pinId }) => {
  must(await sb().from("pins").delete().eq("id", pinId));
});
export function syncDeletePin(pinId: string): void {
  deletePin({ pinId });
}

const ratePin = op<{ pinId: string; rating: number | null }>("ratePin", async ({ pinId, rating }) => {
  must(await sb().from("pins").update({ rating }).eq("id", pinId));
});
export function syncRatePin(pinId: string, rating: number | null): void {
  ratePin({ pinId, rating });
}

const like = op<{ pinId: string; userId: string; liked: boolean }>("like", async ({ pinId, userId, liked }) => {
  must(liked
    ? await sb().from("pin_likes").upsert({ pin_id: pinId, user_id: userId }, { onConflict: "pin_id,user_id", ignoreDuplicates: true })
    : await sb().from("pin_likes").delete().eq("pin_id", pinId).eq("user_id", userId));
});
export function syncLike(pinId: string, userId: string, liked: boolean, pinOwnerId?: string): void {
  like({ pinId, userId, liked });
  if (liked && pinOwnerId && pinOwnerId !== userId) notify(pinOwnerId, userId, "like", pinId);
}

const save = op<{ pinId: string; userId: string; saved: boolean }>("save", async ({ pinId, userId, saved }) => {
  must(saved
    ? await sb().from("pin_saves").upsert({ pin_id: pinId, user_id: userId }, { onConflict: "pin_id,user_id", ignoreDuplicates: true })
    : await sb().from("pin_saves").delete().eq("pin_id", pinId).eq("user_id", userId));
});
export function syncSave(pinId: string, userId: string, saved: boolean): void {
  save({ pinId, userId, saved });
}
