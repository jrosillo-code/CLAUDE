"use client";

// Incremental realtime. A postgres_changes event used to trigger a reload of
// the whole world; now it becomes a small patch: one pin refetched as the
// viewer (so row-level security applies exactly as on a full load), one like
// count, the friendships table, one notification, the trips. Anything this
// cannot express — a block, a shape it does not know — asks for the old
// full reload, which stays as the fallback.

import { sb } from "./core";
import { toPin, toReflection, toTrip, toFriendship, toNotification, signPinMedia, type PinRow, type TripRow, type ReflectionRow, type FriendshipRow, type NotificationRow } from "./rows";
import type { AppNotification, Friendship, Pin, Trip, TripReflection } from "../types";

export interface LiveChange {
  table: string;
  type: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}

export interface LivePatch {
  upsertPins?: Pin[];
  removePinIds?: string[];
  likeCounts?: Record<string, number>;
  friendships?: Friendship[];
  notifications?: AppNotification[];
  trips?: Trip[];
  reflections?: TripReflection[];
}

const PIN_SELECT = "*, pin_photos(*), pin_likes(count)";

/** One pin as the viewer sees it now, or null when it is gone or hidden. */
export async function fetchPin(pinId: string): Promise<{ pin: Pin; likes: number } | null> {
  const { data, error } = await sb().from("pins").select(PIN_SELECT).eq("id", pinId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PinRow;
  const pin = toPin(row);
  await signPinMedia([pin]);
  return { pin, likes: row.pin_likes?.[0]?.count ?? 0 };
}

async function likeCount(pinId: string): Promise<number> {
  const { count, error } = await sb().from("pin_likes").select("*", { count: "exact", head: true }).eq("pin_id", pinId);
  if (error) throw error;
  return count ?? 0;
}

async function allFriendships(): Promise<Friendship[]> {
  const { data, error } = await sb().from("friendships").select("*");
  if (error) throw error;
  return ((data ?? []) as unknown as FriendshipRow[]).map(toFriendship);
}

async function allTrips(): Promise<{ trips: Trip[]; reflections: TripReflection[] }> {
  const [t, r] = await Promise.all([
    sb().from("trips").select("*, trip_stops(*)"),
    sb().from("trip_reflections").select("*, reflection_answers(*)"),
  ]);
  if (t.error) throw t.error;
  if (r.error) throw r.error;
  return {
    trips: ((t.data ?? []) as unknown as TripRow[]).map(toTrip),
    reflections: ((r.data ?? []) as unknown as ReflectionRow[]).map(toReflection),
  };
}

/** Turn a batch of events into one patch. Returns "reload" when a full load
 *  is the honest answer. Events on the same pin collapse into one fetch. */
export async function patchFor(changes: LiveChange[], viewerId: string): Promise<LivePatch | "reload"> {
  const patch: LivePatch = {};
  const pinsToFetch = new Set<string>();
  const removePins = new Set<string>();
  const likesToCount = new Set<string>();
  let wantFriendships = false;
  let wantTrips = false;
  const notes: AppNotification[] = [];

  for (const ch of changes) {
    const id = (ch.new?.id ?? ch.old?.id) as string | undefined;
    switch (ch.table) {
      case "pins":
        if (ch.type === "DELETE") { if (id) removePins.add(id); }
        else if (id) pinsToFetch.add(id);
        break;
      case "pin_photos": {
        const pinId = (ch.new?.pin_id ?? ch.old?.pin_id) as string | undefined;
        if (pinId) pinsToFetch.add(pinId);
        break;
      }
      case "pin_likes": {
        const pinId = (ch.new?.pin_id ?? ch.old?.pin_id) as string | undefined;
        if (pinId) likesToCount.add(pinId);
        break;
      }
      case "friendships":
        wantFriendships = true;
        break;
      case "notifications":
        if (ch.new && (ch.new.user_id as string) === viewerId) notes.push(toNotification(ch.new as unknown as NotificationRow));
        break;
      case "trips":
      case "trip_reflections":
      case "reflection_answers":
        wantTrips = true;
        break;
      default:
        return "reload";
    }
  }

  const fetched = await Promise.all([...pinsToFetch].map(async (id) => ({ id, got: await fetchPin(id) })));
  for (const { id, got } of fetched) {
    if (got) {
      (patch.upsertPins ??= []).push(got.pin);
      (patch.likeCounts ??= {})[id] = got.likes;
    } else {
      removePins.add(id); // deleted, or no longer visible to this viewer
    }
  }
  if (removePins.size) patch.removePinIds = [...removePins];
  for (const id of likesToCount) {
    if (pinsToFetch.has(id)) continue; // already counted with the pin
    (patch.likeCounts ??= {})[id] = await likeCount(id);
  }
  if (wantFriendships) patch.friendships = await allFriendships();
  if (wantTrips) Object.assign(patch, await allTrips());
  if (notes.length) patch.notifications = notes;
  return patch;
}
