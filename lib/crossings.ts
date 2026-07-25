import type { Friendship, Pin, PinWithOwner, Trip, User } from "./types";
import { acceptedFriendIds, canView } from "./data";

// ── Crossings: the serendipity engine ──────────────────────────────────────
// Waypoint's one unfair asset is a graph of where the people you trust have
// been AND where they're going. Crossings mines it for things no other app can
// tell you:
//   · "intel"    — someone you trust has BEEN to a place you're planning /
//                  saved, so their pin (rating, note, photo) is pre-trip gold.
//   · "planning" — a friend is PLANNING the same place you are, so your paths
//                  are about to cross.
// All computed client-side from data already loaded; works in demo and live.

const KMDEG = 111; // rough degrees→km; fine for "same place" clustering
const NEAR_KM = 25; // treat stops/pins within this as the same place

function near(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const dLng = (aLng - bLng) * Math.cos((aLat * Math.PI) / 180);
  const dLat = aLat - bLat;
  return Math.sqrt(dLng * dLng + dLat * dLat) * KMDEG;
}

export interface CrossPerson {
  user: User;
  /** intel: their pin at this place (the tip). */
  pin?: PinWithOwner;
  /** planning: the title of the trip that brings them here. */
  tripTitle?: string;
}

export interface Crossing {
  id: string;
  kind: "intel" | "planning";
  placeName: string;
  lng: number;
  lat: number;
  /** Where this place shows up in YOUR world ("Iberia trip", "Wishlist"). */
  mySource: string;
  people: CrossPerson[];
}

interface PlanPlace {
  name: string;
  lng: number;
  lat: number;
  source: string;
}

export interface CrossingsArgs {
  viewerId: string;
  users: User[];
  pins: Pin[];
  trips: Trip[];
  friendships: Friendship[];
  /** Creator ids the viewer follows. */
  follows: Set<string>;
  /** Pin ids the viewer saved (wishlist). */
  savedPinIds: Set<string>;
}

/** Everything you're pointed at: your trip stops + your saved (wishlist) pins. */
function myPlanPlaces(args: CrossingsArgs): PlanPlace[] {
  const { viewerId, trips, pins, savedPinIds } = args;
  const raw: PlanPlace[] = [];
  for (const t of trips) {
    if (t.userId !== viewerId) continue;
    for (const s of t.stops) raw.push({ name: s.placeName, lng: s.lng, lat: s.lat, source: t.title || "A trip" });
  }
  const byId = new Map(pins.map((p) => [p.id, p]));
  for (const id of savedPinIds) {
    const p = byId.get(id);
    if (p) raw.push({ name: p.placeName, lng: p.lng, lat: p.lat, source: "Wishlist" });
  }
  // Cluster near-duplicate places (same city across trips) into one.
  const merged: PlanPlace[] = [];
  for (const r of raw) {
    const hit = merged.find((m) => near(m.lng, m.lat, r.lng, r.lat) < NEAR_KM);
    if (!hit) merged.push({ ...r });
  }
  return merged;
}

export function computeCrossings(args: CrossingsArgs): Crossing[] {
  const { viewerId, users, pins, trips, friendships, follows } = args;
  const friendIds = acceptedFriendIds(friendships, viewerId);
  const trusted = new Set<string>([...friendIds, ...follows]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const places = myPlanPlaces(args);
  if (!places.length || !trusted.size) return [];

  const crossings: Crossing[] = [];

  for (const place of places) {
    // ── intel: trusted people who have BEEN here (a visible pin nearby) ──
    const intel = new Map<string, CrossPerson>();
    for (const p of pins) {
      if (p.userId === viewerId || !trusted.has(p.userId)) continue;
      if (!canView(p, viewerId, friendIds, false)) continue;
      if (near(p.lng, p.lat, place.lng, place.lat) > NEAR_KM) continue;
      const owner = usersById.get(p.userId);
      if (!owner) continue;
      const prev = intel.get(p.userId);
      // Keep each person's best tip: prefer a higher rating, then one with a note.
      const better =
        !prev ||
        (p.rating ?? 0) > (prev.pin?.rating ?? 0) ||
        ((p.rating ?? 0) === (prev.pin?.rating ?? 0) && p.note && !prev.pin?.note);
      if (better) intel.set(p.userId, { user: owner, pin: { ...p, owner } });
    }
    if (intel.size) {
      const people = [...intel.values()].sort(
        (a, b) => (b.pin?.rating ?? 0) - (a.pin?.rating ?? 0)
      );
      crossings.push({
        id: `intel-${place.name}-${place.lng.toFixed(2)}`,
        kind: "intel",
        placeName: place.name,
        lng: place.lng,
        lat: place.lat,
        mySource: place.source,
        people,
      });
    }

    // ── planning: friends whose trips pass through here too ──
    const planning = new Map<string, CrossPerson>();
    for (const t of trips) {
      if (t.userId === viewerId || !friendIds.has(t.userId) || t.visibility !== "friends") continue;
      const hit = t.stops.some((s) => near(s.lng, s.lat, place.lng, place.lat) <= NEAR_KM);
      if (!hit) continue;
      const owner = usersById.get(t.userId);
      if (owner && !planning.has(t.userId)) planning.set(t.userId, { user: owner, tripTitle: t.title });
    }
    if (planning.size) {
      crossings.push({
        id: `plan-${place.name}-${place.lng.toFixed(2)}`,
        kind: "planning",
        placeName: place.name,
        lng: place.lng,
        lat: place.lat,
        mySource: place.source,
        people: [...planning.values()],
      });
    }
  }

  // Planning (paths about to cross) leads; then richest intel first.
  return crossings.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "planning" ? -1 : 1;
    return b.people.length - a.people.length;
  });
}
