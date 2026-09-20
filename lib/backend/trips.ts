"use client";

// Trips and debriefs.

import { debugLoggingEnabled } from "../env";
import { sb, must, op, log } from "./core";
import type { Trip, TripReflection } from "../types";

const saveTrip = op<Trip>("saveTrip", async (trip) => {
  must(await sb().from("trips").upsert({ id: trip.id, user_id: trip.userId, title: trip.title, visibility: trip.visibility }));
  must(await sb().from("trip_stops").delete().eq("trip_id", trip.id));
  if (trip.stops.length) {
    must(await sb().from("trip_stops").insert(
      trip.stops.map((s, i) => ({ id: s.id, trip_id: trip.id, lng: s.lng, lat: s.lat, place_name: s.placeName, sort_order: i }))
    ));
  }
});
export function syncSaveTrip(trip: Trip): void {
  saveTrip(trip);
}

const renameTrip = op<{ tripId: string; title: string }>("renameTrip", async ({ tripId, title }) => {
  must(await sb().from("trips").update({ title }).eq("id", tripId));
});
export function syncRenameTrip(tripId: string, title: string): void {
  renameTrip({ tripId, title });
}

const deleteTrip = op<{ tripId: string }>("deleteTrip", async ({ tripId }) => {
  must(await sb().from("trips").delete().eq("id", tripId));
});
export function syncDeleteTrip(tripId: string): void {
  deleteTrip({ tripId });
}

const completeTrip = op<{ tripId: string; completedOn: string }>("completeTrip", async ({ tripId, completedOn }) => {
  must(await sb().from("trips").update({ completed_on: completedOn }).eq("id", tripId));
});
export function syncCompleteTrip(tripId: string, completedOn: string): void {
  completeTrip({ tripId, completedOn });
}

/** Upsert a whole debrief — reflection row + its answers, wholesale (small set). */
const saveReflection = op<TripReflection>("saveReflection", async (r) => {
  must(await sb().from("trip_reflections").upsert({
    id: r.id,
    trip_id: r.tripId,
    user_id: r.userId,
    visibility: r.visibility,
    status: r.status,
    updated_at: r.updatedAt,
  }));
  must(await sb().from("reflection_answers").delete().eq("reflection_id", r.id));
  if (!r.answers.length) return;
  must(await sb().from("reflection_answers").insert(
    r.answers.map((a, i) => ({
      reflection_id: r.id,
      question_id: a.questionId,
      prompt: a.prompt,
      text: a.text,
      pin_id: a.pinId,
      scale: a.scale ?? null,
      source: a.source,
      sort_order: i,
    }))
  ));
});
export function syncSaveReflection(r: TripReflection): void {
  saveReflection(r);
}

const deleteReflection = op<{ reflectionId: string }>("deleteReflection", async ({ reflectionId }) => {
  must(await sb().from("trip_reflections").delete().eq("id", reflectionId));
});
export function syncDeleteReflection(reflectionId: string): void {
  deleteReflection({ reflectionId });
}

/**
 * Record that a friend's debrief did work on one surface. Best-effort and
 * silent: the primary key dedupes repeat views, and a failure here must never
 * interrupt reading. Never called for your own words (the policy rejects it).
 * Not queued: a citation that did not land is not worth carrying.
 */
export function syncRecordCitation(reflectionId: string, viewerId: string, surface: "ask" | "place" | "dontmiss" | "clone"): void {
  void sb()
    .from("reflection_citations")
    .upsert({ reflection_id: reflectionId, viewer_id: viewerId, surface }, { onConflict: "reflection_id,viewer_id,surface", ignoreDuplicates: true })
    .then(({ error }) => {
      if (error && debugLoggingEnabled) log("recordCitation")(error);
    });
}
